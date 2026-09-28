import type { Response } from 'express';

interface SendOptions {
  status?: number;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(res: Response, data: T, options: SendOptions = {}): Response {
  return res.status(options.status ?? 200).json({
    success: true,
    data,
    ...(options.meta && { meta: options.meta }),
  });
}
