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

export type InstallState = "installed" | "available" | "unavailable";

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
  if (installedNow || runningInstalled()) return "installed";
  return deferred ? "available" : "unavailable";
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
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
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
    if (outcome === "accepted") installedNow = true;
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
