/**
 * API-key vault — holds keys for any number of AI providers.
 *
 * Two modes:
 * - "device" (default): keys are encrypted (AES-GCM 256) with a random key the browser generates
 *   as non-extractable and keeps in IndexedDB. No passphrase; the assistant just works.
 *   Protects against: keys appearing as readable text in storage, in backups, or on screen.
 *   Does NOT protect against someone using this device / browser profile — they can use the
 *   assistant, and a technical person with the profile could recover the keys.
 * - "passphrase" (optional lock): the AES key is derived from the farmer's passphrase
 *   (PBKDF2-SHA256, 600k iterations, random salt) and never stored. Keys are decrypted into
 *   memory only after unlocking, and auto-lock after IDLE_LOCK_MS or when the app closes.
 *
 * Only ciphertext is stored. Requests go straight from the device to the chosen provider.
 */
import { db, type SecretRow } from "../db/db";
import { t } from "../i18n";

const VAULT_ID = "provider-keys";
const LEGACY_ID = "anthropic-api-key"; // v0.1 single-key vault (passphrase)
const PBKDF2_ITERATIONS = 600_000;
const IDLE_LOCK_MS = 15 * 60 * 1000;
export const MIN_PASSPHRASE = 8;

export type VaultMode = "device" | "passphrase";

interface Session {
  mode: VaultMode;
  aes: CryptoKey;
  salt?: ArrayBuffer; // passphrase mode only
  keys: Record<string, string>;
}

let session: Session | null = null;
/** Bumped on every lock/reset so a slow unlock that finishes afterwards is discarded. */
let epoch = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
export const onVaultChange = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

function checkEpoch(my: number) {
  if (epoch !== my) throw new Error(t("errors.vaultReset"));
}

async function deriveKey(passphrase: string, salt: ArrayBuffer) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );
}

/** A random AES key the page can use but never read out. Stored as a CryptoKey object. */
const newDeviceKey = () =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

async function decryptWith(aes: CryptoKey, iv: ArrayBuffer, ciphertext: ArrayBuffer, wrongMsg: string) {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error(wrongMsg);
  }
}

const hintsOf = (keys: Record<string, string>) =>
  Object.fromEntries(Object.entries(keys).map(([p, k]) => [p, k.slice(-4)]));

/** Encrypt the in-memory key map with a fresh IV and store it (mode decides what else is stored). */
async function persist(s: Session) {
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, s.aes, new TextEncoder().encode(JSON.stringify(s.keys)),
  );
  const existing = await db.secrets.get(VAULT_ID);
  const row: SecretRow = {
    id: VAULT_ID, mode: s.mode, iv, ciphertext, hints: hintsOf(s.keys),
    createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now(),
  };
  if (s.mode === "device") row.deviceKey = s.aes;
  else row.salt = s.salt;
  await db.secrets.put(row);
}

function armIdleLock() {
  clearTimeout(idleTimer);
  // Only a passphrase vault locks itself; a device vault would just unlock again.
  if (session?.mode === "passphrase") idleTimer = setTimeout(lock, IDLE_LOCK_MS);
}

/** Device-mode vaults open by themselves. Resolves once any automatic unlock has finished. */
let autoUnlock: Promise<void> = Promise.resolve();
function startAutoUnlock() {
  const my = epoch;
  autoUnlock = (async () => {
    const row = await db.secrets.get(VAULT_ID);
    if (!row || row.mode !== "device" || !row.deviceKey || session) return;
    const text = await decryptWith(row.deviceKey, row.iv, row.ciphertext, t("errors.vaultReset"));
    if (epoch !== my || session) return;
    session = { mode: "device", aes: row.deviceKey, keys: JSON.parse(text) };
    notify();
  })().catch(() => { /* unreadable device vault: treated as locked/empty */ });
  return autoUnlock;
}
if (typeof window !== "undefined") startAutoUnlock();

/** Wait until a device vault has opened (call before reading keys). */
export const vaultReady = () => autoUnlock;

/** Session for writing keys: opens (or creates) a device vault when needed. */
async function writableSession(): Promise<Session> {
  await autoUnlock;
  if (session) { armIdleLock(); return session; }
  const row = await db.secrets.get(VAULT_ID);
  if (row || (await db.secrets.get(LEGACY_ID))) throw new Error(t("errors.vaultLocked"));
  // First key ever: create a device vault — no passphrase needed.
  session = { mode: "device", aes: await newDeviceKey(), keys: {} };
  return session;
}

export async function unlock(passphrase: string) {
  const my = epoch;
  const row = await db.secrets.get(VAULT_ID);
  if (row) {
    if (row.mode === "device" || !row.salt) { await startAutoUnlock(); return; }
    const aes = await deriveKey(passphrase, row.salt);
    const text = await decryptWith(aes, row.iv, row.ciphertext, t("errors.wrongPassphrase"));
    checkEpoch(my);
    session = { mode: "passphrase", aes, salt: row.salt, keys: JSON.parse(text) };
  } else {
    // Migrate the v0.1 single-key vault (Anthropic only) into the multi-provider vault.
    const legacy = await db.secrets.get(LEGACY_ID);
    if (!legacy || !legacy.salt) throw new Error(t("errors.noVault"));
    const aes = await deriveKey(passphrase, legacy.salt);
    const text = await decryptWith(aes, legacy.iv, legacy.ciphertext, t("errors.wrongPassphrase"));
    checkEpoch(my);
    const next: Session = { mode: "passphrase", aes, salt: legacy.salt, keys: { anthropic: text } };
    await persist(next);
    checkEpoch(my);
    await db.secrets.delete(LEGACY_ID);
    session = next;
  }
  armIdleLock();
  notify();
}

/** Lock a passphrase vault (no effect on a device vault, which has nothing to unlock with). */
export function lock() {
  if (session?.mode === "device") return;
  epoch++;
  session = null;
  clearTimeout(idleTimer);
  notify();
}

/** Turn on the optional passphrase lock: re-encrypt all keys with a passphrase-derived key. */
export async function enablePassphrase(passphrase: string) {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(t("errors.passphraseTooShort", { min: MIN_PASSPHRASE }));
  const s = await writableSession();
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const next: Session = { mode: "passphrase", aes: await deriveKey(passphrase, salt), salt, keys: s.keys };
  await persist(next);
  session = next;
  armIdleLock();
  notify();
}

/** Turn off the passphrase lock (vault must be unlocked): keys move back to the device key. */
export async function disablePassphrase() {
  const s = await writableSession();
  const next: Session = { mode: "device", aes: await newDeviceKey(), keys: s.keys };
  await persist(next);
  session = next;
  clearTimeout(idleTimer);
  notify();
}

export async function setProviderKey(providerId: string, apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error(t("errors.emptyKey"));
  const s = await writableSession();
  s.keys = { ...s.keys, [providerId]: trimmed };
  await persist(s);
  notify();
}

export async function removeProviderKey(providerId: string) {
  const s = await writableSession();
  const { [providerId]: _removed, ...rest } = s.keys;
  s.keys = rest;
  await persist(s);
  notify();
}

/** Delete the vault and every saved key from this device. */
export async function resetVault() {
  epoch++;
  session = null;
  clearTimeout(idleTimer);
  await db.secrets.bulkDelete([VAULT_ID, LEGACY_ID]);
  notify();
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  mode: VaultMode;
  /** providerId → last 4 chars, readable while locked. */
  hints: Record<string, string>;
}

export async function vaultStatus(): Promise<VaultStatus> {
  await autoUnlock;
  const row = await db.secrets.get(VAULT_ID);
  const legacy = row ? undefined : await db.secrets.get(LEGACY_ID);
  const hints = row?.hints ?? (legacy?.hint ? { anthropic: legacy.hint } : {});
  const mode: VaultMode = row ? (row.mode === "device" ? "device" : "passphrase") : legacy ? "passphrase" : "device";
  // A device vault is always usable; "unlocked" is only meaningful for a passphrase vault.
  const unlocked = session !== null || !(row || legacy);
  return { exists: !!(row || legacy), unlocked, mode, hints };
}

/** The in-memory key for a provider. Throws if locked or missing. Call vaultReady() first. */
export function getProviderKey(providerId: string): string {
  if (!session) throw new Error(t("errors.vaultLocked"));
  armIdleLock();
  const key = session.keys[providerId];
  if (!key) throw new Error(t("errors.noKeyForProvider"));
  return key;
}

/** Like getProviderKey but returns undefined instead of throwing (for optional keys). */
export function peekProviderKey(providerId: string): string | undefined {
  if (!session) return undefined;
  armIdleLock();
  return session.keys[providerId];
}

// A passphrase vault locks when the app is closed. A device vault stays open.
if (typeof window !== "undefined") window.addEventListener("pagehide", lock);
