import axios from 'axios';
import { ProviderAdapter } from '../types';

// Google Gemini generateContent API. Maps chat roles to Gemini's user/model
// roles and folds any system messages into a systemInstruction.
export const geminiAdapter: ProviderAdapter = async (messages, cfg, opts) => {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  const { data } = await axios.post(
    url,
    {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 1500,
        // Gemini 2.5+/3 "thinking" models spend maxOutputTokens on hidden
        // reasoning first, which truncates the visible answer (finishReason
        // MAX_TOKENS). Disable thinking by default so the full token budget
        // goes to output — CRM tasks (structured JSON, reports) don't need it.
        thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
  );
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  return { text, model: cfg.model };
};
