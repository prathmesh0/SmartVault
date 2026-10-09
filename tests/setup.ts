import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll } from 'vitest';

// These must be set *before* anything imports src/config/env.ts, which
// validates the environment at import time and exits on failure. Vitest runs
// this setup file to completion before evaluating a test file, so the static
// imports in the test file see these values.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.CORS_ORIGINS = 'http://localhost:3000';

// Start an in-memory MongoDB and point the app at it. Top-level await means
// the URI is in place before env.ts is ever imported.
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri();

await mongoose.connect(process.env.MONGODB_URI);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
