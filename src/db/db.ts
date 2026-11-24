import Dexie, { type Table } from "dexie";
import { MODULES } from "./modules";
import { t } from "../i18n";

/** A generic tracked record. Module-specific values live as extra keys. */
export interface FarmRecord {
  id?: number;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

/** Encrypted secret blob — never contains plaintext keys. */
export interface SecretRow {
  id: string;
  salt: ArrayBuffer;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  /** Last 4 chars per saved key, for display only. v1 rows used a single `hint`. */
  hints?: Record<string, string>;
  hint?: string;
  createdAt: number;
  updatedAt?: number;
}

/** Small non-secret key/value settings (e.g. chosen AI provider). */
export interface SettingRow {
  id: string;
  [key: string]: unknown;
}

class FarmDB extends Dexie {
  secrets!: Table<SecretRow, string>;
  settings!: Table<SettingRow, string>;
  constructor() {
    super("small-farmer-super-app");
    const schema: Record<string, string> = { secrets: "id" };
    for (const m of MODULES) schema[m.id] = "++id, createdAt, updatedAt";
    this.version(1).stores(schema);
    // v2: AI provider settings
    this.version(2).stores({ ...schema, settings: "id" });
  }
  records(moduleId: string): Table<FarmRecord, number> {
    return this.table(moduleId);
  }
}

export const db = new FarmDB();

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch { /* best effort */ }
  }
}

/** Full JSON export for backups (secrets excluded). */
export async function exportAll() {
  const out: Record<string, FarmRecord[]> = {};
  for (const m of MODULES) out[m.id] = await db.records(m.id).toArray();
  return { app: "small-farmer-super-app", version: 1, exportedAt: new Date().toISOString(), data: out };
}

/** The one import error whose message is already user-friendly (and translated). */
export class InvalidBackupError extends Error {}

export async function importAll(json: { data?: Record<string, FarmRecord[]> }) {
  if (!json?.data) throw new InvalidBackupError(t("settings.invalidBackup"));
  await db.transaction("rw", MODULES.map((m) => m.id), async () => {
    for (const m of MODULES) {
      const rows = json.data![m.id];
      if (Array.isArray(rows)) {
        await db.records(m.id).clear();
        await db.records(m.id).bulkAdd(rows);
      }
    }
  });
}
