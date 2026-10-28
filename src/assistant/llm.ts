/**
 * ROCK UC FOODS - Assistant LLM Provider
 * Playbook v4 Section 19.2
 * 
 * Supports Gemini via @google/genai or Anthropic fetch fallback.
 * Returns null if ASSISTANT_ENABLED !== 'true'.
 */

import { GoogleGenAI } from '@google/genai';
import { LlmClient } from './types';

export function llmFromEnv(): LlmClient | null {
  if (process.env.ASSISTANT_ENABLED !== 'true') {
    return null;
  }

  // 1. Google GenAI (Built-in primary)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const model = process.env.ASSISTANT_MODEL || 'gemini-2.5-flash';

    return async ({ system, user }) => {
      const response = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: `${system}\n\n${user}` }] },
        ],
        config: {
          maxOutputTokens: 300,
          temperature: 0.2,
        },
      });
      return response.text ?? '';
    };
  }

  // 2. Anthropic API Key fallback
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const model = process.env.ASSISTANT_MODEL || 'claude-3-haiku-20240307';
    return async ({ system, user }) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return data.content?.[0]?.text ?? '';
    };
  }

  return null;
}
