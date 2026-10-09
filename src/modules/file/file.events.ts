import { EventEmitter } from 'node:events';
import type { FileStatus } from './file.model.js';

interface StatusEventPayload {
  ownerId: string;
  fileId: string;
  status: FileStatus;
  progress: number;
  message?: string;
}

interface CompletedEventPayload {
  ownerId: string;
  fileId: string;
  ai: { summary: string; category: string; tags: string[] };
}

interface FailedEventPayload {
  ownerId: string;
  fileId: string;
  failedStage: string;
  error: string;
}

interface FileEventMap {
  status: [StatusEventPayload];
  completed: [CompletedEventPayload];
  failed: [FailedEventPayload];
}

/**
 * A plain Node EventEmitter, typed so `emit('status', ...)` and
 * `on('status', ...)` are checked at compile time against FileEventMap.
 * Deliberately has ZERO knowledge of Socket.IO — see the "event-driven
 * decoupling" note in the phase explanation.
 */
class TypedFileEventEmitter extends EventEmitter {
  emit<K extends keyof FileEventMap>(event: K, ...args: FileEventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof FileEventMap>(event: K, listener: (...args: FileEventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
}

export const fileEvents = new TypedFileEventEmitter();
export type { StatusEventPayload, CompletedEventPayload, FailedEventPayload };
