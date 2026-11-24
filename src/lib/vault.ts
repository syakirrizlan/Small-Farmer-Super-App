/**
 * API-key vault.
 *
 * - The key is encrypted with AES-GCM (256-bit) using a key derived from the user's
 *   passphrase via PBKDF2-SHA256 (600k iterations, random 16-byte salt).
 * - Only the ciphertext is stored (IndexedDB). The passphrase is never stored.
 * - The decrypted key lives only in memory and is wiped on lock, on tab close,
 *   and after IDLE_LOCK_MS without use.
 *
 * Limits (be honest with users): anything running in this page could read the key
 * while unlocked, so we keep a strict CSP and no third-party scripts. Data stays on
 * this device; requests go straight from the device to api.anthropic.com.
 */
import { db } from "../db/db";

const SECRET_ID = "anthropic-api-key";
const PBKDF2_ITERATIONS = 600_000;
const IDLE_LOCK_MS = 15 * 60 * 1000;

let unlockedKey: string | null = null;
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

function armIdleLock() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lock, IDLE_LOCK_MS);
}

export async function saveKey(apiKey: string, passphrase: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key is empty");
  if (passphrase.length < 8) throw new Error("Passphrase must be at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const aes = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(trimmed));
  await db.secrets.put({ id: SECRET_ID, salt, iv, ciphertext, hint: trimmed.slice(-4), createdAt: Date.now() });
  unlockedKey = trimmed;
  armIdleLock();
  notify();
}

export async function unlock(passphrase: string) {
  const row = await db.secrets.get(SECRET_ID);
  if (!row) throw new Error("No API key saved yet");
  try {
    const aes = await deriveKey(passphrase, row.salt);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv }, aes, row.ciphertext);
    unlockedKey = new TextDecoder().decode(plain);
  } catch {
    throw new Error("Wrong passphrase");
  }
  armIdleLock();
  notify();
}

export function lock() {
  unlockedKey = null;
  clearTimeout(idleTimer);
  notify();
}

export async function forgetKey() {
  await db.secrets.delete(SECRET_ID);
  lock();
}

export async function vaultStatus() {
  const row = await db.secrets.get(SECRET_ID);
  return { saved: !!row, hint: row?.hint ?? null, unlocked: unlockedKey !== null };
}

/** Returns the in-memory key and refreshes the idle timer. */
export function useKey(): string {
  if (!unlockedKey) throw new Error("Vault is locked");
  armIdleLock();
  return unlockedKey;
}

if (typeof window !== "undefined") window.addEventListener("pagehide", lock);
