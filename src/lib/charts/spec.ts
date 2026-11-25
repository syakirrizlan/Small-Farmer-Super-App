/**
 * Chart blocks the AI may put in its answer:
 *
 *   ```chart
 *   { "type": "bar", "title": "Expenses by category", "source": "records",
 *     "query": { "module": "finance", "measure": "sum", "field": "amount",
 *                "groupBy": "category", "where": { "type": "Expense" }, "period": "this-month" } }
 *   ```
 *
 * source "records": the app computes the numbers from the farmer's own records (trusted).
 * source "ai": the AI supplies `data` itself (shown as an estimate).
 * Everything is validated here; anything invalid is rejected and the text answer stands alone.
 */
import { MODULES, getModule, type ModuleDef } from "../../db/modules";

export type ChartType = "bar" | "line" | "donut" | "progress";
export const CHART_TYPES: ChartType[] = ["bar", "line", "donut", "progress"];
export const PERIODS = ["this-month", "last-month", "last-3-months", "last-6-months", "last-12-months", "this-year", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const TIME_GROUPS = ["month", "week"] as const;

export interface RecordsQuery {
  module: string;
  measure: "count" | "sum";
  field?: string;            // number field, required for "sum"
  groupBy?: string;          // a field of the module, or "month" / "week"
  where?: Record<string, string>;
  period: Period;
}

export interface DataPoint { label: string; value: number }

export type ChartSpec =
  | { type: ChartType; title: string; unit?: string; source: "records"; query: RecordsQuery }
  | { type: ChartType; title: string; unit?: string; source: "ai"; data: DataPoint[] };

export const MAX_POINTS = 24;
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** The module's date field used for periods and month/week grouping (falls back to createdAt). */
export function dateFieldOf(m: ModuleDef): string | undefined {
  return m.fields.find((f) => f.type === "date")?.key;
}

function validQuery(q: unknown): RecordsQuery | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;
  const m = getModule(String(o.module ?? ""));
  if (!m) return null;
  const measure = o.measure === "sum" ? "sum" : o.measure === "count" || o.measure === undefined ? "count" : null;
  if (!measure) return null;
  const fieldDef = (k: unknown) => m.fields.find((f) => f.key === k);
  let field: string | undefined;
  if (measure === "sum") {
    const f = fieldDef(o.field);
    if (!f || f.type !== "number") return null;
    field = f.key;
  }
  let groupBy: string | undefined;
  if (o.groupBy !== undefined && o.groupBy !== null && o.groupBy !== "") {
    const g = String(o.groupBy);
    if ((TIME_GROUPS as readonly string[]).includes(g)) groupBy = g;
    else {
      const f = fieldDef(g);
      if (!f || f.type === "number" || f.type === "textarea") return null;
      groupBy = f.key;
    }
  }
  let where: Record<string, string> | undefined;
  if (o.where && typeof o.where === "object") {
    where = {};
    for (const [k, v] of Object.entries(o.where as Record<string, unknown>)) {
      if (!fieldDef(k) || (typeof v !== "string" && typeof v !== "number")) return null;
      where[k] = String(v);
    }
  }
  const period = (PERIODS as readonly string[]).includes(String(o.period)) ? (o.period as Period) : "all";
  return { module: m.id, measure, field, groupBy, where, period };
}

function validData(d: unknown): DataPoint[] | null {
  if (!Array.isArray(d) || d.length === 0 || d.length > MAX_POINTS) return null;
  const out: DataPoint[] = [];
  for (const p of d) {
    if (!p || typeof p !== "object") return null;
    const label = str((p as Record<string, unknown>).label, 40);
    const value = Number((p as Record<string, unknown>).value);
    if (!label || !Number.isFinite(value) || Math.abs(value) > 1e12) return null;
    out.push({ label, value });
  }
  return out;
}

/** Validate untrusted JSON from the AI. Returns null if anything is off. */
export function parseChartSpec(raw: string): ChartSpec | null {
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const type = CHART_TYPES.includes(o.type as ChartType) ? (o.type as ChartType) : null;
  const title = str(o.title, 80);
  if (!type || !title) return null;
  const unit = str(o.unit, 8);
  if (o.source === "records") {
    const query = validQuery(o.query);
    return query ? { type, title, unit, source: "records", query } : null;
  }
  if (o.source === "ai" || o.data) {
    const data = validData(o.data);
    if (!data || (type !== "line" && data.some((p) => p.value < 0) && type !== "bar")) return null;
    return { type, title, unit, source: "ai", data };
  }
  return null;
}

export type Segment = { kind: "text"; text: string } | { kind: "chart"; raw: string } | { kind: "pending" };

/** Split an answer into text and ```chart blocks. An unfinished block (still streaming) becomes "pending". */
export function splitMessage(content: string): Segment[] {
  const out: Segment[] = [];
  const re = /```chart[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  for (let m = re.exec(content); m; m = re.exec(content)) {
    if (m.index > last) out.push({ kind: "text", text: content.slice(last, m.index) });
    out.push({ kind: "chart", raw: m[1] });
    last = m.index + m[0].length;
  }
  const rest = content.slice(last);
  const open = rest.search(/```chart/);
  if (open >= 0) {
    if (open > 0) out.push({ kind: "text", text: rest.slice(0, open) });
    out.push({ kind: "pending" });
  } else if (rest) out.push({ kind: "text", text: rest });
  return out
    .map((s) => (s.kind === "text" ? { ...s, text: s.text.replace(/^\n+|\n+$/g, "") } : s))
    .filter((s) => s.kind !== "text" || s.text.trim() !== "");
}

/** Instructions for the model: the block format plus the exact modules and fields it may use. */
export function chartInstructions(): string {
  const modules = MODULES.map((m) => {
    const fields = m.fields.map((f) => `${f.key}(${f.type}${f.options ? `: ${f.options.join("|")}` : ""})`).join(", ");
    const d = dateFieldOf(m);
    return `- ${m.id}: ${fields}${d ? ` — date field for period/month/week: ${d}` : " — no date field (period uses when the record was created)"}`;
  }).join("\n");
  return `# Charts
When a picture would answer better than words (comparisons, totals by category, trends over time, shares of a whole, progress), add ONE chart block (at most two) after a short text answer. Never draw charts with ASCII or tables when a chart fits. Format exactly:

\`\`\`chart
{"type":"bar|line|donut|progress","title":"short title","source":"records","query":{"module":"<module>","measure":"count|sum","field":"<number field, for sum>","groupBy":"<field>|month|week","where":{"<field>":"<value>"},"period":"${PERIODS.join("|")}"}}
\`\`\`

Rules:
- Prefer source "records" whenever the chart is about the farmer's own data: the app computes the numbers itself, so they are always correct. Do not invent numbers that come from the records.
- Use source "ai" only for things not in the records (estimates, forecasts, general knowledge), with "data":[{"label":"…","value":number}] (max ${MAX_POINTS} points) and an optional "unit" such as "kg". These are shown to the farmer as an estimate.
- Use dropdown values exactly as listed (they are stored in English) in "where". Money amounts are Malaysian ringgit.
- "bar" for categories (or months), "line" for trends over time, "donut" for parts of a whole (max 6 parts), "progress" for status counts.
- Valid JSON only, no comments. Write titles in the reply language.

Modules and fields:
${modules}`;
}
