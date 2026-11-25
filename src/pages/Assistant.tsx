import "../styles/assistant.css";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { streamChat, type ChatTurn } from "../lib/ai";
import { useAiReadiness } from "../lib/useAi";
import { KeyVault } from "../components/AiSetup";
import Icon, { type IconName } from "../components/Icon";
import { useI18n, type TKey } from "../i18n";
import { providerName } from "../i18n/labels";
import { getModule } from "../db/modules";
import MessageContent from "../components/MessageContent";
import { useDictation } from "../lib/useDictation";

type Tile = CSSProperties & { "--tile"?: string };

const SUGGESTIONS: { key: TKey; glyph: IconName; color: string }[] = [
  // Colours come from the module registry so each glyph matches its module elsewhere.
  { key: "assistant.suggestions.week", glyph: "calendar", color: getModule("tasks")?.color ?? "var(--blue)" },
  { key: "assistant.suggestions.money", glyph: "money", color: getModule("finance")?.color ?? "var(--teal)" },
  { key: "assistant.suggestions.reorder", glyph: "box", color: getModule("inventory")?.color ?? "var(--indigo)" },
  { key: "assistant.suggestions.plan", glyph: "leaf", color: getModule("crops")?.color ?? "var(--green)" },
];

export default function Assistant() {
  const { t, lang } = useI18n();
  const ai = useAiReadiness();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  // Voice typing: spoken words go into the message box for review before sending.
  const dict = useDictation(setDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) { setPrevLang(lang); setError(""); }
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);

  // Let the composer grow with its text, up to a few lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft, ai?.ready]);

  // Cloud providers need the internet; a local Ollama server may still be reachable.
  const offlineBlocked = !online && ai?.provider.id !== "ollama";

  const send = async (text: string) => {
    dict.stop();
    if (!text.trim() || busy || offlineBlocked) return;
    const history: ChatTurn[] = [...turns, { role: "user", content: text.trim() }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft(""); setBusy(true); setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const final = await streamChat(history, (delta) => {
        setTurns((t) => {
          const copy = [...t];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + delta };
          return copy;
        });
      }, controller.signal);
      setTurns([...history, { role: "assistant", content: final }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTurns(history.slice(0, -1)); // drop the failed exchange
      setDraft(text);
    } finally {
      if (abort.current === controller) abort.current = null;
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); send(draft); };
  const canSend = !!draft.trim() && !offlineBlocked;

  return (
    <div className="page asst">
      <header className="page-head">
        <h1 className="t-large">{t("assistant.title")}</h1>
        {ai && (
          <div className="asst-provider">
            <span className="asst-provider-text">
              <span className="asst-provider-using">{t("assistant.using")}</span>{" "}
              <span className="asst-provider-name">{providerName(ai.provider)}</span>
              {ai.model && <code className="asst-model" title={ai.model}>{ai.model}</code>}
            </span>
            <Link to="/settings" className="asst-change">{t("assistant.change")}</Link>
          </div>
        )}
      </header>

      {ai && !ai.ready && (
        <section className="section asst-setup">
          <div className="card asst-setup-card">
            <span className="tile tile-lg" style={{ "--tile": "var(--tint)" } as Tile}><Icon name="sparkles" /></span>
            <div className="asst-setup-text">
              <h2 className="t-headline">{t("assistant.setupTitle")}</h2>
              <p className="asst-setup-sub">{t("assistant.setupSub")}</p>
            </div>
          </div>
          {ai.blocker === "no-url" || ai.blocker === "no-model"
            ? (
              <ul className="group">
                <li>
                  <Link to="/settings" className="cell cell-link">
                    <span className="tile" style={{ "--tile": "var(--label-2)" } as Tile}><Icon name="gear" /></span>
                    <span className="cell-body">
                      <span className="cell-title">{t("assistant.finishSetup", { provider: providerName(ai.provider) })} {t("nav.settings")}</span>
                    </span>
                    <Icon name="chevron" className="chev" />
                  </Link>
                </li>
              </ul>
            )
            : <div className="asst-vault"><KeyVault /></div>}
        </section>
      )}

      {ai?.ready && (
        <>
          <div className="chat asst-thread" role="log" aria-live="polite" aria-relevant="additions">
            {turns.length === 0 && (
              <div className="suggestions asst-empty">
                <div className="asst-intro">
                  <span className="asst-intro-glyph" aria-hidden="true"><Icon name="sparkles" /></span>
                  <h2 className="t-title3">{t("assistant.introTitle")}</h2>
                  <p className="asst-intro-body">{t("assistant.intro")}</p>
                </div>
                <section className="section">
                  <h3 className="section-title">{t("assistant.suggestionsHeader")}</h3>
                  <ul className="group">
                    {SUGGESTIONS.map((s) => (
                      <li key={s.key}>
                        <button type="button" className="chip cell cell-link" onClick={() => send(t(s.key))}>
                          <span className="tile" style={{ "--tile": s.color } as Tile}><Icon name={s.glyph} /></span>
                          <span className="cell-body"><span className="cell-title">{t(s.key)}</span></span>
                          <Icon name="send" className="asst-chip-arrow" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="section-foot">{t("assistant.disclaimer")}{dict.supported && <> {t("assistant.voiceNote")}</>}</p>
                </section>
              </div>
            )}
            {turns.map((turn, i) => {
              const typing = !turn.content && busy;
              return (
                <div key={i} className={`asst-row asst-row-${turn.role}`}>
                  <span className="sr-only">{turn.role === "user" ? t("assistant.you") : t("assistant.them")}</span>
                  <div className={`bubble ${turn.role}${typing ? " typing" : ""}`}>
                    {typing
                      ? <><span className="asst-dots" aria-hidden="true"><i /><i /><i /></span><span className="sr-only">{t("assistant.thinking")}</span></>
                      : turn.role === "assistant" ? <MessageContent content={turn.content} streaming={busy && i === turns.length - 1} /> : turn.content}
                  </div>
                </div>
              );
            })}
            {turns.length > 0 && !busy && (
              <div className="asst-new">
                <button type="button" className="btn-plain asst-new-btn" onClick={() => setTurns([])}>
                  <Icon name="plus" />{t("assistant.newConversation")}
                </button>
              </div>
            )}
            <div ref={endRef} className="asst-end" />
          </div>
          <div className="asst-dock">
            {offlineBlocked && <p className="asst-note" role="status"><Icon name="alert" />{t("assistant.offline")}</p>}
            {error && <p className="error asst-error" role="alert"><Icon name="alert" />{error}</p>}
            {dict.listening && <p className="asst-note asst-listening" role="status"><span className="asst-rec-dot" aria-hidden="true" />{t("assistant.listening")}</p>}
            {dict.error && !dict.listening && <p className="error asst-error" role="alert"><Icon name="alert" />{t(dict.error)}</p>}
            <form className="composer asst-composer" onSubmit={submit}>
              <textarea ref={inputRef} rows={1} value={draft} readOnly={dict.listening}
                placeholder={dict.listening ? t("assistant.listeningShort") : t("assistant.placeholder")} aria-label={t("assistant.placeholder")}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) send(draft); } }} />
              {/* Separate keyed nodes: if React reused one <button> for Stop and Send, the Stop
                  click's default action would run after it turned back into a submit button and
                  re-send the message. preventDefault cancels that activation as well. */}
              {dict.supported && !busy && (
                <button key="mic" type="button" className={`asst-mic${dict.listening ? " on" : ""}`}
                  aria-pressed={dict.listening} aria-label={t(dict.listening ? "assistant.micStop" : "assistant.micStart")}
                  title={t(dict.listening ? "assistant.micStop" : "assistant.micStart")} disabled={!online}
                  onClick={() => { if (dict.listening) { dict.stop(); inputRef.current?.focus(); } else dict.start(draft); }}>
                  <Icon name="mic" />
                </button>
              )}
              {busy
                ? <button key="stop" type="button" className="asst-send asst-stop"
                    onClick={(e) => { e.preventDefault(); abort.current?.abort(); }}>
                    <Icon name="stop" /><span className="sr-only">{t("assistant.stop")}</span>
                  </button>
                : <button key="send" type="submit" className="asst-send" disabled={!canSend}>
                    <Icon name="send" /><span className="sr-only">{t("assistant.send")}</span>
                  </button>}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
