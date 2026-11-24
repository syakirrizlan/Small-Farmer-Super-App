import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { MODULES } from "../db/modules";
import { db } from "../db/db";
import { useI18n } from "../i18n";
import { moduleDescription, moduleTitle } from "../i18n/labels";

export default function ModulesIndex() {
  const { t } = useI18n();
  const counts = useLiveQuery(() => Promise.all(MODULES.map((m) => db.records(m.id).count())), [], []);
  return (
    <>
      <h1>{t("track.title")}</h1>
      <div className="grid">
        {MODULES.map((m, i) => (
          <Link key={m.id} to={`/track/${m.id}`} className="tile" style={{ borderTopColor: m.color }}>
            <span className="tile-icon">{m.icon}</span>
            <strong>{moduleTitle(m)}</strong>
            <small>{moduleDescription(m)}</small>
            <span className="count">{counts[i] ?? 0}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
