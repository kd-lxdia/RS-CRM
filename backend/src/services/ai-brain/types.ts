// AI Brain shared types.

export type BrainProvider = 'openai' | 'claude' | 'gemini' | 'openrouter';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BrainRequest {
  /** What this call is for, e.g. "report", "b2b_pi", "chat". Used for logging + self-learning. */
  feature: string;
  messages: ChatMessage[];
  /** Optional JSON mode — asks the model to return strict JSON. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Gemini thinking-token budget. Defaults to 0 (off) to avoid output truncation. */
  thinkingBudget?: number;
  /** User id for audit. */
  userId?: string;
}

export interface BrainResponse {
  text: string;
  provider: BrainProvider;
  model: string;
  latencyMs: number;
  logId?: string;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
}

/** Result of a single provider attempt. */
export interface ProviderResult {
  text: string;
  model: string;
}

/** A provider adapter: given messages + config, return the completion text. */
export type ProviderAdapter = (
  messages: ChatMessage[],
  cfg: ProviderConfig,
  opts: { json?: boolean; temperature?: number; maxTokens?: number; thinkingBudget?: number },
) => Promise<ProviderResult>;
