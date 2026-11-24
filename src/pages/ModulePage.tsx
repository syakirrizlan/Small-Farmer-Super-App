import "../styles/track.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { getModule } from "../db/modules";
import { db, type FarmRecord } from "../db/db";
import RecordForm from "../components/RecordForm";
import Icon from "../components/Icon";
import { useI18n } from "../i18n";
import { moduleTitle, unitLabel } from "../i18n/labels";
import { formatMoney, formatNumber } from "../lib/format";

export default function ModulePage() {
  const { moduleId = "" } = useParams();
  const { t, tOption, lang } = useI18n();
  const module = getModule(moduleId);
  const [editing, setEditing] = useState<FarmRecord | "new" | null>(null);
  const [q, setQ] = useState("");
  // Where focus/scroll returns when the editor closes: the edited row, or the + Add button.
  const returnTo = useRef<number | "add" | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const rows = useLiveQuery<FarmRecord[], FarmRecord[]>(
    () => (module ? db.records(module.id).orderBy("updatedAt").reverse().toArray() : []),
    [moduleId],
    [] as FarmRecord[],
  );

  useEffect(() => {
    if (editing || returnTo.current == null) return;
    const target = returnTo.current;
    returnTo.current = null;
    requestAnimationFrame(() => {
      const row = typeof target === "number"
        ? document.querySelector<HTMLElement>(`.track-row[data-id="${target}"] .track-row-main`)
        : null;
      const el = row ?? addRef.current;
      if (!el) return;
      if (row) el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: !!row });
    });
  }, [editing]);

  if (!module) {
    return (
      <div className="page track">
        <div className="empty">
          <Icon name="alert" />
          <h3>{t("track.unknownSection")}</h3>
          <Link to="/track" className="btn-plain">{t("common.back")}</Link>
        </div>
      </div>
    );
  }

  const table = db.records(module.id);
  const selectKeys = module.fields.filter((f) => f.type === "select").map((f) => f.key);
  const show = (k: string, v: unknown) => (selectKeys.includes(k) ? tOption(v) : String(v));
  // Search matches both the saved values and their translated labels.
  const haystack = (r: FarmRecord) =>
    (JSON.stringify(r) + " " + selectKeys.map((k) => tOption(r[k])).join(" ")).toLowerCase();
  const filtered = q ? rows.filter((r) => haystack(r).includes(q.toLowerCase())) : rows;

  // Display-only formatting for the subtitle line (stored values are untouched).
  const locale = lang === "ms" ? "ms-MY" : "en-GB";
  const fmtDate = (iso: string) => {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };
  const display = (k: string, v: unknown) => {
    const f = module.fields.find((x) => x.key === k);
    if (f?.type === "date" && typeof v === "string") return fmtDate(v);
    if (f?.type === "number" && v !== "" && Number.isFinite(Number(v))) {
      if (module.id === "finance" && k === "amount") return formatMoney(v);
      return f.unit ? `${formatNumber(v)} ${unitLabel(f.unit)}` : formatNumber(v);
    }
    return show(k, v);
  };

  const save = async (values: Record<string, unknown>) => {
    const now = Date.now();
    if (editing && editing !== "new" && editing.id != null) {
      await table.update(editing.id, { ...values, updatedAt: now });
    } else {
      await table.add({ ...values, createdAt: now, updatedAt: now });
    }
    setEditing(null);
  };

  const remove = async (r: FarmRecord) => {
    if (r.id == null || !confirm(t("track.confirmDelete"))) return;
    await table.delete(r.id);
    returnTo.current = "add";
    setEditing(null);
  };
  const open = (target: FarmRecord | "new") => {
    returnTo.current = target === "new" ? "add" : target.id ?? "add";
    setEditing(target);
  };

  const count = rows.length === 1 ? t("track.countOne") : t("track.countMany", { n: String(rows.length) });
  const tileStyle = { "--tile": module.color } as CSSProperties;

  return (
    <div className="page track">
      <Link to="/track" className="back-link track-back">
        <Icon name="chevronLeft" size={24} />
        {t("track.allSections")}
      </Link>

      <header className="page-head track-head">
        <span className="tile tile-lg" style={tileStyle}><Icon name={module.glyph} /></span>
        <h1 className="t-large">{moduleTitle(module)}</h1>
        <p className="page-sub num">{count}</p>
      </header>

      {editing ? (
        <RecordForm key={editing === "new" ? "new" : editing.id} module={module} initial={editing === "new" ? undefined : editing}
          onSave={save} onCancel={() => setEditing(null)}
          onDelete={editing === "new" ? undefined : () => remove(editing)} />
      ) : (
        <div className="track-toolbar">
          <label className="search-field track-search">
            <Icon name="search" />
            <span className="sr-only">{t("track.search")}</span>
            <input className="search" type="search" placeholder={t("track.search")} value={q}
              onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button type="button" className="track-clear" aria-label={t("common.cancel")} onClick={() => setQ("")}>
                <Icon name="xmark" size={14} />
              </button>
            )}
          </label>
          <button type="button" ref={addRef} className="btn btn-sm track-add" onClick={() => open("new")}>
            {t("track.add")}
          </button>
        </div>
      )}

      {filtered.length === 0 && !editing && (
        q ? (
          <div className="empty track-empty">
            <Icon name="search" />
            <h3>{t("track.noResultsTitle")}</h3>
            <p>{t("track.noResults", { q })}</p>
          </div>
        ) : (
          <div className="empty track-empty">
            <span className="tile track-empty-tile" style={tileStyle}><Icon name={module.glyph} /></span>
            <h3>{t("track.emptyTitle")}</h3>
            <p>{t("track.empty")}</p>
          </div>
        )
      )}

      {filtered.length > 0 && (
        <section className={`section track-list${editing ? " is-dimmed" : ""}`}>
          <h2 className="section-title">{t("track.entriesHeader")}</h2>
          <ul className="group">
            {filtered.map((r) => {
              const title = show(module.titleField, r[module.titleField]) || t("common.untitled");
              const sub = module.subtitleFields
                .filter((k) => r[k] !== "" && r[k] != null)
                .map((k) => display(k, r[k]))
                .join(" · ");
              const active = editing !== null && editing !== "new" && editing.id === r.id;
              return (
                <li key={r.id} data-id={r.id} className={`item track-row${active ? " is-active" : ""}`}>
                  <button type="button" className="cell cell-link track-row-main" onClick={() => open(r)}>
                    <span className="cell-body">
                      <span className="cell-title">{title}</span>
                      {sub && <span className="cell-sub">{sub}</span>}
                    </span>
                    <Icon name="chevron" className="chev" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
