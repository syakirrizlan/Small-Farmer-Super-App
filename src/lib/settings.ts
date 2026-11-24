/** Non-secret AI preferences (which provider, which model, custom URL). Stored in IndexedDB. */
import { db } from "../db/db";
import { DEFAULT_PROVIDER, getProvider, type ProviderDef } from "./providers";

export interface AiSettings {
  id: "ai";
  activeProvider: string;
  models: Record<string, string>;
  customBaseURL: string;
}

const DEFAULTS: AiSettings = { id: "ai", activeProvider: DEFAULT_PROVIDER, models: {}, customBaseURL: "" };

export async function getAiSettings(): Promise<AiSettings> {
  const row = (await db.settings.get("ai")) as AiSettings | undefined;
  return { ...DEFAULTS, ...row, models: { ...(row?.models ?? {}) } };
}

export async function updateAiSettings(patch: Partial<Omit<AiSettings, "id">>) {
  const cur = await getAiSettings();
  await db.settings.put({ ...cur, ...patch, id: "ai" });
}

/** Resolved provider + model + base URL for the active choice. */
export function resolve(s: AiSettings): { provider: ProviderDef; model: string; baseURL: string } {
  const provider = getProvider(s.activeProvider) ?? getProvider(DEFAULT_PROVIDER)!;
  const model = (s.models[provider.id] || provider.defaultModel).trim();
  const baseURL = (provider.id === "custom" ? s.customBaseURL : provider.baseURL).trim().replace(/\/+$/, "");
  return { provider, model, baseURL };
}
