import Groq from 'groq-sdk';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
  REPAIR_INSTRUCTION,
} from './ai.prompts.js';
import { aiAnalysisSchema } from './ai.schema.js';
import type { AnalyzeDocumentResult } from './ai.types.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function callGroq(messages: ChatMessage[]): Promise<string> {
  try {
    const completion = await groq.chat.completions.create(
      {
        model: env.AI_MODEL,
        messages,
        temperature: 0.2, // low temperature — we want consistent, predictable output, not creativity
        max_tokens: 500,
        response_format: { type: 'json_object' },
      },
      { timeout: env.AI_TIMEOUT_MS },
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI provider');
    return content;
  } catch (err) {
    logger.error({ err }, 'Groq API call failed');
    throw ApiError.serviceUnavailable('AI provider is currently unavailable');
  }
}

/** Parses + validates one AI response. Returns null (never throws) if it's bad — the caller decides what to do about that. */
function tryParseAndValidate(raw: string): AiAnalysisResult | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = aiAnalysisSchema.safeParse(json);
  if (!result.success) {
    logger.warn({ issues: result.error.issues }, 'AI output failed schema validation');
    return null;
  }

  // Normalize tags: trim, lowercase, de-duplicate. The model might return
  // "Node.js" and "node.js" as two separate tags — this cleans that up.
  const tags = [...new Set(result.data.tags.map((tag) => tag.trim().toLowerCase()))];

  return { ...result.data, tags };
}

type AiAnalysisResult = { summary: string; category: string; tags: string[] };

export const aiService = {
  async analyzeDocument(rawText: string): Promise<AnalyzeDocumentResult> {
    const truncated = rawText.slice(0, env.AI_MAX_INPUT_CHARS);

    const messages: ChatMessage[] = [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: buildAnalysisUserMessage(truncated) },
    ];

    const firstRaw = await callGroq(messages);
    const firstResult = tryParseAndValidate(firstRaw);
    if (firstResult) return { ...firstResult, model: env.AI_MODEL };

    logger.warn('AI output invalid on first attempt — retrying once with a repair instruction');

    const repairMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: firstRaw },
      { role: 'user', content: REPAIR_INSTRUCTION },
    ];

    const secondRaw = await callGroq(repairMessages);
    const secondResult = tryParseAndValidate(secondRaw);
    if (secondResult) return { ...secondResult, model: env.AI_MODEL };

    throw ApiError.serviceUnavailable('AI provider returned an invalid response after a retry');
  },
};
