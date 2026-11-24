import Dexie, { type Table } from "dexie";
import { MODULES } from "./modules";

/** A generic tracked record. Module-specific values live as extra keys. */
export interface FarmRecord {
  id?: number;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

/** Encrypted secret blob — never contains plaintext. */
export interface SecretRow {
  id: string;
  salt: ArrayBuffer;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  hint: string; // last 4 chars of the key, for display only
  createdAt: number;
}

class FarmDB extends Dexie {
  secrets!: Table<SecretRow, string>;
  constructor() {
    super("small-farmer-super-app");
    const schema: Record<string, string> = { secrets: "id" };
    for (const m of MODULES) schema[m.id] = "++id, createdAt, updatedAt";
    this.version(1).stores(schema);
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

export async function importAll(json: { data?: Record<string, FarmRecord[]> }) {
  if (!json?.data) throw new Error("Not a valid backup file");
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
