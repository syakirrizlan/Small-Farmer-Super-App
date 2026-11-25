import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { PROVIDERS, getProvider, type ProviderDef } from "../lib/providers";
import { resolve, setProviderModel, updateAiSettings, type AiSettings } from "../lib/settings";
import { listModels } from "../lib/ai";
import {
  MIN_PASSPHRASE, disablePassphrase, enablePassphrase, lock, removeProviderKey, resetVault, setProviderKey, unlock, type VaultStatus,
} from "../lib/vault";
import { useAiSettings, useVaultStatus } from "../lib/useAi";
import { t, useI18n } from "../i18n";
import { providerKeyPlaceholder, providerName, providerNote } from "../i18n/labels";
import Icon, { type IconName } from "./Icon";
import "../styles/settings.css";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const tileStyle = (color: string) => ({ "--tile": color }) as CSSProperties;

/** Neutral tile colours, assigned by position so neighbouring providers never share one. */
/* Only hues that stay dark enough for a white initial; settings.css darkens them further. */
const PROVIDER_TILES = ["var(--brown)", "var(--blue)", "var(--indigo)", "var(--red)", "var(--purple)"];

function ProviderTile({ p, index }: { p: ProviderDef; index: number }) {
  if (p.id === "custom") return <span className="tile set-custom-tile" aria-hidden="true"><Icon name="cpu" /></span>;
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
  const blocked = !baseURL ? t("ai.enterAddressFirst") : !vault.hints[provider.id] ? t("ai.addKeyFirst") : t("ai.unlockFirst");

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
            placeholder={t("ai.modelName")} aria-describedby={!modelDraft && provider.defaultModel ? "model-default" : undefined}
            onChange={(e) => { setModelDraft(e.target.value); setProviderModel(provider.id, e.target.value); }} />
          {!modelDraft && provider.defaultModel && (
            <small id="model-default" className="field-hint">{t("ai.modelDefault", { model: provider.defaultModel })}</small>
          )}
          <datalist id="model-options">{options.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <button type="button" className="cell cell-link set-action" disabled={loading || !canList} onClick={loadModels}
          title={canList ? "" : blocked}>
          <span className="cell-body"><span className="cell-title">{loading ? t("ai.loadingModels") : t("ai.loadModels")}</span></span>
          {loading
            ? <span className="set-spinner" aria-hidden="true" />
            : models.length > 0 && <span className="cell-value num">{t("ai.modelsFound", { count: models.length })}</span>}
        </button>
      </div>
      {!model && <p className="section-foot set-error" role="alert">{t("ai.enterModel")}</p>}
      {error && <p className="section-foot set-error" role="alert">{error}</p>}
      {!canList && !loading && <p className="section-foot">{blocked}</p>}
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

/** Add, replace or remove the key for the active provider (and unlock, if a passphrase lock is on). */
export function KeyVault() {
  const { t, lang } = useI18n();
  const settings = useAiSettings();
  const vault = useVaultStatus();
  const [apiKey, setApiKey] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Clear a typed key / error when the provider changes so it can't be saved under the wrong one.
  const pid = settings?.activeProvider;
  const [prevPid, setPrevPid] = useState(pid);
  if (pid !== prevPid) { setPrevPid(pid); setApiKey(""); setError(""); setConfirmReset(false); }
  // Messages are translated when shown, so drop them when the language changes.
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) { setPrevLang(lang); setError(""); }
  if (!settings || !vault) return null;
  const provider = getProvider(settings.activeProvider) ?? PROVIDERS[0];
  const name = providerName(provider);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); setApiKey(""); setPass(""); setConfirmReset(false); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  // Passphrase lock is on and the keys are locked: ask for the passphrase.
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
  const locked = vault.mode === "passphrase";
  return (
    <form className="set-vault" autoComplete="off" onSubmit={(e) => { e.preventDefault(); run(() => setProviderKey(provider.id, apiKey)); }}>
      <ul className="group">
        {locked && (
          <StatusCell icon="unlock" color="var(--green)" title={<strong className="set-strong">{t("ai.keysUnlocked")}</strong>} sub={t("ai.autoLock")}>
            <button type="button" className="btn-plain set-trailing" onClick={lock}>{t("ai.lock")}</button>
          </StatusCell>
        )}
        {hint ? (
          <StatusCell icon="key" color="var(--orange)" title={name} sub={<span className="set-mono">…{hint}</span>}>
            <button type="button" className="btn-plain btn-destructive set-trailing" disabled={busy} onClick={() => run(() => removeProviderKey(provider.id))}>{t("ai.remove")}</button>
          </StatusCell>
        ) : (
          <StatusCell icon="key" color="var(--gray)" title={name}
            sub={provider.keyRequired ? t("ai.noProviderKey", { provider: name }) : t("ai.optionalKey", { provider: name })} />
        )}
      </ul>
      <div className="group set-gap">
        <label className="field" htmlFor="provider-key"><span className="field-label">{t(hint ? "ai.replaceKey" : "ai.addKey", { provider: name })}</span>
          <input id="provider-key" className="field-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerKeyPlaceholder(provider)} spellCheck={false} />
        </label>
      </div>
      <p className="section-foot">
        {locked ? t("ai.keyStoredLocked") : t("ai.keyStoredDevice")}
        <KeyLink url={provider.keyUrl} label={t("ai.getOneAt")} />
      </p>
      {error && <p className="section-foot set-error" role="alert">{error}</p>}
      <button className="btn btn-block set-primary" disabled={busy || !apiKey.trim()}>{busy ? t("ai.saving") : t("ai.saveKey")}</button>
    </form>
  );
}

/** Optional passphrase lock (Settings only). Hidden while the keys are locked — unlock first. */
export function PassphraseLock() {
  const { t, lang } = useI18n();
  const vault = useVaultStatus();
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) { setPrevLang(lang); setError(""); }
  if (!vault || !vault.unlocked || !vault.exists) return null;
  const on = vault.mode === "passphrase";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); setPass(""); setPass2(""); setOpen(false); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pass !== pass2) { setError(t("ai.passphrasesDontMatch")); return; }
    run(() => enablePassphrase(pass));
  };

  return (
    <section className="section">
    <h2 className="section-title">{t("settings.security")}</h2>
    <form className="set-vault" onSubmit={submit} autoComplete="off">
      <ul className="group">
        <StatusCell icon="lock" color={on ? "var(--blue)" : "var(--gray)"} title={t("ai.passphraseLock")}
          sub={on ? t("ai.passphraseLockOn") : t("ai.passphraseLockOff")}>
          {on
            ? <button type="button" className="btn-plain set-trailing" disabled={busy} onClick={() => run(disablePassphrase)}>{t("ai.turnOff")}</button>
            : !open && <button type="button" className="btn-plain set-trailing" onClick={() => setOpen(true)}>{t("ai.turnOn")}</button>}
        </StatusCell>
      </ul>
      {!on && open && (
        <>
          <div className="group set-gap">
            <label className="field" htmlFor="new-pass"><span className="field-label">{t("ai.newPassphrase", { min: MIN_PASSPHRASE })}</span>
              <input id="new-pass" className="field-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
            </label>
            <label className="field" htmlFor="new-pass2"><span className="field-label">{t("ai.repeatPassphrase")}</span>
              <input id="new-pass2" className="field-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={MIN_PASSPHRASE} required autoComplete="new-password" />
            </label>
          </div>
          {error && <p className="section-foot set-error" role="alert">{error}</p>}
          <div className="btn-row">
            <button type="button" className="btn-gray" onClick={() => { setOpen(false); setError(""); }}>{t("common.cancel")}</button>
            <button className="btn" disabled={busy}><Icon name="lock" size={20} aria-hidden="true" />{busy ? t("ai.encrypting") : t("ai.enableLock")}</button>
          </div>
        </>
      )}
      {!open && error && <p className="section-foot set-error" role="alert">{error}</p>}
      <p className="section-foot">{t("ai.passphraseLockHelp")}</p>
    </form>
    </section>
  );
}
