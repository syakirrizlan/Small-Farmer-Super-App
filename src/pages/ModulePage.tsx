import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { getModule } from "../db/modules";
import { db, type FarmRecord } from "../db/db";
import RecordForm from "../components/RecordForm";

export default function ModulePage() {
  const { moduleId = "" } = useParams();
  const module = getModule(moduleId);
  const [editing, setEditing] = useState<FarmRecord | "new" | null>(null);
  const [q, setQ] = useState("");
  const rows = useLiveQuery<FarmRecord[], FarmRecord[]>(
    () => (module ? db.records(module.id).orderBy("updatedAt").reverse().toArray() : []),
    [moduleId],
    [] as FarmRecord[],
  );

  if (!module) return <p>Unknown section. <Link to="/track">Back</Link></p>;

  const table = db.records(module.id);
  const filtered = q
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
    : rows;

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
    if (r.id != null && confirm("Delete this entry?")) await table.delete(r.id);
  };

  return (
    <>
      <Link to="/track" className="back">← All sections</Link>
      <h1>{module.icon} {module.title}</h1>

      {editing ? (
        <RecordForm module={module} initial={editing === "new" ? undefined : editing}
          onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <div className="row">
          <input className="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => setEditing("new")}>+ Add</button>
        </div>
      )}

      {filtered.length === 0 && !editing && <p className="muted">Nothing here yet. Tap “+ Add” to record your first entry.</p>}

      <ul className="list">
        {filtered.map((r) => (
          <li key={r.id} className="card item" style={{ borderLeftColor: module.color }}>
            <div onClick={() => setEditing(r)} role="button" tabIndex={0}>
              <strong>{String(r[module.titleField] || "(untitled)")}</strong>
              <small className="muted">
                {module.subtitleFields.map((k) => r[k]).filter((v) => v !== "" && v != null).join(" · ")}
              </small>
            </div>
            <button className="ghost danger" aria-label="Delete" onClick={() => remove(r)}>🗑</button>
          </li>
        ))}
      </ul>
    </>
  );
}
