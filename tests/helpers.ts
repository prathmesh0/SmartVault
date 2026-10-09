import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { FileModel, type IFile } from '../src/modules/file/file.model.js';

export const app = createApp();

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  cookies: string[];
}

export async function createUser(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? `${randomUUID()}@example.com`;
  const password = overrides.password ?? 'password123';
  const name = overrides.name ?? 'Test User';

  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password });
  if (registered.status !== 201) {
    throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  }

  const loggedIn = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (loggedIn.status !== 200) {
    throw new Error(`login failed: ${loggedIn.status} ${JSON.stringify(loggedIn.body)}`);
  }

  return {
    id: registered.body.data.user.id,
    email,
    password,
    accessToken: loggedIn.body.data.accessToken,
    cookies: loggedIn.headers['set-cookie'] as unknown as string[],
  };
}

export function bearer(user: TestUser): string {
  return `Bearer ${user.accessToken}`;
}

export function createFileDoc(owner: string, overrides: Partial<IFile> = {}) {
  return FileModel.create({
    owner,
    originalName: 'document.txt',
    mimeType: 'text/plain',
    size: 128,
    status: 'COMPLETED',
    progress: 100,
    ...overrides,
  });
}
