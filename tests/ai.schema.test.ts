import { describe, expect, it } from 'vitest';
import { aiAnalysisSchema } from '../src/modules/ai/ai.schema.js';

describe('FR-04 AI output schema', () => {
  it('accepts a well-formed AI response', () => {
    const result = aiAnalysisSchema.safeParse({
      summary: 'A short summary.',
      category: 'Resume',
      tags: ['node', 'backend', 'typescript'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = aiAnalysisSchema.safeParse({
      summary: 'x',
      category: 'Random',
      tags: ['a', 'b', 'c'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects too few or too many tags', () => {
    const tooFew = aiAnalysisSchema.safeParse({
      summary: 'x',
      category: 'Notes',
      tags: ['only-one'],
    });
    expect(tooFew.success).toBe(false);

    const tooMany = aiAnalysisSchema.safeParse({
      summary: 'x',
      category: 'Notes',
      tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(tooMany.success).toBe(false);
  });

  it('rejects an over-long tag and empty summary', () => {
    const longTag = aiAnalysisSchema.safeParse({
      summary: 'x',
      category: 'Other',
      tags: ['a'.repeat(31), 'b', 'c'],
    });
    expect(longTag.success).toBe(false);

    const emptySummary = aiAnalysisSchema.safeParse({
      summary: '',
      category: 'Other',
      tags: ['a', 'b', 'c'],
    });
    expect(emptySummary.success).toBe(false);
  });
});
