import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { getAiSettings, resolve, type AiSettings } from "./settings";
import { onVaultChange, vaultStatus, type VaultStatus } from "./vault";

export function useAiSettings(): AiSettings | undefined {
  // Re-runs whenever the settings table changes.
  return useLiveQuery(() => getAiSettings(), [db]);
}

export function useVaultStatus(): VaultStatus | null {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  useEffect(() => {
    const refresh = () => { vaultStatus().then(setStatus); };
    refresh();
    return onVaultChange(refresh);
  }, []);
  return status;
}

/** Whether the assistant can be used right now, and why not. */
export function useAiReadiness() {
  const settings = useAiSettings();
  const vault = useVaultStatus();
  if (!settings || !vault) return null;
  const { provider, model, baseURL } = resolve(settings);
  const hasKey = !!vault.hints[provider.id];
  let blocker: "locked" | "no-key" | "no-url" | "no-model" | null = null;
  if (provider.id === "custom" && !baseURL) blocker = "no-url";
  else if (!model) blocker = "no-model";
  else if (provider.keyRequired && !hasKey) blocker = vault.unlocked ? "no-key" : "locked";
  else if ((provider.keyRequired || hasKey) && !vault.unlocked) blocker = "locked";
  return { provider, model, baseURL, vault, blocker, ready: blocker === null };
}
