import { z } from 'zod';
import { AI_CATEGORIES } from '../ai/ai.schema.js';
import type { FileStatus } from './file.model.js';

const FILE_STATUSES = [
  'QUEUED',
  'UPLOADING',
  'EXTRACTING',
  'ANALYZING',
  'COMPLETED',
  'FAILED',
] as const satisfies readonly FileStatus[];

const SORTS = ['createdAt', '-createdAt', 'size', '-size', 'originalName'] as const;

export const listFilesSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    status: z.enum(FILE_STATUSES).optional(),
    category: z.enum(AI_CATEGORIES).optional(),
    tag: z.string().trim().min(1).max(30).optional(),
    search: z.string().trim().min(1).max(200).optional(),
    sort: z.enum(SORTS).default('-createdAt'),
  }),
};

export const fileIdParamSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid file id'),
  }),
};
