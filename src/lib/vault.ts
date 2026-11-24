/**
 * API-key vault — holds keys for any number of AI providers behind ONE passphrase.
 *
 * - All keys are stored together as one JSON map, encrypted with AES-GCM (256-bit)
 *   using a key derived from the passphrase via PBKDF2-SHA256 (600k iterations, random salt).
 * - Only ciphertext is stored (IndexedDB). The passphrase is never stored.
 * - While unlocked, the keys and the (non-extractable) AES key live only in memory.
 *   They are wiped on lock, on tab close, and after IDLE_LOCK_MS without use.
 *
 * Limits (be honest with users): anything running in this page could read the keys
 * while unlocked, so we keep a strict CSP and no third-party scripts. Requests go
 * straight from the device to the provider the farmer chose.
 */
import { db, type SecretRow } from "../db/db";

const VAULT_ID = "provider-keys";
const LEGACY_ID = "anthropic-api-key"; // v0.1 single-key vault
const PBKDF2_ITERATIONS = 600_000;
const IDLE_LOCK_MS = 15 * 60 * 1000;
export const MIN_PASSPHRASE = 8;

interface Session {
  aes: CryptoKey;
  salt: ArrayBuffer;
  keys: Record<string, string>;
}

let session: Session | null = null;
/** Bumped on every lock/reset so a slow unlock/create that finishes afterwards is discarded. */
let epoch = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
export const onVaultChange = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

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

async function decryptRow(row: SecretRow, passphrase: string) {
  const aes = await deriveKey(passphrase, row.salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv }, aes, row.ciphertext);
    return { aes, text: new TextDecoder().decode(plain) };
  } catch {
    throw new Error("Wrong passphrase");
  }
}

const hintsOf = (keys: Record<string, string>) =>
  Object.fromEntries(Object.entries(keys).map(([p, k]) => [p, k.slice(-4)]));

/** Encrypt the in-memory key map with a fresh IV and store it. */
async function persist(s: Session) {
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, s.aes, new TextEncoder().encode(JSON.stringify(s.keys)),
  );
  const existing = await db.secrets.get(VAULT_ID);
  await db.secrets.put({
    id: VAULT_ID, salt: s.salt, iv, ciphertext, hints: hintsOf(s.keys),
    createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now(),
  });
}

function armIdleLock() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lock, IDLE_LOCK_MS);
}

function requireSession(): Session {
  if (!session) throw new Error("Vault is locked");
  armIdleLock();
  return session;
}

/** Create a new, empty vault protected by `passphrase` and leave it unlocked. */
export async function createVault(passphrase: string) {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE} characters`);
  const my = epoch;
  if (await db.secrets.get(VAULT_ID)) throw new Error("A vault already exists. Unlock it instead.");
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const next = { aes: await deriveKey(passphrase, salt), salt, keys: {} };
  checkEpoch(my);
  await persist(next);
  session = next;
  armIdleLock();
  notify();
}

function checkEpoch(my: number) {
  if (epoch !== my) throw new Error("The vault was locked or reset. Please try again.");
}

export async function unlock(passphrase: string) {
  const my = epoch;
  const row = await db.secrets.get(VAULT_ID);
  if (row) {
    const { aes, text } = await decryptRow(row, passphrase);
    checkEpoch(my);
    session = { aes, salt: row.salt, keys: JSON.parse(text) };
  } else {
    // Migrate the v0.1 single-key vault (Anthropic only) into the multi-provider vault.
    const legacy = await db.secrets.get(LEGACY_ID);
    if (!legacy) throw new Error("No vault yet");
    const { aes, text } = await decryptRow(legacy, passphrase);
    checkEpoch(my);
    const next = { aes, salt: legacy.salt, keys: { anthropic: text } };
    await persist(next);
    checkEpoch(my);
    await db.secrets.delete(LEGACY_ID);
    session = next;
  }
  armIdleLock();
  notify();
}

export function lock() {
  epoch++;
  session = null;
  clearTimeout(idleTimer);
  notify();
}

export async function setProviderKey(providerId: string, apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key is empty");
  const s = requireSession();
  s.keys = { ...s.keys, [providerId]: trimmed };
  await persist(s);
  notify();
}

export async function removeProviderKey(providerId: string) {
  const s = requireSession();
  const { [providerId]: _removed, ...rest } = s.keys;
  s.keys = rest;
  await persist(s);
  notify();
}

/** Delete the vault and every saved key from this device. */
export async function resetVault() {
  await db.secrets.bulkDelete([VAULT_ID, LEGACY_ID]);
  lock();
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  /** providerId → last 4 chars, readable while locked. */
  hints: Record<string, string>;
}

export async function vaultStatus(): Promise<VaultStatus> {
  const row = await db.secrets.get(VAULT_ID);
  const legacy = row ? undefined : await db.secrets.get(LEGACY_ID);
  const hints = row?.hints ?? (legacy?.hint ? { anthropic: legacy.hint } : {});
  return { exists: !!(row || legacy), unlocked: session !== null, hints };
}

/** The in-memory key for a provider (refreshes the idle timer). Throws if locked or missing. */
export function getProviderKey(providerId: string): string {
  const key = requireSession().keys[providerId];
  if (!key) throw new Error("No API key saved for this provider");
  return key;
}

/** Like getProviderKey but returns undefined instead of throwing (for optional keys). */
export function peekProviderKey(providerId: string): string | undefined {
  if (!session) return undefined;
  armIdleLock();
  return session.keys[providerId];
}

if (typeof window !== "undefined") window.addEventListener("pagehide", lock);
