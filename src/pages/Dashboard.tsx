import "../styles/dashboard.css";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FarmRecord } from "../db/db";
import { getModule } from "../db/modules";
import Icon, { type IconName } from "../components/Icon";
import { locale, tDynamic, useI18n } from "../i18n";

const today = () => new Date().toISOString().slice(0, 10);

/** Parse a stored "YYYY-MM-DD" as a local calendar date (avoids UTC off-by-one). */
function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const DAY = 86_400_000;
function daysFromNow(d: Date) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - base.getTime()) / DAY);
}

type Tile = CSSProperties & { "--tile"?: string };
const tileStyle = (color: string): Tile => ({ "--tile": color });
const moduleColor = (id: string, fallback: string) => getModule(id)?.color ?? fallback;
const moduleGlyph = (id: string, fallback: IconName) => getModule(id)?.glyph ?? fallback;
const optionLabel = (v: unknown) => (v ? tDynamic(`options.${String(v)}`, String(v)) : "");

export default function Dashboard() {
  const { t } = useI18n();
  const stats = useLiveQuery(async () => {
    const [crops, animals, tasks, inventory, money] = await Promise.all([
      db.records("crops").toArray(),
      db.records("livestock").toArray(),
      db.records("tasks").toArray(),
      db.records("inventory").toArray(),
      db.records("finance").toArray(),
    ]);
    const openTasks = tasks.filter((t) => t.status !== "Done");
    const overdue = openTasks.filter((t) => t.due && String(t.due) < today());
    const lowStock = inventory.filter((i) => i.reorderAt !== "" && i.reorderAt != null && Number(i.quantity) < Number(i.reorderAt));
    const month = today().slice(0, 7);
    const sum = (type: string) => money
      .filter((f) => f.type === type && String(f.date ?? "").startsWith(month))
      .reduce((a, f) => a + Number(f.amount || 0), 0);
    return {
      growing: crops.filter((c) => c.status === "Growing").length,
      animals: animals.filter((a) => a.status !== "Sold" && a.status !== "Deceased").length,
      openTasks: openTasks.length,
      overdue,
      lowStock,
      income: sum("Income"),
      expense: sum("Expense"),
      upcoming: openTasks.filter((t) => t.due).sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 5),
    };
  });

  if (!stats) return null;
  const net = stats.income - stats.expense;
  const loc = locale();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t("dashboard.greetingMorning") : hour < 18 ? t("dashboard.greetingAfternoon") : t("dashboard.greetingEvening");
  const dateLine = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  const netText = net.toLocaleString(loc, { signDisplay: "exceptZero", maximumFractionDigits: 2 });
  const shortDate = (s: unknown) => {
    const d = parseDay(String(s ?? ""));
    return d ? d.toLocaleDateString(loc, { day: "numeric", month: "short" }) : String(s ?? "");
  };
  const hasAttention = stats.overdue.length > 0 || stats.lowStock.length > 0;

  return (
    <div className="page dash">
      <header className="page-head">
        <h1 className="t-large">{greeting}</h1>
        <p className="page-sub dash-date">{dateLine}</p>
      </header>

      <section className="section" aria-label={t("dashboard.atAGlance")}>
        <div className="dash-stats">
          <Stat to="/track/crops" glyph={moduleGlyph("crops", "leaf")} color={moduleColor("crops", "var(--green)")}
            label={t("dashboard.cropsGrowing")} value={stats.growing.toLocaleString(loc)} />
          <Stat to="/track/livestock" glyph={moduleGlyph("livestock", "paw")} color={moduleColor("livestock", "var(--orange)")}
            label={t("dashboard.animals")} value={stats.animals.toLocaleString(loc)} />
          <Stat to="/track/tasks" glyph={moduleGlyph("tasks", "check")} color={moduleColor("tasks", "var(--blue)")}
            label={t("dashboard.openTasks")} value={stats.openTasks.toLocaleString(loc)} />
          <Stat to="/track/finance" glyph={moduleGlyph("finance", "money")} color={moduleColor("finance", "var(--teal)")}
            label={t("dashboard.netThisMonth")} value={netText} unit={t("dashboard.currency")}
            tone={net > 0 ? "pos" : net < 0 ? "neg" : undefined} />
        </div>
      </section>

      {hasAttention && (
        <section className="section">
          <h2 className="section-title">{t("dashboard.needsAttention")}</h2>
          <ul className="group">
            {stats.overdue.map((task) => (
              <li key={`t${task.id}`}>
                <Link to="/track/tasks" className="cell cell-link">
                  <span className="tile" style={tileStyle("var(--orange)")}><Icon name="clock" /></span>
                  <span className="cell-body">
                    <span className="cell-title">{String(task.title ?? t("common.untitled"))}</span>
                    <span className="cell-sub dash-sub-warn">{t("dashboard.overdueSub", { date: shortDate(task.due) })}</span>
                  </span>
                  <Icon name="chevron" className="chev" />
                </Link>
              </li>
            ))}
            {stats.lowStock.map((i) => (
              <li key={`i${i.id}`}>
                <Link to="/track/inventory" className="cell cell-link">
                  <span className="tile" style={tileStyle("var(--red)")}><Icon name="box" /></span>
                  <span className="cell-body">
                    <span className="cell-title">{String(i.item ?? t("common.untitled"))}</span>
                    <span className="cell-sub">
                      {t("dashboard.lowStockSub", { qty: num(i.quantity, loc), unit: String(i.unit ?? ""), min: num(i.reorderAt, loc) }).replace(/\s{2,}/g, " ")}
                    </span>
                  </span>
                  <Icon name="chevron" className="chev" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="dash-head">
          <h2 className="section-title">{t("dashboard.comingUp")}</h2>
          {stats.upcoming.length > 0 && <Link to="/track/tasks" className="dash-see-all">{t("dashboard.seeAll")}</Link>}
        </div>
        {stats.upcoming.length === 0 ? (
          <div className="group dash-empty">
            <div className="empty">
              <Icon name="calendar" />
              <h3>{t("dashboard.noScheduledTitle")}</h3>
              <p>{t("dashboard.noScheduledBody")}</p>
              <Link to="/track/tasks" className="btn-tinted btn-sm dash-empty-btn">
                <Icon name="plus" size={16} />{t("dashboard.addTask")}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="group">
            {stats.upcoming.map((task) => <UpcomingRow key={task.id} task={task} shortDate={shortDate} />)}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="group">
          <Link to="/assistant" className="cell cell-link dash-assist">
            <span className="tile" style={tileStyle("var(--purple)")}><Icon name="sparkles" /></span>
            <span className="cell-body">
              <span className="cell-title">{t("dashboard.assistantTitle")}</span>
              <span className="cell-sub">{t("dashboard.assistantSub")}</span>
            </span>
            <Icon name="chevron" className="chev" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function num(v: unknown, loc: string) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(loc) : String(v);
}

function UpcomingRow({ task, shortDate }: { task: FarmRecord; shortDate: (s: unknown) => string }) {
  const { t } = useI18n();
  const loc = locale();
  const d = parseDay(String(task.due ?? ""));
  const diff = d ? daysFromNow(d) : null;
  const when = diff == null ? String(task.due ?? "")
    : diff < 0 ? t("dashboard.overdueSub", { date: shortDate(task.due) })
    : diff === 0 ? t("dashboard.dueToday")
    : diff === 1 ? t("dashboard.dueTomorrow")
    : t("dashboard.dueInDays", { n: diff });
  const sub = [when, optionLabel(task.category)].filter(Boolean).join(" · ");
  const state = diff == null ? "" : diff < 0 ? "is-late" : diff === 0 ? "is-today" : "";
  return (
    <li>
      <Link to="/track/tasks" className="cell cell-link dash-up">
        <span className={`dash-cal ${state}`} aria-hidden="true">
          <span className="dash-cal-mon">{d ? d.toLocaleDateString(loc, { month: "short" }).replace(".", "") : ""}</span>
          <span className="dash-cal-day">{d ? d.getDate() : "–"}</span>
        </span>
        <span className="cell-body">
          <span className="cell-title">{String(task.title ?? t("common.untitled"))}</span>
          <span className={`cell-sub ${diff != null && diff < 0 ? "dash-sub-warn" : ""}`}>{sub}</span>
        </span>
        <Icon name="chevron" className="chev" />
      </Link>
    </li>
  );
}

function Stat({ to, glyph, color, label, value, unit, tone }: {
  to: string; glyph: IconName; color: string; label: string; value: string; unit?: string; tone?: "pos" | "neg";
}) {
  return (
    <Link to={to} className={`stat dash-stat${tone ? ` dash-stat-${tone}` : ""}${value.length > 6 ? " dash-stat-long" : ""}`}>
      <span className="dash-stat-top">
        <span className="tile" style={tileStyle(color)}><Icon name={glyph} /></span>
        <Icon name="chevron" className="dash-stat-chev" />
      </span>
      <span className="dash-stat-value">
        {unit && <span className="dash-stat-unit">{unit}</span>}
        <strong>{value}</strong>
      </span>
      <span className="dash-stat-label">{label}</span>
    </Link>
  );
}
