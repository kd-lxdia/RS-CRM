import axios from 'axios';
import { ProviderAdapter } from '../types';

// OpenRouter — OpenAI-compatible, gives access to 100+ models via one key.
export const openrouterAdapter: ProviderAdapter = async (messages, cfg, opts) => {
  const { data } = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: cfg.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'SLAR CRM AI Brain',
      },
      timeout: 60000,
    },
  );
  return { text: data.choices?.[0]?.message?.content ?? '', model: cfg.model };
};
