import type { FileStatus } from '../file/file.model.js';

export interface ServerToClientEvents {
  'file:status': (payload: {
    fileId: string;
    status: FileStatus;
    progress: number;
    message?: string;
  }) => void;
  'file:completed': (payload: {
    fileId: string;
    ai: { summary: string; category: string; tags: string[] };
  }) => void;
  'file:failed': (payload: { fileId: string; failedStage: string; error: string }) => void;
}

// The client never emits anything at us in this project — no chat, no
// typed request/response over the socket — so this stays empty. It's kept
// as its own type because Socket.IO's generics require one, and it
// documents that this direction is deliberately unused.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
