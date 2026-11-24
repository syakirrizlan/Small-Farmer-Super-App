/** Provider-neutral prompt pieces shared by every AI backend. */
import { db } from "../../db/db";
import { MODULES } from "../../db/modules";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  model: string;
  baseURL: string;
  apiKey?: string;
  system: string;
  history: ChatTurn[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

export const SYSTEM = `You are a friendly, practical farm assistant inside the "Small Farmer Super App".
You help a small-scale farmer plan, track and improve everything on their farm: crops, livestock,
tasks, inventory and money. Use the farm snapshot below when it is relevant, say so when data is
missing, and keep answers short, concrete and easy to act on in the field. If something could
harm people, animals or crops (chemicals, dosages, disease), recommend confirming with a local
agricultural extension officer or vet.`;

/** Compact snapshot of the farm's records, capped per module so the prompt stays small. */
export async function farmSnapshot(maxPerModule = 25) {
  const parts: string[] = [];
  for (const m of MODULES) {
    const rows = await db.records(m.id).orderBy("updatedAt").reverse().limit(maxPerModule).toArray();
    const total = await db.records(m.id).count();
    const slim = rows.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest);
    parts.push(`## ${m.title} (${total} total${total > maxPerModule ? `, latest ${maxPerModule} shown` : ""})\n${JSON.stringify(slim)}`);
  }
  return `Today is ${new Date().toISOString().slice(0, 10)}.\n\n# Farm snapshot\n${parts.join("\n\n")}`;
}

export const REFUSAL_TEXT = "Sorry — I can't help with that request. Try rephrasing, or ask about something else on your farm.";
