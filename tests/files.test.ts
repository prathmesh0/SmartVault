import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, bearer, createFileDoc, createUser } from './helpers.js';

const ai = (summary: string, category: string, tags: string[]) => ({
  summary,
  category,
  tags,
  model: 'test-model',
  processedAt: new Date(),
});

describe('ownership (IDOR protection)', () => {
  it("returns 404 when a user touches another user's file", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const file = await createFileDoc(alice.id, { originalName: 'secret.txt' });

    const get = await request(app)
      .get(`/api/v1/files/${file._id.toString()}`)
      .set('Authorization', bearer(bob));
    expect(get.status).toBe(404);

    const del = await request(app)
      .delete(`/api/v1/files/${file._id.toString()}`)
      .set('Authorization', bearer(bob));
    expect(del.status).toBe(404);

    // and it is not visible in bob's listing
    const list = await request(app).get('/api/v1/files').set('Authorization', bearer(bob));
    expect(list.body.data.files).toHaveLength(0);
  });

  it("scopes listings to the owner's own files", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await createFileDoc(alice.id);
    await createFileDoc(bob.id);
    await createFileDoc(bob.id);

    const aliceList = await request(app).get('/api/v1/files').set('Authorization', bearer(alice));
    expect(aliceList.body.data.files).toHaveLength(1);
    expect(aliceList.body.meta.total).toBe(1);
  });
});

describe('FR-06 list filters + pagination', () => {
  it('filters by status, category, tag and search', async () => {
    const user = await createUser();
    await createFileDoc(user.id, {
      originalName: 'resume.pdf',
      status: 'COMPLETED',
      ai: ai('A backend engineer resume', 'Resume', ['node', 'typescript']),
    });
    await createFileDoc(user.id, {
      originalName: 'january-invoice.pdf',
      status: 'FAILED',
    });

    const byStatus = await request(app)
      .get('/api/v1/files?status=FAILED')
      .set('Authorization', bearer(user));
    expect(byStatus.body.data.files).toHaveLength(1);
    expect(byStatus.body.data.files[0].originalName).toBe('january-invoice.pdf');

    const byCategoryAndTag = await request(app)
      .get('/api/v1/files?category=Resume&tag=node')
      .set('Authorization', bearer(user));
    expect(byCategoryAndTag.body.data.files).toHaveLength(1);
    expect(byCategoryAndTag.body.data.files[0].originalName).toBe('resume.pdf');

    const bySearchName = await request(app)
      .get('/api/v1/files?search=invoice')
      .set('Authorization', bearer(user));
    expect(bySearchName.body.data.files).toHaveLength(1);

    const bySearchSummary = await request(app)
      .get('/api/v1/files?search=backend%20engineer')
      .set('Authorization', bearer(user));
    expect(bySearchSummary.body.data.files).toHaveLength(1);
  });

  it('paginates and reports meta', async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i += 1) {
      await createFileDoc(user.id, { originalName: `file-${i}.txt` });
    }

    const page1 = await request(app)
      .get('/api/v1/files?page=1&limit=2')
      .set('Authorization', bearer(user));
    expect(page1.body.data.files).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const page2 = await request(app)
      .get('/api/v1/files?page=2&limit=2')
      .set('Authorization', bearer(user));
    expect(page2.body.data.files).toHaveLength(1);
  });

  it('caps limit at 50 and rejects unknown filters', async () => {
    const user = await createUser();

    const tooMany = await request(app)
      .get('/api/v1/files?limit=999')
      .set('Authorization', bearer(user));
    expect(tooMany.status).toBe(400);

    const badStatus = await request(app)
      .get('/api/v1/files?status=NOT_A_STATUS')
      .set('Authorization', bearer(user));
    expect(badStatus.status).toBe(400);
  });
});
