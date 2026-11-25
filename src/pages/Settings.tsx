import { useState, type CSSProperties } from "react";
import Icon from "../components/Icon";
import "../styles/settings.css";
import { InvalidBackupError, exportAll, importAll } from "../db/db";
import { KeyVault, PassphraseLock, ProviderPicker } from "../components/AiSetup";
import { InstallCard } from "../components/InstallButton";
import { LANGUAGES, useI18n, type TKey } from "../i18n";

const tile = (color: string) => ({ "--tile": color }) as CSSProperties;

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  // Store the message key (not translated text) so it follows language changes.
  const [msg, setMsg] = useState<{ key: TKey; detail?: string } | null>(null);

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `farm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ key: "settings.backupDownloaded" });
  };

  const doImport = async (file?: File) => {
    if (!file || !confirm(t("settings.importConfirm"))) return;
    let json: unknown;
    try { json = JSON.parse(await file.text()); }
    catch { setMsg({ key: "settings.invalidBackup" }); return; }
    try { await importAll(json as Parameters<typeof importAll>[0]); setMsg({ key: "settings.backupRestored" }); }
    catch (e) {
      if (e instanceof InvalidBackupError) setMsg({ key: "settings.invalidBackup" });
      else setMsg({ key: "settings.importFailed", detail: e instanceof Error ? `${e.name}: ${e.message}` : undefined });
    }
  };

  return (
    <div className="page set-page">
      <header className="page-head">
        <h1 className="t-large">{t("settings.title")}</h1>
      </header>

      <section className="section">
        <h2 className="section-title">{t("install.title")}</h2>
        <InstallCard />
      </section>

      <section className="section">
        <h2 className="section-title" id="set-lang-title">{t("settings.language")}</h2>
        <div className="group set-lang">
          <div className="segmented block" role="radiogroup" aria-labelledby="set-lang-title">
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" role="radio" lang={l.id} aria-checked={lang === l.id}
                onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <p className="section-foot">{t("settings.languageHelp")}</p>
      </section>

      <ProviderPicker />

      <section className="section">
        <h2 className="section-title">{t("settings.apiKeys")}</h2>
        <KeyVault />
      </section>

      <PassphraseLock />

      <section className="section">
        <h2 className="section-title">{t("settings.yourData")}</h2>
        <ul className="group">
          <li>
            <button type="button" className="cell cell-link" onClick={doExport}>
              <span className="tile" style={tile("var(--blue)")}><Icon name="upload" /></span>
              <span className="cell-body"><span className="cell-title">{t("settings.exportBackup")}</span></span>
              <Icon name="chevron" className="chev" />
            </button>
          </li>
          <li>
            <label className="cell cell-link set-file" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.querySelector("input")?.click(); } }}>
              <span className="tile" style={tile("var(--indigo)")}><Icon name="download" /></span>
              <span className="cell-body"><span className="cell-title">{t("settings.importBackup")}</span></span>
              <Icon name="chevron" className="chev" />
              <input type="file" accept="application/json" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </li>
        </ul>
        {msg && (
          <p className={`section-foot set-status ${msg.key === "settings.backupDownloaded" || msg.key === "settings.backupRestored" ? "ok" : "set-error"}`} role="status">
            {t(msg.key)}{msg.detail && <span className="muted"> ({msg.detail})</span>}
          </p>
        )}
        <p className="section-foot">{t("settings.dataHelp")}</p>
      </section>

      <section className="section">
        <h2 className="section-title">{t("settings.about")}</h2>
        <ul className="group">
          <li className="cell">
            <img className="app-mark sm" src="/icons/icon.svg" alt="" width={30} height={30} />
            <span className="cell-body">
              <span className="cell-title">{t("app.brand")}</span>
              <span className="cell-sub">{t("app.tagline")}</span>
            </span>
          </li>
          <li className="cell">
            <span className="cell-body"><span className="cell-title">{t("settings.version")}</span></span>
            <span className="cell-value num">{t("settings.versionValue")}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
