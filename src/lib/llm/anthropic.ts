/**
 * Claude via the official Anthropic SDK. `dangerouslyAllowBrowser` is required for
 * browser use; it is appropriate here because the key belongs to the user of this
 * device (bring-your-own-key), not to us.
 */
import Anthropic from "@anthropic-ai/sdk";
import { REFUSAL_TEXT, type StreamRequest } from "./context";

/** Models that accept `effort` and server-side refusal fallbacks. Others get a plain request. */
const MODERN = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

const client = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

export async function streamAnthropic(req: StreamRequest): Promise<string> {
  const modern = MODERN.has(req.model);
  try {
    const stream = client(req.apiKey!).beta.messages.stream(
      {
        model: req.model,
        max_tokens: 64000,
        system: req.system,
        messages: req.history.map((t) => ({ role: t.role, content: t.content })),
        ...(modern && {
          output_config: { effort: "medium" as const },
          // If the model declines, the API retries on a suitable fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }),
      },
      { signal: req.signal },
    );
    stream.on("text", (delta) => req.onText(delta));
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") return REFUSAL_TEXT;
    return final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (err) {
    throw new Error(describeAnthropicError(err));
  }
}

export async function listAnthropicModels(apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  try {
    for await (const m of client(apiKey).models.list()) ids.push(m.id);
  } catch (err) {
    throw new Error(describeAnthropicError(err));
  }
  return ids;
}

function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Your Anthropic API key was rejected. Check it in Settings.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This Anthropic key doesn't have access to that model.";
  if (err instanceof Anthropic.NotFoundError) return "Anthropic doesn't recognise that model name. Pick another in Settings.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limit reached. Please wait a moment and try again.";
  if (err instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (err instanceof Anthropic.APIConnectionError) return "Can't reach Anthropic. Are you online?";
  if (err instanceof Anthropic.APIError) return `Anthropic error (${err.status ?? "unknown"}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
