import { z } from 'zod';

export const AI_CATEGORIES = [
  'Resume',
  'Invoice',
  'Contract',
  'Report',
  'Notes',
  'Technical',
  'Other',
] as const;

export const aiAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  category: z.enum(AI_CATEGORIES),
  tags: z.array(z.string().trim().min(1).max(30)).min(3).max(6),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
