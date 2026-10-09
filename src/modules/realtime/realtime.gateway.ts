import type { Server as HttpServer } from 'node:http';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './realtime.types.js';
import { Server } from 'socket.io';
import { env } from '../../config/env.js';
import { Socket } from 'node:dgram';
import { verifyAccessToken } from '../../utils/jwt.js';
import { logger } from '../../utils/logger.js';
import { fileEvents } from '../file/file.events.js';

export function initRealtimeGateway(
  httpsServer: HttpServer,
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpsServer,
    {
      cors: { origin: env.CORS_ORIGINS, credentials: true },
    },
  );

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const room = `user:${socket.data.userId}`;
    socket.join(room);
    logger.info({ userId: socket.data.userId, socketId: socket.id }, 'Socket connected');

    socket.on('disconnect', () => {
      logger.info({ userId: socket.data.userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  fileEvents.on('status', ({ ownerId, fileId, status, progress, message }) => {
    io.to(`user:${ownerId}`).emit('file:status', { fileId, status, progress, message });
  });

  fileEvents.on('completed', ({ ownerId, fileId, ai }) => {
    io.to(`user:${ownerId}`).emit('file:completed', { fileId, ai });
  });

  fileEvents.on('failed', ({ ownerId, fileId, failedStage, error }) => {
    io.to(`user:${ownerId}`).emit('file:failed', { fileId, failedStage, error });
  });

  return io;
}
