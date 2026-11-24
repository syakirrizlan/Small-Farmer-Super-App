/**
 * AI router — sends the chat to whichever provider the farmer picked in Settings.
 * Provider code is loaded on demand so unused SDKs never download.
 */
import { getAiSettings, resolve } from "./settings";
import { getProviderKey, peekProviderKey } from "./vault";
import { SYSTEM, farmSnapshot, type ChatTurn } from "./llm/context";
import type { ProviderDef } from "./providers";

export type { ChatTurn };

function keyFor(provider: ProviderDef): string | undefined {
  return provider.keyRequired ? getProviderKey(provider.id) : peekProviderKey(provider.id);
}

export async function streamChat(history: ChatTurn[], onText: (delta: string) => void, signal?: AbortSignal): Promise<string> {
  const { provider, model, baseURL } = resolve(await getAiSettings());
  const apiKey = keyFor(provider);
  const system = `${SYSTEM}\n\n${await farmSnapshot()}`;
  const req = { model, baseURL, apiKey, system, history, onText, signal };

  if (provider.kind === "anthropic") {
    const { streamAnthropic } = await import("./llm/anthropic");
    return streamAnthropic(req);
  }
  const { streamOpenAICompatible } = await import("./llm/openaiCompat");
  return streamOpenAICompatible(req, provider.name);
}

/** Ask the provider which models this key can use. */
export async function listModels(provider: ProviderDef, baseURL: string): Promise<string[]> {
  const apiKey = keyFor(provider);
  if (provider.kind === "anthropic") {
    const { listAnthropicModels } = await import("./llm/anthropic");
    return listAnthropicModels(apiKey!);
  }
  const { listOpenAICompatibleModels } = await import("./llm/openaiCompat");
  return listOpenAICompatibleModels(baseURL, apiKey, provider.name);
}
