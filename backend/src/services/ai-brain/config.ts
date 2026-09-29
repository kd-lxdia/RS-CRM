import { prisma } from '../../lib/clients';
import { BrainProvider } from './types';

const SETTING_KEY = 'ai_brain_config';

export interface BrainConfig {
  primary: BrainProvider;
  fallbackOrder: BrainProvider[];
  providers: Record<BrainProvider, { apiKey: string; model: string }>;
}

// Defaults. API keys left blank here fall back to env vars at call time, so the
// system works out of the box with the OpenRouter key already in .env.
const DEFAULT_CONFIG: BrainConfig = {
  primary: 'openrouter',
  fallbackOrder: ['openrouter', 'openai', 'claude', 'gemini'],
  providers: {
    openai: { apiKey: '', model: 'gpt-4o' },
    claude: { apiKey: '', model: 'claude-sonnet-5' },
    gemini: { apiKey: '', model: 'gemini-2.0-flash' },
    openrouter: { apiKey: '', model: 'openai/gpt-4o-mini' },
  },
};

const ENV_KEYS: Record<BrainProvider, string> = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export async function getBrainConfig(): Promise<BrainConfig> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return DEFAULT_CONFIG;
  try {
    const saved = JSON.parse(row.value) as Partial<BrainConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      providers: { ...DEFAULT_CONFIG.providers, ...(saved.providers || {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveBrainConfig(cfg: BrainConfig, updatedBy?: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(cfg), updatedBy },
    create: { key: SETTING_KEY, value: JSON.stringify(cfg), updatedBy },
  });
}

/** Resolve the effective API key for a provider: saved config, else env var. */
export function resolveApiKey(provider: BrainProvider, cfg: BrainConfig): string {
  return cfg.providers[provider]?.apiKey?.trim() || process.env[ENV_KEYS[provider]] || '';
}

/** Ordered list of providers to try: primary first, then the rest of fallbackOrder. */
export function providerTryOrder(cfg: BrainConfig): BrainProvider[] {
  const seen = new Set<BrainProvider>();
  const order: BrainProvider[] = [];
  for (const p of [cfg.primary, ...cfg.fallbackOrder]) {
    if (!seen.has(p)) {
      seen.add(p);
      order.push(p);
    }
  }
  return order;
}

/** Config safe to send to the frontend — API keys masked. */
export function maskConfig(cfg: BrainConfig) {
  const providers: any = {};
  for (const [k, v] of Object.entries(cfg.providers)) {
    const key = resolveApiKey(k as BrainProvider, cfg);
    providers[k] = { model: v.model, hasKey: !!key, keyPreview: key ? key.slice(0, 6) + '…' : '' };
  }
  return { primary: cfg.primary, fallbackOrder: cfg.fallbackOrder, providers };
}
