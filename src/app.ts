import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/notFound.middleware.js';
import { generalLimiter } from './middlewares/rateLimit.middleware.js';
import routes from './routes.js';
import { sendSuccess } from './utils/apiResponse.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );

  app.use(
    helmet({
      // The default CSP blocks inline <script> tags and third-party CDN
      // scripts — good for a real frontend, but it would break our plain
      // public/test-client.html, which uses both. This is a scoped,
      // deliberate relaxation for that one throwaway dev page — a real
      // frontend app should NOT need 'unsafe-inline'.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.socket.io'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
        },
      },
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // Serves public/test-client.html at http://localhost:5000/test-client.html
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1', generalLimiter, routes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
