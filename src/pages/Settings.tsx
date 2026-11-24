import { useState } from "react";
import { exportAll, importAll } from "../db/db";
import { KeyVault, ProviderPicker } from "../components/AiSetup";

export default function Settings() {
  const [msg, setMsg] = useState("");

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `farm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Backup downloaded.");
  };

  const doImport = async (file?: File) => {
    if (!file || !confirm("Importing replaces all current farm records. Continue?")) return;
    try { await importAll(JSON.parse(await file.text())); setMsg("Backup restored."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Import failed"); }
  };

  return (
    <>
      <h1>⚙️ Settings</h1>
      <h2>AI assistant</h2>
      <ProviderPicker />
      <KeyVault />

      <h2>Your data</h2>
      <div className="card">
        <p className="muted">All farm records are stored only on this device and work offline. Back them up regularly. (Backups never include your API keys.)</p>
        <div className="row">
          <button onClick={doExport}>Export backup</button>
          <label className="button ghost">Import backup
            <input type="file" accept="application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p>{msg}</p>}
      </div>

      <h2>About</h2>
      <div className="card"><p className="muted">Small Farmer Super App v0.1 — skeleton release. Installable as an app from your browser menu (“Add to Home screen”).</p></div>
    </>
  );
}
