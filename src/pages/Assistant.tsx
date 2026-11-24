import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { streamChat, type ChatTurn } from "../lib/ai";
import { useAiReadiness } from "../lib/useAi";
import { KeyVault } from "../components/AiSetup";

const SUGGESTIONS = [
  "What should I focus on this week?",
  "Summarise my income and expenses this month.",
  "Which inventory items should I reorder?",
  "Give me a planting plan for my empty plots.",
];

export default function Assistant() {
  const ai = useAiReadiness();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      <h1>🤖 Farm Assistant</h1>
      {ai && (
        <div className="row between provider-bar">
          <span className="pill-outline">Using <b>{ai.provider.name}</b>{ai.model && <> · <code>{ai.model}</code></>}</span>
          <Link to="/settings" className="link">Change</Link>
        </div>
      )}
      {ai && !ai.ready && (ai.blocker === "no-url" || ai.blocker === "no-model"
        ? <p className="card">Finish setting up {ai.provider.name} in <Link to="/settings" className="link">Settings</Link>.</p>
        : <KeyVault />)}
      {ai?.ready && (
        <>
          <div className="chat">
            {turns.length === 0 && (
              <div className="suggestions">
                <p className="muted">The assistant can see a snapshot of your farm records. Try:</p>
                {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`bubble ${t.role}`}>{t.content || (busy ? "Thinking…" : "")}</div>
            ))}
            <div ref={endRef} />
          </div>
          {error && <p className="error">{error}</p>}
          <form className="composer" onSubmit={submit}>
            <textarea rows={2} value={draft} placeholder="Ask about your farm…" onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
            {busy
              ? <button type="button" className="ghost" onClick={() => abort.current?.abort()}>Stop</button>
              : <button disabled={!draft.trim() || (!navigator.onLine && ai.provider.id !== "ollama")}>Send</button>}
          </form>
          {turns.length > 0 && !busy && <button className="ghost small" onClick={() => setTurns([])}>New conversation</button>}
        </>
      )}
    </>
  );
}
