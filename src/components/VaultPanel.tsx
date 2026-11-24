import { useEffect, useState, type FormEvent } from "react";
import { forgetKey, lock, onVaultChange, saveKey, unlock, vaultStatus } from "../lib/vault";

type Status = Awaited<ReturnType<typeof vaultStatus>>;

/** Save / unlock / lock / forget the user's Anthropic API key. */
export default function VaultPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const refresh = () => vaultStatus().then(setStatus);
  useEffect(() => { refresh(); return onVaultChange(refresh); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); setApiKey(""); setPass(""); setPass2(""); setReplacing(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (!status) return null;

  if (!status.saved || replacing) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (pass !== pass2) return setError("Passphrases don't match");
      run(() => saveKey(apiKey, pass));
    };
    return (
      <form className="card form" onSubmit={submit} autoComplete="off">
        <h3>🔑 Connect your AI key</h3>
        <p className="muted">Paste your Anthropic API key (from console.anthropic.com). It is encrypted on this device with your passphrase and is only sent to api.anthropic.com.</p>
        <label><span>API key</span>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" required spellCheck={false} />
        </label>
        <label><span>Passphrase (min 8 characters)</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={8} required autoComplete="new-password" />
        </label>
        <label><span>Repeat passphrase</span>
          <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={8} required autoComplete="new-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          {replacing && <button type="button" className="ghost" onClick={() => setReplacing(false)}>Cancel</button>}
          <button disabled={busy}>{busy ? "Encrypting…" : "Save securely"}</button>
        </div>
      </form>
    );
  }

  if (!status.unlocked) {
    return (
      <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => unlock(pass)); }}>
        <h3>🔒 Assistant locked</h3>
        <p className="muted">Key ending in <code>…{status.hint}</code>. Enter your passphrase to unlock for this session.</p>
        <label><span>Passphrase</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" className="ghost danger" onClick={() => confirm("Remove the saved key from this device?") && run(forgetKey)}>Forget key</button>
          <button disabled={busy}>{busy ? "Unlocking…" : "Unlock"}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="card row between">
      <span>🔓 Key <code>…{status.hint}</code> unlocked <small className="muted">(auto-locks after 15 min idle)</small></span>
      <span className="row">
        <button className="ghost" onClick={() => setReplacing(true)}>Replace</button>
        <button className="ghost" onClick={lock}>Lock</button>
      </span>
    </div>
  );
}
