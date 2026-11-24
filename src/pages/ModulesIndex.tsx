import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { MODULES } from "../db/modules";
import { db } from "../db/db";

export default function ModulesIndex() {
  const counts = useLiveQuery(() => Promise.all(MODULES.map((m) => db.records(m.id).count())), [], []);
  return (
    <>
      <h1>Track your farm</h1>
      <div className="grid">
        {MODULES.map((m, i) => (
          <Link key={m.id} to={`/track/${m.id}`} className="tile" style={{ borderTopColor: m.color }}>
            <span className="tile-icon">{m.icon}</span>
            <strong>{m.title}</strong>
            <small>{m.description}</small>
            <span className="count">{counts[i] ?? 0}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
