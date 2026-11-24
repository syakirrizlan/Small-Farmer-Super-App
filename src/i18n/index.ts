/**
 * Tiny i18n: no library, works inside and outside React.
 * - `t("a.b", { x })` looks up a string in the current language (falls back to English).
 * - `useI18n()` re-renders a component when the language changes.
 * - Saved data (e.g. a crop's status "Growing") stays in English; only display is translated.
 */
import { useSyncExternalStore } from "react";
import en, { type Dict } from "./en";
import ms from "./ms";

export type Lang = "en" | "ms";
export const LANGUAGES: { id: Lang; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "ms", label: "Bahasa Melayu", short: "BM" },
];
const DICTS: Record<Lang, Dict> = { en, ms };
const STORAGE_KEY = "lang";

/** Every "a.b.c" path to a string in the dictionary. */
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dict>;
export type Vars = Record<string, string | number>;

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ms") return saved;
  } catch { /* storage blocked */ }
  const prefs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  return prefs.some((l) => /^(ms|zsm)\b/i.test(l)) ? "ms" : "en";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();
const applyHtmlLang = () => { if (typeof document !== "undefined") document.documentElement.lang = current; };
applyHtmlLang();

export const getLang = () => current;

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage blocked */ }
  applyHtmlLang();
  listeners.forEach((l) => l());
}

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

export function t(key: TKey, vars?: Vars): string {
  return fill(lookup(DICTS[current], key) ?? lookup(en, key) ?? key, vars);
}

/** For keys built at runtime (module ids, option values). Returns `fallback` if missing. */
export function tDynamic(key: string, fallback: string, vars?: Vars): string {
  return fill(lookup(DICTS[current], key) ?? lookup(en, key) ?? fallback, vars);
}

/** Display label for a saved dropdown value such as "Growing". */
export const tOption = (value: unknown) => {
  const v = String(value ?? "");
  return v ? tDynamic(`options.${v}`, v) : "";
};

/** Locale tag for number/date formatting. */
export const locale = () => (current === "ms" ? "ms-MY" : "en-MY");

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Subscribe a component to language changes. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, t, tOption, setLang };
}
