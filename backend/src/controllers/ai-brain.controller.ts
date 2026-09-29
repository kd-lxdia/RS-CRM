import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { runBrain, recordFeedback } from '../services/ai-brain/AIBrain';
import { getBrainConfig, saveBrainConfig, maskConfig, BrainConfig } from '../services/ai-brain/config';

// POST /api/ai-brain/complete — generic multi-LLM completion.
export const complete = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { feature, messages, prompt, json, temperature, maxTokens } = req.body;
    const msgs = messages ?? (prompt ? [{ role: 'user', content: prompt }] : null);
    if (!msgs) {
      return res.status(400).json({ success: false, error: { message: 'Provide `messages` or `prompt`.' } });
    }
    const result = await runBrain({
      feature: feature || 'chat',
      messages: msgs,
      json,
      temperature,
      maxTokens,
      userId: req.user?.id,
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: { message: err?.message || 'AI Brain error' } });
  }
};

// GET /api/ai-brain/config — masked config for the settings UI.
export const getConfig = async (_req: AuthenticatedRequest, res: Response) => {
  const cfg = await getBrainConfig();
  return res.json({ success: true, data: maskConfig(cfg) });
};

// PUT /api/ai-brain/config — update provider selection / keys / models.
export const putConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const current = await getBrainConfig();
    const incoming = req.body as Partial<BrainConfig>;
    const merged: BrainConfig = {
      primary: incoming.primary ?? current.primary,
      fallbackOrder: incoming.fallbackOrder ?? current.fallbackOrder,
      providers: { ...current.providers, ...(incoming.providers || {}) },
    };
    // Preserve existing saved keys when the UI sends back a blank (masked) key.
    for (const p of Object.keys(merged.providers) as (keyof BrainConfig['providers'])[]) {
      if (!merged.providers[p].apiKey && current.providers[p]?.apiKey) {
        merged.providers[p].apiKey = current.providers[p].apiKey;
      }
    }
    await saveBrainConfig(merged, req.user?.id);
    return res.json({ success: true, data: maskConfig(merged) });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Invalid config' } });
  }
};

// POST /api/ai-brain/feedback — thumbs up/down (+ optional correction).
export const feedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logId, rating, correction } = req.body;
    if (!logId || (rating !== 1 && rating !== -1)) {
      return res.status(400).json({ success: false, error: { message: 'logId and rating (1 or -1) required.' } });
    }
    await recordFeedback(logId, rating, correction);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Could not record feedback' } });
  }
};
