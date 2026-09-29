import { prisma } from '../../lib/clients';
import { BrainProvider, BrainRequest, BrainResponse, ChatMessage, ProviderAdapter } from './types';
import { getBrainConfig, providerTryOrder, resolveApiKey } from './config';
import { openaiAdapter } from './providers/openai';
import { claudeAdapter } from './providers/claude';
import { geminiAdapter } from './providers/gemini';
import { openrouterAdapter } from './providers/openrouter';

const ADAPTERS: Record<BrainProvider, ProviderAdapter> = {
  openai: openaiAdapter,
  claude: claudeAdapter,
  gemini: geminiAdapter,
  openrouter: openrouterAdapter,
};

/**
 * Self-learning: pull recent human feedback for this feature and turn it into a
 * system message. Down-voted answers (with corrections) become "avoid this"
 * guidance; up-voted answers become positive exemplars. This improves output
 * over time without any fine-tuning.
 */
async function buildLearningContext(feature: string): Promise<ChatMessage | null> {
  const [corrections, goodOnes] = await Promise.all([
    prisma.aiBrainLog.findMany({
      where: { feature, rating: -1, correction: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.aiBrainLog.findMany({
      where: { feature, rating: 1 },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  if (corrections.length === 0 && goodOnes.length === 0) return null;

  let text = 'You are continuously improving from human feedback on past answers for this task.\n';
  if (corrections.length) {
    text += '\nAvoid the mistakes below — for each, a human marked the answer wrong and gave the correct version:\n';
    corrections.forEach((c, i) => {
      text += `\n[${i + 1}] Previously wrong: ${c.response.slice(0, 400)}\n    Corrected to: ${c.correction}\n`;
    });
  }
  if (goodOnes.length) {
    text += '\nThese answers were rated good — match their style and accuracy:\n';
    goodOnes.forEach((g, i) => {
      text += `\n[${i + 1}] ${g.response.slice(0, 300)}\n`;
    });
  }
  return { role: 'system', content: text };
}

/**
 * Main entry point. Tries the configured primary provider, falls back through
 * the rest on failure, injects self-learning context, and logs every call.
 */
export async function runBrain(req: BrainRequest): Promise<BrainResponse> {
  const cfg = await getBrainConfig();
  const order = providerTryOrder(cfg);

  const learning = await buildLearningContext(req.feature);
  const messages = learning ? [learning, ...req.messages] : req.messages;

  const errors: string[] = [];
  const missingKey: string[] = [];

  for (const provider of order) {
    const apiKey = resolveApiKey(provider, cfg);
    if (!apiKey) {
      missingKey.push(provider);
      continue;
    }
    const model = cfg.providers[provider].model;
    const started = Date.now();
    try {
      const result = await ADAPTERS[provider](messages, { apiKey, model }, {
        json: req.json,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        thinkingBudget: req.thinkingBudget,
      });
      const latencyMs = Date.now() - started;
      const log = await prisma.aiBrainLog.create({
        data: {
          feature: req.feature,
          provider,
          model: result.model,
          prompt: JSON.stringify(req.messages).slice(0, 8000),
          response: result.text,
          success: true,
          latencyMs,
          createdBy: req.userId,
        },
      });
      return { text: result.text, provider, model: result.model, latencyMs, logId: log.id };
    } catch (err: any) {
      const latencyMs = Date.now() - started;
      const msg = `${provider}: ${err?.response?.data?.error?.message || err?.message || 'unknown error'}`;
      errors.push(msg);
      await prisma.aiBrainLog.create({
        data: {
          feature: req.feature,
          provider,
          model,
          prompt: JSON.stringify(req.messages).slice(0, 8000),
          response: '',
          success: false,
          errorMsg: msg.slice(0, 1000),
          latencyMs,
          createdBy: req.userId,
        },
      }).catch(() => undefined);
      // fall through to next provider
    }
  }

  // Prefer real provider errors; only fall back to "no key" info if nothing was tried.
  const detail = errors.length
    ? errors.join(' | ')
    : missingKey.length
      ? `No API key configured for: ${missingKey.join(', ')}. Add a key in AI Brain settings.`
      : 'no provider available';
  throw new Error(`AI Brain failed. ${detail}`);
}

/** Record human feedback on a past answer — powers the self-learning loop. */
export async function recordFeedback(logId: string, rating: 1 | -1, correction?: string): Promise<void> {
  await prisma.aiBrainLog.update({
    where: { id: logId },
    data: { rating, correction: correction ?? null },
  });
}
