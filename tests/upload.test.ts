import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app, bearer, createUser } from './helpers.js';

// The pipeline runs fire-and-forget after the 202 response and would call
// Cloudinary + Groq. Replace it with a no-op so these tests stay offline and
// focused on upload validation.
vi.mock('../src/modules/file/file.pipeline.js', () => ({
  filePipeline: {
    run: vi.fn().mockResolvedValue(undefined),
    retryAnalysis: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('FR-02 upload validation', () => {
  it('accepts a valid txt file and returns 202 with QUEUED status', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(user))
      .attach('file', Buffer.from('hello smartvault, this is plain text'), 'notes.txt');

    expect(res.status).toBe(202);
    expect(res.body.data.file.status).toBe('QUEUED');
    expect(res.body.data.file.progress).toBe(5);
    expect(res.body.data.file.id).toBeDefined();
  });

  it('rejects a binary file renamed to .pdf (magic-byte check)', async () => {
    const user = await createUser();

    // MZ header (a Windows executable) with a null byte and invalid UTF-8.
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]);

    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(user))
      .attach('file', exe, 'malware.pdf');

    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
  });

  it('rejects a disallowed extension', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(user))
      .attach('file', Buffer.from('not really an image'), 'picture.png');

    expect(res.status).toBe(415);
  });

  it('rejects files over the 5MB limit with 413', async () => {
    const user = await createUser();

    const tooBig = Buffer.alloc(6 * 1024 * 1024, 0x61); // 6MB of "a"

    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(user))
      .attach('file', tooBig, 'big.txt');

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });
});
