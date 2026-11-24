import "../styles/track.css";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { MODULES } from "../db/modules";
import { db } from "../db/db";
import { useI18n } from "../i18n";
import { moduleDescription, moduleTitle } from "../i18n/labels";
import Icon from "../components/Icon";

export default function ModulesIndex() {
  const { t } = useI18n();
  const counts = useLiveQuery(() => Promise.all(MODULES.map((m) => db.records(m.id).count())), [], []);
  return (
    <div className="page track">
      <header className="page-head">
        <h1 className="t-large">{t("track.title")}</h1>
        <p className="page-sub">{t("track.subtitle")}</p>
      </header>

      <section className="section">
        <h2 className="section-title">{t("track.sectionsHeader")}</h2>
        <ul className="group track-modules">
          {MODULES.map((m, i) => (
            <li key={m.id}>
              <Link to={`/track/${m.id}`} className="cell cell-link track-module">
                <span className="tile" style={{ "--tile": m.color } as CSSProperties}>
                  <Icon name={m.glyph} />
                </span>
                <span className="cell-body">
                  <span className="cell-title">{moduleTitle(m)}</span>
                  <span className="cell-sub">{moduleDescription(m)}</span>
                </span>
                <span className="cell-value num track-count">{counts[i] ?? 0}</span>
                <Icon name="chevron" className="chev" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="section-foot">{t("track.sectionsFoot")}</p>
      </section>
    </div>
  );
}
