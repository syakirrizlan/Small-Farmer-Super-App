/**
 * Voice typing with the browser's built-in speech recognition (Chrome, Edge, Safari, Android).
 * The browser's own speech service turns audio into text (needs internet in Chrome/Edge).
 * Text appears live in the message box; the farmer reviews it and taps Send.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getLang, type TKey } from "../i18n";

interface RecResultAlt { transcript: string }
interface RecResult { isFinal: boolean; 0: RecResultAlt; length: number }
interface RecEvent { resultIndex: number; results: { length: number; [i: number]: RecResult } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecCtor = new () => Recognition;

function ctor(): RecCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export const speechSupported = () => !!ctor();

const ERRORS: Record<string, TKey> = {
  "not-allowed": "assistant.micDenied",
  "service-not-allowed": "assistant.micDenied",
  "audio-capture": "assistant.noMic",
  network: "assistant.speechNetwork",
  "no-speech": "assistant.noSpeech",
  "language-not-supported": "assistant.speechLang",
};

/** Join what was already typed with the spoken text. */
const join = (base: string, spoken: string) => {
  const s = spoken.trim();
  if (!s) return base;
  return base && !/\s$/.test(base) ? `${base} ${s}` : `${base}${s}`;
};

export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback((base: string) => {
    const C = ctor();
    if (!C) return;
    rec.current?.abort();
    const r = new C();
    r.lang = getLang() === "ms" ? "ms-MY" : "en-MY";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onstart = () => { setListening(true); setError(null); };
    r.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      cb.current(join(base, spoken));
    };
    r.onerror = (e) => { if (e.error !== "aborted") setError(ERRORS[e.error] ?? "assistant.speechFailed"); };
    r.onend = () => { setListening(false); if (rec.current === r) rec.current = null; };
    rec.current = r;
    setError(null);
    try { r.start(); } catch { setError("assistant.speechFailed"); setListening(false); }
  }, []);

  // Stop listening when leaving the screen.
  useEffect(() => () => { rec.current?.abort(); }, []);

  return { supported: speechSupported(), listening, error, start, stop, clearError: () => setError(null) };
}
