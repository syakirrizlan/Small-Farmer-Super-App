import { LANGUAGES, useI18n } from "../i18n";

/** Compact EN | BM switch for the top bar. */
export default function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <span className="lang-toggle" role="group" aria-label={t("settings.language")}>
      {LANGUAGES.map((l) => (
        <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} title={l.label}
          className={lang === l.id ? "on" : ""} onClick={() => setLang(l.id)}>
          {l.short}
        </button>
      ))}
    </span>
  );
}
