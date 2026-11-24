/**
 * Claude via the official Anthropic SDK. `dangerouslyAllowBrowser` is required for
 * browser use; it is appropriate here because the key belongs to the user of this
 * device (bring-your-own-key), not to us.
 */
import Anthropic from "@anthropic-ai/sdk";
import { refusalText, type StreamRequest } from "./context";
import { t } from "../../i18n";

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
    if (final.stop_reason === "refusal") return refusalText();
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
  const provider = "Anthropic";
  if (err instanceof Anthropic.AuthenticationError) return t("errors.keyRejected", { provider });
  if (err instanceof Anthropic.PermissionDeniedError) return t("errors.noModelAccess", { provider });
  if (err instanceof Anthropic.NotFoundError) return t("errors.unknownModel", { provider });
  if (err instanceof Anthropic.RateLimitError) return t("errors.rateLimit");
  if (err instanceof Anthropic.APIUserAbortError) return t("errors.stopped");
  if (err instanceof Anthropic.APIConnectionError) return t("errors.cantReach", { provider });
  if (err instanceof Anthropic.APIError) return `${t("errors.providerError", { provider, status: err.status ?? "?" })}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
