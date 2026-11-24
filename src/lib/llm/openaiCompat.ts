/**
 * Any OpenAI-compatible chat-completions API (OpenAI, DeepSeek, Gemini, OpenRouter,
 * Groq, Mistral, Ollama, custom). Plain fetch with only standard headers
 * (Authorization, Content-Type): some providers' CORS rules reject extra SDK headers.
 */
import { refusalText, type StreamRequest } from "./context";
import { t } from "../../i18n";

function headers(apiKey?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

async function httpError(res: Response, providerName: string, hadKey: boolean): Promise<Error> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? body?.message ?? (typeof body?.error === "string" ? body.error : "");
  } catch { /* non-JSON body */ }
  const provider = providerName;
  const msg: Record<number, string> = {
    401: hadKey ? t("errors.keyRejected", { provider }) : t("errors.needsKey", { provider }),
    402: t("errors.noCredit", { provider }),
    403: t("errors.noModelAccess", { provider }),
    404: t("errors.unknownModel", { provider }),
    429: t("errors.rateLimit"),
  };
  return new Error(msg[res.status] ?? `${t("errors.providerError", { provider, status: res.status })}${detail ? `: ${detail}` : ""}`);
}

function networkError(err: unknown, providerName: string): Error {
  if (err instanceof DOMException && err.name === "AbortError") return new Error(t("errors.stopped"));
  if (err instanceof TypeError) {
    return new Error(t("errors.cantReach", { provider: providerName }));
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function streamOpenAICompatible(req: StreamRequest, providerName: string): Promise<string> {
  if (!req.baseURL) throw new Error(t("errors.setAddress"));
  if (!req.model) throw new Error(t("errors.chooseModel"));

  let res: Response;
  try {
    res = await fetch(`${req.baseURL}/chat/completions`, {
      method: "POST",
      headers: headers(req.apiKey),
      body: JSON.stringify({
        model: req.model,
        stream: true,
        messages: [{ role: "system", content: req.system }, ...req.history],
      }),
      signal: req.signal,
    });
  } catch (err) {
    throw networkError(err, providerName);
  }
  if (!res.ok) throw await httpError(res, providerName, !!req.apiKey);
  if (!res.body) throw new Error(t("errors.emptyResponse", { provider: providerName }));

  let text = "";
  let finish: string | null = null;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue; // ignore comments (": keep-alive") and blank lines
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let chunk;
        try { chunk = JSON.parse(data); } catch { continue; }
        if (chunk.error) throw new Error(`${t("errors.providerError", { provider: providerName, status: "stream" })}: ${chunk.error.message ?? JSON.stringify(chunk.error)}`);
        const choice = chunk.choices?.[0];
        const delta: unknown = choice?.delta?.content;
        if (typeof delta === "string" && delta) {
          text += delta;
          req.onText(delta);
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
      }
    }
  } catch (err) {
    throw networkError(err, providerName);
  }

  if (!text && finish === "content_filter") return refusalText();
  if (!text) throw new Error(t("errors.noAnswer", { provider: providerName }));
  return text;
}

export async function listOpenAICompatibleModels(baseURL: string, apiKey: string | undefined, providerName: string): Promise<string[]> {
  if (!baseURL) throw new Error(t("errors.setAddressFirst"));
  let res: Response;
  try {
    res = await fetch(`${baseURL}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
  } catch (err) {
    throw networkError(err, providerName);
  }
  if (!res.ok) throw await httpError(res, providerName, !!apiKey);
  const body = await res.json();
  const ids: string[] = (body?.data ?? body?.models ?? [])
    .map((m: { id?: string; name?: string }) => (m.id ?? m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
  return [...new Set(ids)].sort();
}
