import { useState } from "react";
import { exportAll, importAll } from "../db/db";
import { KeyVault, ProviderPicker } from "../components/AiSetup";
import { LANGUAGES, useI18n } from "../i18n";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const [msg, setMsg] = useState("");

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `farm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(t("settings.backupDownloaded"));
  };

  const doImport = async (file?: File) => {
    if (!file || !confirm(t("settings.importConfirm"))) return;
    let json: unknown;
    try { json = JSON.parse(await file.text()); }
    catch { setMsg(t("settings.invalidBackup")); return; }
    try { await importAll(json as Parameters<typeof importAll>[0]); setMsg(t("settings.backupRestored")); }
    catch (e) { setMsg(e instanceof Error ? e.message : t("settings.importFailed")); }
  };

  return (
    <>
      <h1>{t("settings.title")}</h1>

      <h2>{t("settings.language")}</h2>
      <div className="card">
        <p className="muted">{t("settings.languageHelp")}</p>
        <div className="row" role="radiogroup" aria-label={t("settings.language")}>
          {LANGUAGES.map((l) => (
            <button key={l.id} type="button" role="radio" lang={l.id} aria-checked={lang === l.id}
              className={lang === l.id ? "" : "ghost"} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <h2>{t("settings.aiAssistant")}</h2>
      <ProviderPicker />
      <KeyVault />

      <h2>{t("settings.yourData")}</h2>
      <div className="card">
        <p className="muted">{t("settings.dataHelp")}</p>
        <div className="row">
          <button onClick={doExport}>{t("settings.exportBackup")}</button>
          <label className="button ghost">{t("settings.importBackup")}
            <input type="file" accept="application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p>{msg}</p>}
      </div>

      <h2>{t("settings.about")}</h2>
      <div className="card"><p className="muted">{t("settings.aboutText")}</p></div>
    </>
  );
}
