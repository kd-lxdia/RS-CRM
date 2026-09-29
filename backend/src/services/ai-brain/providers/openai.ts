import axios from 'axios';
import { ProviderAdapter } from '../types';

// OpenAI Chat Completions (also the shape OpenRouter uses).
export const openaiAdapter: ProviderAdapter = async (messages, cfg, opts) => {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: cfg.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    },
    {
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    },
  );
  return { text: data.choices?.[0]?.message?.content ?? '', model: cfg.model };
};
