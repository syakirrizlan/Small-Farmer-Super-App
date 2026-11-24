import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { PROVIDERS, getProvider, type ProviderDef } from "../lib/providers";
import { resolve, setProviderModel, updateAiSettings, type AiSettings } from "../lib/settings";
import { listModels } from "../lib/ai";
import {
  MIN_PASSPHRASE, createVault, lock, removeProviderKey, resetVault, setProviderKey, unlock, type VaultStatus,
} from "../lib/vault";
import { useAiSettings, useVaultStatus } from "../lib/useAi";
import { t, useI18n } from "../i18n";
import { providerKeyPlaceholder, providerName, providerNote } from "../i18n/labels";
import Icon, { type IconName } from "./Icon";
import "../styles/settings.css";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const tileStyle = (color: string) => ({ "--tile": color }) as CSSProperties;

/** Neutral tile colours, assigned by position so neighbouring providers never share one. */
const PROVIDER_TILES = ["var(--brown)", "var(--blue)", "var(--teal)", "var(--indigo)", "var(--purple)", "var(--orange)", "var(--red)", "var(--green)"];

function ProviderTile({ p, index }: { p: ProviderDef; index: number }) {
  if (p.id === "custom") return <span className="tile" style={tileStyle("var(--label-2)")}><Icon name="cpu" /></span>;
  return (
    <span className="tile set-initial" style={tileStyle(PROVIDER_TILES[index % PROVIDER_TILES.length])} aria-hidden="true">
      {providerName(p).trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Status row used by the key vault: icon tile, title, subtitle, optional trailing control. */
function StatusCell({ icon, color, title, sub, children }: { icon: IconName; color: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <li className="cell set-status-cell">
      <span className="tile" style={tileStyle(color)}><Icon name={icon} /></span>
      <span className="cell-body">
        <span className="cell-title">{title}</span>
        {sub && <span className="cell-sub">{sub}</span>}
      </span>
      {children}
    </li>
  );
}

/** Choose an AI provider + model. */
export function ProviderPicker() {
  const { t } = useI18n();
  const settings = useAiSettings();
  const vault = useVaultStatus();
  if (!settings || !vault) return null;
  const { provider } = resolve(settings);

  return (
    <>
      <section className="section">
        <h2 className="section-title" id="set-provider-title">{t("ai.providerTitle")}</h2>
        <ul className="group set-providers" role="radiogroup" aria-label={t("ai.providerGroup")}>
          {PROVIDERS.map((p, i) => {
            const active = p.id === provider.id;
            const hint = vault.hints[p.id];
            return (
              <li key={p.id}>
                <button type="button" role="radio" aria-checked={active}
                  className={`cell cell-link provider ${active ? "active" : ""}`} onClick={() => updateAiSettings({ activeProvider: p.id })}>
                  <ProviderTile p={p} index={i} />
                  <span className="cell-body">
                    <strong className="cell-title">{providerName(p)}</strong>
                    <small className="cell-sub set-key-status">
                      {hint
                        ? <><Icon name="key" size={14} aria-hidden="true" /><span className="set-mono">…{hint}</span></>
                        : p.keyRequired ? t("ai.noKeyYet") : t("ai.noKeyNeeded")}
                    </small>
                  </span>
                  <Icon name="checkmark" className="set-check" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="section-foot">{t("ai.providerHelp")}</p>
      </section>
      {/* Keyed by provider so typed drafts and errors never carry over to another provider. */}
      <ProviderDetails key={provider.id} settings={settings} vault={vault} />
    </>
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
    <section className="section">
      <h2 className="section-title">{t("ai.modelTitle")}</h2>
      {note && <p className="section-foot set-note">{note}</p>}
      <div className="group">
        {provider.id === "custom" && (
          <label className="field" htmlFor="custom-url"><span className="field-label">{t("ai.serverAddress")}</span>
            <input id="custom-url" className="field-input" type="url" placeholder="https://example.com/v1" value={urlDraft} spellCheck={false}
              onChange={(e) => { setUrlDraft(e.target.value); updateAiSettings({ customBaseURL: e.target.value }); }} />
            {urlDraft && urlWarning && <small className="field-hint error">{urlWarning}</small>}
          </label>
        )}
        <label className="field" htmlFor="model"><span className="field-label">{t("ai.model")}</span>
          <input id="model" className="field-input set-mono-input" list="model-options" value={modelDraft} spellCheck={false}
            autoCapitalize="off" autoCorrect="off"
            placeholder={provider.defaultModel ? t("ai.modelDefault", { model: provider.defaultModel }) : t("ai.modelName")}
            onChange={(e) => { setModelDraft(e.target.value); setProviderModel(provider.id, e.target.value); }} />
          <datalist id="model-options">{options.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <button type="button" className="cell cell-link set-action" disabled={loading || !canList} onClick={loadModels}
          title={canList ? "" : baseURL ? t("ai.unlockFirst") : t("ai.enterAddressFirst")}>
          <span className="cell-body"><span className="cell-title">{loading ? t("ai.loadingModels") : t("ai.loadModels")}</span></span>
          {loading
            ? <span className="set-spinner" aria-hidden="true" />
            : models.length > 0 && <span className="cell-value num">{t("ai.modelsFound", { count: models.length })}</span>}
        </button>
      </div>
      {!model && <p className="section-foot set-error" role="alert">{t("ai.enterModel")}</p>}
      {error && <p className="section-foot set-error" role="alert">{error}</p>}
      {!canList && !loading && <p className="section-foot">{baseURL ? t("ai.unlockFirst") : t("ai.enterAddressFirst")}.</p>}
      <p className="section-foot">
        {t("ai.dataNotice", { provider: providerName(provider), model: model ? t("ai.dataNoticeModel", { model }) : "" })}
      </p>
    </section>
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
        <div className="set-vault">
          <ul className="group">
            <StatusCell icon="checkmark" color="var(--green)" title={t("ai.worksWithoutKey", { provider: name })} />
            <li>
              <button type="button" className="cell cell-link set-action" onClick={() => setOptIn(true)}>
                <span className="cell-body"><span className="cell-title">{t("ai.serverNeedsKey")}</span></span>
                <Icon name="chevron" className="chev" />
              </button>
            </li>
          </ul>
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
      <form className="set-vault" onSubmit={submit} autoComplete="off">
        <div className="group">
          <ul className="set-flat">
            <StatusCell icon="key" color="var(--orange)" title={<strong className="set-strong">{t("ai.saveKeyTitle", { provider: name })}</strong>} />
          </ul>
          <label className="field" htmlFor="new-key"><span className="field-label">{t("ai.apiKeyLabel", { provider: name })}</span>
            <input id="new-key" className="field-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerKeyPlaceholder(provider)} required spellCheck={false} />
          </label>
          <label className="field" htmlFor="new-pass"><span className="field-label">{t("ai.newPassphrase", { min: MIN_PASSPHRASE })}</span>
            <input id="new-pass" className="field-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
          </label>
          <label className="field" htmlFor="new-pass2"><span className="field-label">{t("ai.repeatPassphrase")}</span>
            <input id="new-pass2" className="field-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
          </label>
        </div>
        <p className="section-foot">{t("ai.vaultHelp")}<KeyLink url={provider.keyUrl} label={t("ai.getKeyAt")} /></p>
        {error && <p className="section-foot set-error" role="alert">{error}</p>}
        <button className="btn btn-block set-primary" disabled={busy}>
          <Icon name="lock" size={20} aria-hidden="true" />{busy ? t("ai.encrypting") : t("ai.saveSecurely")}
        </button>
      </form>
    );
  }

  if (!vault.unlocked) {
    const saved = Object.keys(vault.hints).map((id) => { const p = getProvider(id); return p ? providerName(p) : id; });
    return (
      <form className="set-vault" onSubmit={(e) => { e.preventDefault(); run(() => unlock(pass)); }}>
        <div className="group">
          <ul className="set-flat">
            <StatusCell icon="lock" color="var(--blue)" title={<strong className="set-strong">{t("ai.keysLocked")}</strong>}
              sub={saved.length ? t("ai.savedKeys", { list: saved.join(", ") }) : t("ai.noKeysSaved")} />
          </ul>
          <label className="field" htmlFor="unlock-pass"><span className="field-label">{t("ai.passphrase")}</span>
            <input id="unlock-pass" className="field-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
          </label>
        </div>
        <p className="section-foot">{t("ai.unlockHelp")}</p>
        {error && <p className="section-foot set-error" role="alert">{error}</p>}
        <button className="btn btn-block set-primary" disabled={busy}>
          <Icon name="unlock" size={20} aria-hidden="true" />{busy ? t("ai.unlocking") : t("ai.unlock")}
        </button>
        {!confirmReset
          ? <button type="button" className="btn-plain btn-destructive set-forgot" disabled={busy} onClick={() => setConfirmReset(true)}>{t("ai.forgotPassphrase")}</button>
          : (
            <div className="set-reset" role="alertdialog" aria-labelledby="set-reset-text">
              <p id="set-reset-text" className="set-reset-text">{t("ai.resetHelp")}</p>
              <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={() => run(resetVault)}>
                <Icon name="trash" size={20} aria-hidden="true" />{t("ai.deleteAllKeys")}
              </button>
              <button type="button" className="btn-plain set-forgot" disabled={busy} onClick={() => setConfirmReset(false)}>{t("common.cancel")}</button>
            </div>
          )}
      </form>
    );
  }

  const hint = vault.hints[provider.id];
  return (
    <form className="set-vault" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(() => setProviderKey(provider.id, apiKey)); }}>
      <ul className="group">
        <StatusCell icon="unlock" color="var(--green)" title={<strong className="set-strong">{t("ai.keysUnlocked")}</strong>} sub={t("ai.autoLock")}>
          <button type="button" className="btn-plain set-trailing" onClick={lock}>{t("ai.lock")}</button>
        </StatusCell>
        {hint && (
          <StatusCell icon="key" color="var(--orange)" title={name} sub={<span className="set-mono">…{hint}</span>}>
            <button type="button" className="btn-plain btn-destructive set-trailing" disabled={busy} onClick={() => run(() => removeProviderKey(provider.id))}>{t("ai.remove")}</button>
          </StatusCell>
        )}
      </ul>
      {!hint && (
        <p className="section-foot">{provider.keyRequired ? t("ai.noProviderKey", { provider: name }) : t("ai.optionalKey", { provider: name })}
          <KeyLink url={provider.keyUrl} label={t("ai.getOneAt")} /></p>
      )}
      <div className="group set-gap">
        <label className="field" htmlFor="provider-key"><span className="field-label">{t(hint ? "ai.replaceKey" : "ai.addKey", { provider: name })}</span>
          <input id="provider-key" className="field-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerKeyPlaceholder(provider)} spellCheck={false} />
        </label>
      </div>
      {error && <p className="section-foot set-error" role="alert">{error}</p>}
      <button className="btn btn-block set-primary" disabled={busy || !apiKey.trim()}>{busy ? t("ai.saving") : t("ai.saveKey")}</button>
    </form>
  );
}
