import axios from 'axios';
import { ProviderAdapter, ChatMessage } from '../types';

// Anthropic Claude Messages API. System messages are passed via the top-level
// `system` field; only user/assistant turns go in `messages`.
export const claudeAdapter: ProviderAdapter = async (messages, cfg, opts) => {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages
    .filter((m: ChatMessage) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.4,
      ...(system ? { system } : {}),
      messages: turns,
    },
    {
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    },
  );
  const text = Array.isArray(data.content)
    ? data.content.map((b: any) => b.text ?? '').join('')
    : '';
  return { text, model: cfg.model };
};
