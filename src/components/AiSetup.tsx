import { useState, type FormEvent } from "react";
import { PROVIDERS, getProvider } from "../lib/providers";
import { resolve, updateAiSettings } from "../lib/settings";
import { listModels } from "../lib/ai";
import {
  MIN_PASSPHRASE, createVault, lock, removeProviderKey, resetVault, setProviderKey, unlock,
} from "../lib/vault";
import { useAiSettings, useVaultStatus } from "../lib/useAi";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Choose an AI provider + model. */
export function ProviderPicker() {
  const settings = useAiSettings();
  const vault = useVaultStatus();
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!settings || !vault) return null;

  const { provider, model, baseURL } = resolve(settings);

  const pick = (id: string) => { setError(""); updateAiSettings({ activeProvider: id }); };
  const setModel = (m: string) => updateAiSettings({ models: { ...settings.models, [provider.id]: m } });

  const loadModels = async () => {
    setLoading(true); setError("");
    try { setModels((s) => ({ ...s, [provider.id]: [] })); const ids = await listModels(provider, baseURL); setModels((s) => ({ ...s, [provider.id]: ids })); }
    catch (e) { setError(errText(e)); }
    finally { setLoading(false); }
  };

  const options = [...new Set([...(models[provider.id] ?? []), ...provider.suggestedModels])];
  const canList = !provider.keyRequired || (vault.unlocked && !!vault.hints[provider.id]);

  return (
    <div className="card form">
      <h3>🧠 AI provider</h3>
      <p className="muted">Use whichever AI company you like. You can switch at any time; your farm records stay on this device.</p>
      <div className="providers" role="radiogroup" aria-label="AI provider">
        {PROVIDERS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === provider.id}
            className={`provider ${p.id === provider.id ? "active" : ""}`} onClick={() => pick(p.id)}>
            <strong>{p.name}</strong>
            <small>{vault.hints[p.id] ? `🔑 …${vault.hints[p.id]}` : p.keyRequired ? "No key yet" : "No key needed"}</small>
          </button>
        ))}
      </div>
      {provider.note && <p className="muted small">{provider.note}</p>}

      {provider.id === "custom" && (
        <label htmlFor="custom-url"><span>Server address (ends before /chat/completions)</span>
          <input id="custom-url" type="url" placeholder="https://example.com/v1" value={settings.customBaseURL}
            onChange={(e) => updateAiSettings({ customBaseURL: e.target.value })} />
        </label>
      )}

      <label htmlFor="model"><span>Model</span>
        <input id="model" list="model-options" value={settings.models[provider.id] ?? provider.defaultModel}
          placeholder="model name" spellCheck={false} onChange={(e) => setModel(e.target.value)} />
        <datalist id="model-options">{options.map((m) => <option key={m} value={m} />)}</datalist>
      </label>
      <div className="row">
        <button type="button" className="ghost" disabled={loading || !canList} onClick={loadModels}
          title={canList ? "" : "Unlock your key first"}>
          {loading ? "Loading…" : "Load available models"}
        </button>
        {models[provider.id]?.length ? <small className="muted">{models[provider.id].length} models found</small> : null}
      </div>
      {!model && <p className="error">Enter a model name.</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted small">Your questions and a summary of your farm records are sent to <b>{provider.name}</b>. Check their data policy if that matters to you.</p>
    </div>
  );
}

/** Create / unlock the vault, and add or remove the key for the active provider. */
export function KeyVault() {
  const settings = useAiSettings();
  const vault = useVaultStatus();
  const [apiKey, setApiKey] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!settings || !vault) return null;
  const provider = getProvider(settings.activeProvider) ?? PROVIDERS[0];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); setApiKey(""); setPass(""); setPass2(""); setConfirmReset(false); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  if (!vault.exists) {
    if (!provider.keyRequired) return null;
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (pass !== pass2) { setError("Passphrases don't match"); return; }
      if (!apiKey.trim()) { setError("Paste your API key"); return; }
      run(async () => { await createVault(pass); await setProviderKey(provider.id, apiKey); });
    };
    return (
      <form className="card form" onSubmit={submit} autoComplete="off">
        <h3>🔑 Save your {provider.name} key</h3>
        <p className="muted">
          Your keys are locked with a passphrase you choose and stored only on this device. One passphrase protects the keys for every provider.
          {provider.keyUrl && <> Get a key at <a href={provider.keyUrl} target="_blank" rel="noreferrer">{new URL(provider.keyUrl).host}</a>.</>}
        </p>
        <label htmlFor="new-key"><span>{provider.name} API key</span>
          <input id="new-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider.keyPlaceholder} required spellCheck={false} />
        </label>
        <label htmlFor="new-pass"><span>New passphrase (min {MIN_PASSPHRASE} characters)</span>
          <input id="new-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
        </label>
        <label htmlFor="new-pass2"><span>Repeat passphrase</span>
          <input id="new-pass2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row"><button disabled={busy}>{busy ? "Encrypting…" : "Save securely"}</button></div>
      </form>
    );
  }

  if (!vault.unlocked) {
    const saved = Object.keys(vault.hints).map((id) => getProvider(id)?.name ?? id);
    return (
      <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => unlock(pass)); }}>
        <h3>🔒 Keys locked</h3>
        <p className="muted">{saved.length ? `Saved keys: ${saved.join(", ")}.` : "No keys saved yet."} Enter your passphrase to unlock them for this session.</p>
        <label htmlFor="unlock-pass"><span>Passphrase</span>
          <input id="unlock-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button disabled={busy}>{busy ? "Unlocking…" : "Unlock"}</button>
          {!confirmReset
            ? <button type="button" className="ghost danger" onClick={() => setConfirmReset(true)}>Forgot passphrase?</button>
            : <button type="button" className="danger-solid" onClick={() => run(resetVault)}>Delete all saved keys</button>}
        </div>
        {confirmReset && <p className="muted small">Without the passphrase the keys can't be recovered. Deleting them lets you start again; your farm records are not affected.</p>}
      </form>
    );
  }

  const hint = vault.hints[provider.id];
  return (
    <form className="card form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(() => setProviderKey(provider.id, apiKey)); }}>
      <div className="row between">
        <h3>🔓 Keys unlocked</h3>
        <button type="button" className="ghost small" onClick={lock}>Lock</button>
      </div>
      <p className="muted small">Auto-locks after 15 minutes idle or when you close the app.</p>
      {hint ? (
        <div className="row between">
          <span>{provider.name}: <code>…{hint}</code></span>
          <button type="button" className="ghost danger small" onClick={() => run(() => removeProviderKey(provider.id))}>Remove</button>
        </div>
      ) : (
        <p>{provider.keyRequired ? `No ${provider.name} key yet.` : `${provider.name} doesn't need a key, but you can add one.`}
          {provider.keyUrl && <> Get one at <a href={provider.keyUrl} target="_blank" rel="noreferrer">{new URL(provider.keyUrl).host}</a>.</>}</p>
      )}
      <label htmlFor="provider-key"><span>{hint ? "Replace" : "Add"} {provider.name} key</span>
        <input id="provider-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider.keyPlaceholder} spellCheck={false} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row"><button disabled={busy || !apiKey.trim()}>{busy ? "Saving…" : "Save key"}</button></div>
    </form>
  );
}
