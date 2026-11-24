import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { streamChat, type ChatTurn } from "../lib/ai";
import { useAiReadiness } from "../lib/useAi";
import { KeyVault } from "../components/AiSetup";
import { useI18n, type TKey } from "../i18n";
import { providerName } from "../i18n/labels";

const SUGGESTIONS: TKey[] = [
  "assistant.suggestions.week",
  "assistant.suggestions.money",
  "assistant.suggestions.reorder",
  "assistant.suggestions.plan",
];

export default function Assistant() {
  const { t, lang } = useI18n();
  const ai = useAiReadiness();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prevLang, setPrevLang] = useState(lang);
  if (lang !== prevLang) { setPrevLang(lang); setError(""); }
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const history: ChatTurn[] = [...turns, { role: "user", content: text.trim() }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft(""); setBusy(true); setError("");
    abort.current = new AbortController();
    try {
      const final = await streamChat(history, (delta) => {
        setTurns((t) => {
          const copy = [...t];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + delta };
          return copy;
        });
      }, abort.current.signal);
      setTurns([...history, { role: "assistant", content: final }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTurns(history.slice(0, -1)); // drop the failed exchange
      setDraft(text);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); send(draft); };

  return (
    <>
      <h1>{t("assistant.title")}</h1>
      {ai && (
        <div className="row between provider-bar">
          <span className="pill-outline">{t("assistant.using")} <b>{providerName(ai.provider)}</b>{ai.model && <> · <code>{ai.model}</code></>}</span>
          <Link to="/settings" className="link">{t("assistant.change")}</Link>
        </div>
      )}
      {ai && !ai.ready && (ai.blocker === "no-url" || ai.blocker === "no-model"
        ? <p className="card">{t("assistant.finishSetup", { provider: providerName(ai.provider) })} <Link to="/settings" className="link">{t("nav.settings")}</Link>.</p>
        : <KeyVault />)}
      {ai?.ready && (
        <>
          <div className="chat">
            {turns.length === 0 && (
              <div className="suggestions">
                <p className="muted">{t("assistant.intro")}</p>
                {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(t(s))}>{t(s)}</button>)}
              </div>
            )}
            {turns.map((turn, i) => (
              <div key={i} className={`bubble ${turn.role}`}>{turn.content || (busy ? t("assistant.thinking") : "")}</div>
            ))}
            <div ref={endRef} />
          </div>
          {error && <p className="error">{error}</p>}
          <form className="composer" onSubmit={submit}>
            <textarea rows={2} value={draft} placeholder={t("assistant.placeholder")} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
            {busy
              ? <button type="button" className="ghost" onClick={() => abort.current?.abort()}>{t("assistant.stop")}</button>
              : <button disabled={!draft.trim() || (!navigator.onLine && ai.provider.id !== "ollama")}>{t("assistant.send")}</button>}
          </form>
          {turns.length > 0 && !busy && <button className="ghost small" onClick={() => setTurns([])}>{t("assistant.newConversation")}</button>}
        </>
      )}
    </>
  );
}
