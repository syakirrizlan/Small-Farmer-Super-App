import { useState, type FormEvent } from "react";
import { PROVIDERS, getProvider } from "../lib/providers";
import { resolve, setProviderModel, updateAiSettings, type AiSettings } from "../lib/settings";
import { listModels } from "../lib/ai";
import {
  MIN_PASSPHRASE, createVault, lock, removeProviderKey, resetVault, setProviderKey, unlock, type VaultStatus,
} from "../lib/vault";
import { useAiSettings, useVaultStatus } from "../lib/useAi";
import { t, useI18n } from "../i18n";
import { providerKeyPlaceholder, providerName, providerNote } from "../i18n/labels";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Choose an AI provider + model. */
export function ProviderPicker() {
  const { t } = useI18n();
  const settings = useAiSettings();
  const vault = useVaultStatus();
  if (!settings || !vault) return null;
  const { provider } = resolve(settings);

  return (
    <div className="card form">
      <h3>{t("ai.providerTitle")}</h3>
      <p className="muted">{t("ai.providerHelp")}</p>
      <div className="providers" role="radiogroup" aria-label={t("ai.providerGroup")}>
        {PROVIDERS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === provider.id}
            className={`provider ${p.id === provider.id ? "active" : ""}`} onClick={() => updateAiSettings({ activeProvider: p.id })}>
            <strong>{providerName(p)}</strong>
            <small>{vault.hints[p.id] ? `🔑 …${vault.hints[p.id]}` : p.keyRequired ? t("ai.noKeyYet") : t("ai.noKeyNeeded")}</small>
          </button>
        ))}
      </div>
      {/* Keyed by provider so typed drafts and errors never carry over to another provider. */}
      <ProviderDetails key={provider.id} settings={settings} vault={vault} />
    </div>
  );
}

function ProviderDetails({ settings, vault }: { settings: AiSettings; vault: VaultStatus }) {
  const { t, lang } = useI18n();
  const { provider, model, baseURL } = resolve(settings);
  // Inputs render from local drafts (not from IndexedDB) so typing is never interrupted.
  const [modelDraft, setModelDraft] = useState(settings.models[provider.id] ?? "");
  const [urlDraft, setUrlDraft] = useState(settings.customBaseURL);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) { setPrevLang(lang); setError(""); }

  const loadModels = async () => {
    setLoading(true); setError("");
    try { setModels(await listModels(provider, baseURL)); }
    catch (e) { setError(errText(e)); }
    finally { setLoading(false); }
  };

  const options = [...new Set([...models, ...provider.suggestedModels])];
  const canList = !!baseURL && (!provider.keyRequired || (vault.unlocked && !!vault.hints[provider.id]));
  const urlWarning = urlProblem(urlDraft);
  const note = providerNote(provider);

  return (
    <>
      {note && <p className="muted small">{note}</p>}

      {provider.id === "custom" && (
        <label htmlFor="custom-url"><span>{t("ai.serverAddress")}</span>
          <input id="custom-url" type="url" placeholder="https://example.com/v1" value={urlDraft} spellCheck={false}
            onChange={(e) => { setUrlDraft(e.target.value); updateAiSettings({ customBaseURL: e.target.value }); }} />
          {urlDraft && urlWarning && <small className="error">{urlWarning}</small>}
        </label>
      )}

      <label htmlFor="model"><span>{t("ai.model")}</span>
        <input id="model" list="model-options" value={modelDraft} spellCheck={false}
          placeholder={provider.defaultModel ? t("ai.modelDefault", { model: provider.defaultModel }) : t("ai.modelName")}
          onChange={(e) => { setModelDraft(e.target.value); setProviderModel(provider.id, e.target.value); }} />
        <datalist id="model-options">{options.map((m) => <option key={m} value={m} />)}</datalist>
      </label>
      <div className="row">
        <button type="button" className="ghost" disabled={loading || !canList} onClick={loadModels}
          title={canList ? "" : baseURL ? t("ai.unlockFirst") : t("ai.enterAddressFirst")}>
          {loading ? t("ai.loadingModels") : t("ai.loadModels")}
        </button>
        {models.length > 0 && <small className="muted">{t("ai.modelsFound", { count: models.length })}</small>}
      </div>
      {!model && <p className="error">{t("ai.enterModel")}</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted small">
        {t("ai.dataNotice", { provider: providerName(provider), model: model ? t("ai.dataNoticeModel", { model }) : "" })}
      </p>
    </>
  );
}

/** Mirrors the CSP connect-src in index.html: any https server, or http on this computer. */
function urlProblem(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return t("ai.urlFull"); }
  if (u.protocol === "https:") return null;
  if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return null;
  return t("ai.urlHttps");
}

function KeyLink({ url, label }: { url?: string; label: string }) {
  if (!url) return null;
  return <> {label} <a href={url} target="_blank" rel="noreferrer">{new URL(url).host}</a>.</>;
}

/** Create / unlock the vault, and add or remove the key for the active provider. */
export function KeyVault() {
  const { t, lang } = useI18n();
  const settings = useAiSettings();
  const vault = useVaultStatus();
  const [apiKey, setApiKey] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [optIn, setOptIn] = useState(false);
  // Clear a typed key / error when the provider changes so it can't be saved under the wrong one.
  const pid = settings?.activeProvider;
  const [prevPid, setPrevPid] = useState(pid);
  if (pid !== prevPid) { setPrevPid(pid); setApiKey(""); setError(""); setConfirmReset(false); setOptIn(false); }
  // Messages are translated when shown, so drop them when the language changes.
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) { setPrevLang(lang); setError(""); }
  if (!settings || !vault) return null;
  const provider = getProvider(settings.activeProvider) ?? PROVIDERS[0];
  const name = providerName(provider);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); setApiKey(""); setPass(""); setPass2(""); setConfirmReset(false); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  if (!vault.exists) {
    if (!provider.keyRequired && !optIn) {
      return (
        <div className="card row between">
          <span className="muted">{t("ai.worksWithoutKey", { provider: name })}</span>
          <button type="button" className="ghost small" onClick={() => setOptIn(true)}>{t("ai.serverNeedsKey")}</button>
        </div>
      );
    }
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (pass !== pass2) { setError(t("ai.passphrasesDontMatch")); return; }
      if (!apiKey.trim()) { setError(t("ai.pasteKey")); return; }
      run(async () => { await createVault(pass); await setProviderKey(provider.id, apiKey); });
    };
    return (
      <form className="card form" onSubmit={submit} autoComplete="off">
        <h3>{t("ai.saveKeyTitle", { provider: name })}</h3>
        <p className="muted">{t("ai.vaultHelp")}<KeyLink url={provider.keyUrl} label={t("ai.getKeyAt")} /></p>
        <label htmlFor="new-key"><span>{t("ai.apiKeyLabel", { provider: name })}</span>
          <input id="new-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerKeyPlaceholder(provider)} required spellCheck={false} />
        </label>
        <label htmlFor="new-pass"><span>{t("ai.newPassphrase", { min: MIN_PASSPHRASE })}</span>
          <input id="new-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
        </label>
        <label htmlFor="new-pass2"><span>{t("ai.repeatPassphrase")}</span>
          <input id="new-pass2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row"><button disabled={busy}>{busy ? t("ai.encrypting") : t("ai.saveSecurely")}</button></div>
      </form>
    );
  }

  if (!vault.unlocked) {
    const saved = Object.keys(vault.hints).map((id) => { const p = getProvider(id); return p ? providerName(p) : id; });
    return (
      <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => unlock(pass)); }}>
        <h3>{t("ai.keysLocked")}</h3>
        <p className="muted">{saved.length ? t("ai.savedKeys", { list: saved.join(", ") }) : t("ai.noKeysSaved")} {t("ai.unlockHelp")}</p>
        <label htmlFor="unlock-pass"><span>{t("ai.passphrase")}</span>
          <input id="unlock-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button disabled={busy}>{busy ? t("ai.unlocking") : t("ai.unlock")}</button>
          {!confirmReset
            ? <button type="button" className="ghost danger" disabled={busy} onClick={() => setConfirmReset(true)}>{t("ai.forgotPassphrase")}</button>
            : <button type="button" className="danger-solid" disabled={busy} onClick={() => run(resetVault)}>{t("ai.deleteAllKeys")}</button>}
        </div>
        {confirmReset && <p className="muted small">{t("ai.resetHelp")}</p>}
      </form>
    );
  }

  const hint = vault.hints[provider.id];
  return (
    <form className="card form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(() => setProviderKey(provider.id, apiKey)); }}>
      <div className="row between">
        <h3>{t("ai.keysUnlocked")}</h3>
        <button type="button" className="ghost small" onClick={lock}>{t("ai.lock")}</button>
      </div>
      <p className="muted small">{t("ai.autoLock")}</p>
      {hint ? (
        <div className="row between">
          <span>{name}: <code>…{hint}</code></span>
          <button type="button" className="ghost danger small" disabled={busy} onClick={() => run(() => removeProviderKey(provider.id))}>{t("ai.remove")}</button>
        </div>
      ) : (
        <p>{provider.keyRequired ? t("ai.noProviderKey", { provider: name }) : t("ai.optionalKey", { provider: name })}
          <KeyLink url={provider.keyUrl} label={t("ai.getOneAt")} /></p>
      )}
      <label htmlFor="provider-key"><span>{t(hint ? "ai.replaceKey" : "ai.addKey", { provider: name })}</span>
        <input id="provider-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerKeyPlaceholder(provider)} spellCheck={false} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row"><button disabled={busy || !apiKey.trim()}>{busy ? t("ai.saving") : t("ai.saveKey")}</button></div>
    </form>
  );
}
