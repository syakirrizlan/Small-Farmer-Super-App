/** Compute chart numbers from the farmer's own records (IndexedDB). */
import { db, type FarmRecord } from "../../db/db";
import { getModule } from "../../db/modules";
import { locale, t, tOption } from "../../i18n";
import { dateFieldOf, type DataPoint, type RecordsQuery } from "./spec";

const MAX_CATEGORIES = 8;

function recordDate(r: FarmRecord, field?: string): Date | null {
  const v = field ? r[field] : undefined;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(`${v.slice(0, 10)}T00:00:00`);
  if (!field && typeof r.createdAt === "number") return new Date(r.createdAt);
  return null;
}

function periodStart(period: RecordsQuery["period"], now: Date): { from: Date | null; to: Date | null } {
  const y = now.getFullYear(), m = now.getMonth();
  switch (period) {
    case "this-month": return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "last-month": return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "last-3-months": return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 1) };
    case "last-6-months": return { from: new Date(y, m - 5, 1), to: new Date(y, m + 1, 1) };
    case "last-12-months": return { from: new Date(y, m - 11, 1), to: new Date(y, m + 1, 1) };
    case "this-year": return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    default: return { from: null, to: null };
  }
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** Local calendar day as YYYY-MM-DD (not UTC, which would shift days in Malaysia). */
const dayKey = (d: Date) => `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
function weekStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

export interface QueryResult { points: DataPoint[]; unit?: string; time: boolean }

export async function runQuery(q: RecordsQuery, now = new Date()): Promise<QueryResult> {
  const mod = getModule(q.module)!;
  const dateField = dateFieldOf(mod);
  const rows = await db.records(mod.id).toArray();
  const { from, to } = periodStart(q.period, now);
  const time = q.groupBy === "month" || q.groupBy === "week";

  const matches = rows.filter((r) => {
    if (q.where) for (const [k, v] of Object.entries(q.where)) {
      if (String(r[k] ?? "").trim().toLowerCase() !== v.trim().toLowerCase()) return false;
    }
    if (from || time) {
      const d = recordDate(r, dateField);
      if (!d) return false;
      if (from && (d < from || d >= to!)) return false;
    }
    return true;
  });

  const add = (map: Map<string, number>, key: string, r: FarmRecord) => {
    const v = q.measure === "sum" ? Number(r[q.field!]) : 1;
    if (!Number.isFinite(v)) return;
    map.set(key, (map.get(key) ?? 0) + v);
  };

  const sums = new Map<string, number>();
  if (!q.groupBy) {
    matches.forEach((r) => add(sums, "total", r));
    const unit = unitFor(q);
    return { points: [{ label: t("assistant.chartTotal"), value: sums.get("total") ?? 0 }], unit, time: false };
  }

  if (time) {
    matches.forEach((r) => {
      const d = recordDate(r, dateField)!;
      add(sums, q.groupBy === "month" ? monthKey(d) : dayKey(weekStart(d)), r);
    });
    // Fill empty months/weeks inside the period (or between first and last record) with 0.
    const keys = [...sums.keys()].sort();
    const start = from ?? (keys[0] ? new Date(`${keys[0].length === 7 ? keys[0] + "-01" : keys[0]}T00:00:00`) : null);
    const end = to ? new Date(to.getTime() - 1) : keys.length ? new Date(`${keys[keys.length - 1].length === 7 ? keys[keys.length - 1] + "-01" : keys[keys.length - 1]}T00:00:00`) : null;
    const filled: string[] = [];
    if (start && end) {
      if (q.groupBy === "month") for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end && filled.length < 24; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) filled.push(monthKey(d));
      else for (let d = weekStart(start); d <= end && filled.length < 24; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) filled.push(dayKey(d));
    }
    const list = (filled.length ? filled : keys).slice(-24);
    const spansYears = new Set(list.map((k) => k.slice(0, 4))).size > 1;
    const fmt = new Intl.DateTimeFormat(locale(), q.groupBy === "month"
      ? { month: "short", ...(spansYears ? { year: "2-digit" } : {}) }
      : { day: "numeric", month: "short" });
    return {
      points: list.map((k) => ({ label: fmt.format(new Date(`${k.length === 7 ? k + "-01" : k}T00:00:00`)), value: sums.get(k) ?? 0 })),
      unit: unitFor(q), time: true,
    };
  }

  const field = mod.fields.find((f) => f.key === q.groupBy)!;
  matches.forEach((r) => {
    const raw = String(r[field.key] ?? "").trim();
    add(sums, raw, r);
  });
  let points = [...sums.entries()]
    .map(([k, v]) => ({ label: k ? (field.type === "select" ? tOption(k) : k).slice(0, 40) : t("assistant.chartNone"), value: v }))
    .sort((a, b) => b.value - a.value);
  if (points.length > MAX_CATEGORIES) {
    const rest = points.slice(MAX_CATEGORIES - 1).reduce((s, p) => s + p.value, 0);
    points = [...points.slice(0, MAX_CATEGORIES - 1), { label: t("assistant.chartOther"), value: rest }];
  }
  return { points, unit: unitFor(q), time: false };
}

function unitFor(q: RecordsQuery): string | undefined {
  if (q.measure === "sum" && q.module === "finance" && q.field === "amount") return "RM";
  if (q.measure === "sum") {
    const f = getModule(q.module)?.fields.find((x) => x.key === q.field);
    return f?.unit;
  }
  return undefined;
}
