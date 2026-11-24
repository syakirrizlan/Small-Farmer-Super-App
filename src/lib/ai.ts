/**
 * AI assistant — calls Claude directly from the device with the user's own key.
 * Uses the official Anthropic SDK. `dangerouslyAllowBrowser` is required for
 * browser use; it is appropriate here because the key belongs to the user
 * of this device (bring-your-own-key), not to us.
 */
import Anthropic from "@anthropic-ai/sdk";
import { useKey } from "./vault";
import { db } from "../db/db";
import { MODULES } from "../db/modules";

export const MODEL = "claude-opus-5-5";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are a friendly, practical farm assistant inside the "Small Farmer Super App".
You help a small-scale farmer plan, track and improve everything on their farm: crops, livestock,
tasks, inventory and money. Use the farm snapshot below when it is relevant, say so when data is
missing, and keep answers short, concrete and easy to act on in the field. If something could
harm people, animals or crops (chemicals, dosages, disease), recommend confirming with a local
agricultural extension officer or vet.`;

/** Compact snapshot of the farm's records, capped per module so the prompt stays small. */
async function farmSnapshot(maxPerModule = 25) {
  const parts: string[] = [];
  for (const m of MODULES) {
    const rows = await db.records(m.id).orderBy("updatedAt").reverse().limit(maxPerModule).toArray();
    const total = await db.records(m.id).count();
    const slim = rows.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest);
    parts.push(`## ${m.title} (${total} total${total > maxPerModule ? `, latest ${maxPerModule} shown` : ""})\n${JSON.stringify(slim)}`);
  }
  return `Today is ${new Date().toISOString().slice(0, 10)}.\n\n# Farm snapshot\n${parts.join("\n\n")}`;
}

export async function streamChat(
  history: ChatTurn[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const client = new Anthropic({ apiKey: useKey(), dangerouslyAllowBrowser: true });
  const snapshot = await farmSnapshot();

  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        // Server-side fallback: if the model declines, the API retries on a suitable model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: snapshot },
        ],
        messages: history.map((t) => ({ role: t.role, content: t.content })),
      },
      { signal },
    );

    stream.on("text", (delta) => onText(delta));
    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      return "Sorry — I can't help with that request. Try rephrasing, or ask about something else on your farm.";
    }
    return final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (err) {
    throw new Error(describeError(err));
  }
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Your API key was rejected. Check it in Settings.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key doesn't have access to that model.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limit reached. Please wait a moment and try again.";
  if (err instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (err instanceof Anthropic.APIConnectionError) return "Can't reach the AI service. Are you online?";
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status ?? "unknown"}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
