/**
 * Any OpenAI-compatible chat-completions API (OpenAI, DeepSeek, Gemini, OpenRouter,
 * Groq, Mistral, Ollama, custom). Plain fetch with only standard headers
 * (Authorization, Content-Type): some providers' CORS rules reject extra SDK headers.
 */
import { REFUSAL_TEXT, type StreamRequest } from "./context";

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
  const msg: Record<number, string> = {
    401: hadKey ? `Your ${providerName} API key was rejected. Check it in Settings.` : `${providerName} needs an API key. Add one in Settings.`,
    402: `Your ${providerName} account is out of credit.`,
    403: `This ${providerName} key isn't allowed to use that model.`,
    404: `${providerName} doesn't recognise that model name. Pick another in Settings.`,
    429: "Rate limit reached. Please wait a moment and try again.",
  };
  return new Error(msg[res.status] ?? `${providerName} error (${res.status})${detail ? `: ${detail}` : ""}`);
}

function networkError(err: unknown, providerName: string): Error {
  if (err instanceof DOMException && err.name === "AbortError") return new Error("Stopped.");
  if (err instanceof TypeError) {
    return new Error(`Can't reach ${providerName}. Check you're online and the address is right. Local and custom servers must allow requests from this app (CORS).`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function streamOpenAICompatible(req: StreamRequest, providerName: string): Promise<string> {
  if (!req.baseURL) throw new Error("Set the server address for this provider in Settings.");
  if (!req.model) throw new Error("Choose a model for this provider in Settings.");

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
  if (!res.body) throw new Error(`${providerName} returned an empty response.`);

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
        if (chunk.error) throw new Error(`${providerName} error: ${chunk.error.message ?? JSON.stringify(chunk.error)}`);
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

  if (!text && finish === "content_filter") return REFUSAL_TEXT;
  if (!text) throw new Error(`${providerName} returned no answer. Try again or pick another model.`);
  return text;
}

export async function listOpenAICompatibleModels(baseURL: string, apiKey: string | undefined, providerName: string): Promise<string[]> {
  if (!baseURL) throw new Error("Set the server address first.");
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
