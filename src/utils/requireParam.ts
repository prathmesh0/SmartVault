import type { Request } from 'express';
import { ApiError } from './ApiError.js';

/**
 * Express 5 types req.params values as `string | string[]` to account for
 * repeated route segments (e.g. `:id+`). Our routes never use those, and
 * our Zod param schemas already guarantee a single string at runtime — this
 * just asserts that to TypeScript, and fails loudly if it's ever wrong.
 */
export function requireParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`Missing or invalid "${key}" parameter`);
  }
  return value;
}
