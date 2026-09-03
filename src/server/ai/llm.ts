// The operator's language model, behind one OpenAI-compatible client.
//
// Every provider worth using speaks the Chat Completions shape, so the app
// carries no vendor SDK. Pick a provider with AI_PROVIDER and supply its key;
// NVIDIA NIM and OpenRouter both hand out free keys, Groq is free-tier, and
// Ollama or LM Studio run on a laptop with no key at all. With nothing
// configured the driver is `log`, and every caller falls back to its
// deterministic template, so the app never depends on a model being up.

export type EnvLike = Record<string, string | undefined>;

export type AiProvider = "nvidia" | "openrouter" | "groq" | "ollama" | "custom";

export interface LlmConfig {
  driver: "log" | "openai";
  provider: AiProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

/** Base URLs and a sensible default model per provider. Override with AI_BASE_URL / AI_MODEL. */
export const PROVIDER_PRESETS: Record<AiProvider, { baseUrl: string; model: string; needsKey: boolean }> = {
  nvidia: { baseUrl: "https://integrate.api.nvidia.com/v1", model: "meta/llama-3.3-70b-instruct", needsKey: true },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", needsKey: true },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", needsKey: true },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2", needsKey: false },
  custom: { baseUrl: "", model: "", needsKey: false },
};

function isProvider(value: string | undefined): value is AiProvider {
  return value !== undefined && Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, value);
}

export function llmConfig(env: EnvLike = process.env): LlmConfig {
  const provider = isProvider(env.AI_PROVIDER) ? env.AI_PROVIDER : "custom";
  const preset = PROVIDER_PRESETS[provider];
  const baseUrl = (env.AI_BASE_URL || preset.baseUrl).replace(/\/+$/, "");
  const model = env.AI_MODEL || preset.model;
  const apiKey = env.AI_API_KEY || undefined;
  const ready = Boolean(baseUrl && model && (apiKey || !preset.needsKey));
  return { driver: ready ? "openai" : "log", provider, baseUrl, apiKey, model };
}

export function isLlmEnabled(env: EnvLike = process.env): boolean {
  return llmConfig(env).driver === "openai";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** Ask for a JSON object; the caller still validates the shape. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  env?: EnvLike;
}

export interface ChatResult {
  text: string;
  model: string;
  provider: AiProvider;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export class LlmUnavailableError extends Error {
  constructor(message = "No language model is configured: set AI_PROVIDER and AI_API_KEY.") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

/** One chat completion. Throws LlmUnavailableError under the log driver. */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
  const env = options.env ?? process.env;
  const config = llmConfig(env);
  if (config.driver !== "openai") throw new LlmUnavailableError();

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = env.APP_URL || "https://estatecrm.local";
      headers["X-OpenRouter-Title"] = "EstateCRM Studio";
    }
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1200,
    };
    if (options.json) body.response_format = { type: "json_object" };

    const response = await doFetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`${config.provider} returned ${response.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = data.choices?.[0]?.message?.content;
    const text = Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : (raw ?? "");
    if (!text.trim()) throw new Error(`${config.provider} returned an empty completion.`);
    return {
      text,
      model: data.model ?? config.model,
      provider: config.provider,
      usage: { promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pull a JSON object out of a completion. Models that ignore response_format
 * wrap JSON in prose or code fences; take the outermost braces.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.replace(/```(?:json)?/gi, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in completion.");
  return JSON.parse(trimmed.slice(start, end + 1));
}
