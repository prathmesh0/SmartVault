import { pino } from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      // credentials in transit
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      // credentials / secrets that might end up in a log payload
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      'req.body.password',
      // never log document contents, even accidentally
      '*.extractedText',
      'req.body.extractedText',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
