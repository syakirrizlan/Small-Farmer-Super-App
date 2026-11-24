/**
 * AI provider registry. The farmer picks any of these — no lock-in to one ecosystem.
 *
 * kind "anthropic"          → official Anthropic SDK (Claude)
 * kind "openai-compatible"  → plain fetch to POST {baseURL}/chat/completions (streaming SSE).
 *                             Covers OpenAI, DeepSeek, Gemini (OpenAI endpoint), OpenRouter,
 *                             Groq, Mistral, local Ollama and any custom compatible server.
 *
 * The CSP in index.html allows any https host plus http://localhost / 127.0.0.1.
 */
export type ProviderKind = "anthropic" | "openai-compatible";

export interface ProviderDef {
  id: string;
  name: string;
  kind: ProviderKind;
  baseURL: string;
  defaultModel: string;
  suggestedModels: string[];
  keyRequired: boolean;
  keyPlaceholder: string;
  keyUrl?: string; // where to get a key
  note?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    kind: "anthropic",
    baseURL: "https://api.anthropic.com",
    defaultModel: "claude-opus-5-5",
    suggestedModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    keyRequired: true,
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "openai-compatible",
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
    keyRequired: true,
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai-compatible",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
    suggestedModels: ["gpt-5", "gpt-5-mini"],
    keyRequired: true,
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "openai-compatible",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    suggestedModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    keyRequired: true,
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openrouter",
    name: "OpenRouter (many models)",
    kind: "openai-compatible",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-chat",
    suggestedModels: ["deepseek/deepseek-chat", "anthropic/claude-sonnet-5-5", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"],
    keyRequired: true,
    keyPlaceholder: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    note: "One key, hundreds of models from many companies.",
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai-compatible",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    suggestedModels: ["llama-3.3-70b-versatile"],
    keyRequired: true,
    keyPlaceholder: "gsk_…",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "openai-compatible",
    baseURL: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    suggestedModels: ["mistral-small-latest", "mistral-large-latest"],
    keyRequired: true,
    keyPlaceholder: "…",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "ollama",
    name: "Ollama (on this computer)",
    kind: "openai-compatible",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    suggestedModels: ["llama3.2", "qwen2.5", "gemma3"],
    keyRequired: false,
    keyPlaceholder: "(not needed)",
    note: "Free and private: runs on your own machine. Start Ollama with OLLAMA_ORIGINS set to this app's address.",
  },
  {
    id: "custom",
    name: "Other (OpenAI-compatible)",
    kind: "openai-compatible",
    baseURL: "",
    defaultModel: "",
    suggestedModels: [],
    keyRequired: false,
    keyPlaceholder: "optional",
    note: "Any server that speaks the OpenAI chat-completions format (LM Studio, Together, vLLM, …). Use an https:// address, or http:// for a server on this computer.",
  },
];

export const DEFAULT_PROVIDER = "anthropic";
export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id);
