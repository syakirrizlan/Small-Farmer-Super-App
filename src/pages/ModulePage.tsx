import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { getModule } from "../db/modules";
import { db, type FarmRecord } from "../db/db";
import RecordForm from "../components/RecordForm";
import { useI18n } from "../i18n";
import { moduleTitle } from "../i18n/labels";

export default function ModulePage() {
  const { moduleId = "" } = useParams();
  const { t, tOption } = useI18n();
  const module = getModule(moduleId);
  const [editing, setEditing] = useState<FarmRecord | "new" | null>(null);
  const [q, setQ] = useState("");
  const rows = useLiveQuery<FarmRecord[], FarmRecord[]>(
    () => (module ? db.records(module.id).orderBy("updatedAt").reverse().toArray() : []),
    [moduleId],
    [] as FarmRecord[],
  );

  if (!module) return <p>{t("track.unknownSection")} <Link to="/track">{t("common.back")}</Link></p>;

  const table = db.records(module.id);
  const selectKeys = module.fields.filter((f) => f.type === "select").map((f) => f.key);
  const show = (k: string, v: unknown) => (selectKeys.includes(k) ? tOption(v) : String(v));
  // Search matches both the saved values and their translated labels.
  const haystack = (r: FarmRecord) =>
    (JSON.stringify(r) + " " + selectKeys.map((k) => tOption(r[k])).join(" ")).toLowerCase();
  const filtered = q ? rows.filter((r) => haystack(r).includes(q.toLowerCase())) : rows;

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
    if (r.id != null && confirm(t("track.confirmDelete"))) await table.delete(r.id);
  };

  return (
    <>
      <Link to="/track" className="back">{t("track.allSections")}</Link>
      <h1>{module.icon} {moduleTitle(module)}</h1>

      {editing ? (
        <RecordForm module={module} initial={editing === "new" ? undefined : editing}
          onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <div className="row">
          <input className="search" placeholder={t("track.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => setEditing("new")}>{t("track.add")}</button>
        </div>
      )}

      {filtered.length === 0 && !editing && <p className="muted">{t("track.empty")}</p>}

      <ul className="list">
        {filtered.map((r) => (
          <li key={r.id} className="card item" style={{ borderLeftColor: module.color }}>
            <div onClick={() => setEditing(r)} role="button" tabIndex={0}>
              <strong>{show(module.titleField, r[module.titleField]) || t("common.untitled")}</strong>
              <small className="muted">
                {module.subtitleFields.filter((k) => r[k] !== "" && r[k] != null).map((k) => show(k, r[k])).join(" · ")}
              </small>
            </div>
            <button className="ghost danger" aria-label={t("common.delete")} onClick={() => remove(r)}>🗑</button>
          </li>
        ))}
      </ul>
    </>
  );
}
