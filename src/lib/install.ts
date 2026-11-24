/**
 * PWA install support (Chrome / Edge on Windows, also Android and other desktops).
 *
 * The browser fires `beforeinstallprompt` once, early, when the app is installable.
 * We keep that event so an "Install app" button can show the browser's install dialog later.
 * This module must be imported before React renders (see main.tsx) so the event isn't missed.
 */
import { useSyncExternalStore } from "react";

/** Not in the TS DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

/**
 * installed            → running in the installed app window
 * installed-elsewhere  → installed on this device, but open in a normal browser tab
 * available            → browser offered installation; show the Install button
 * unavailable          → not offered (yet); show manual steps
 */
export type InstallState = "installed" | "installed-elsewhere" | "available" | "unavailable";

const FLAG = "sf-installed";
const readFlag = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };
const writeFlag = (on: boolean) => {
  try { if (on) localStorage.setItem(FLAG, "1"); else localStorage.removeItem(FLAG); } catch { /* storage blocked */ }
};

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** True when running as the installed app (its own window), not in a browser tab. */
function runningInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.matchMedia?.("(display-mode: window-controls-overlay)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function compute(): InstallState {
  if (runningInstalled()) { writeFlag(true); return "installed"; }
  if (deferred) return "available";
  if (installedNow || readFlag()) return "installed-elsewhere";
  return "unavailable";
}

let snapshot: InstallState = compute();
const refresh = () => {
  const next = compute();
  if (next !== snapshot) { snapshot = next; notify(); }
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // stop the browser's own mini-bar; we show our own button
    deferred = e as BeforeInstallPromptEvent;
    // Only fires when the app is NOT installed, so clear any stale "installed" memory (e.g. after uninstall).
    installedNow = false;
    writeFlag(false);
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    writeFlag(true);
    refresh();
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", refresh);
}

/** Opens the browser's install dialog. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null; // the event can only be used once
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === "accepted") { installedNow = true; writeFlag(true); }
    return outcome === "accepted";
  } finally {
    refresh();
  }
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const get = () => snapshot;

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, get, get);
}
