import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createUser, bearer } from './helpers.js';

describe('FR-01 auth flow', () => {
  it('registers, logs in, reads /me, refreshes and logs out', async () => {
    const user = await createUser({ email: 'flow@example.com', password: 'password123' });

    // /me with a valid access token
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', bearer(user));
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('flow@example.com');
    expect(me.body.data.user.passwordHash).toBeUndefined();

    // login set an httpOnly refresh cookie
    expect(user.cookies.join(';')).toContain('refreshToken=');
    expect(user.cookies.join(';').toLowerCase()).toContain('httponly');

    // refresh rotates the token and returns a new access token
    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', user.cookies);
    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.data.accessToken).toBe('string');
    const rotatedCookies = refreshed.headers['set-cookie'] as unknown as string[];
    expect(rotatedCookies.join(';')).toContain('refreshToken=');

    // the OLD refresh token must no longer work after rotation
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', user.cookies);
    expect(replay.status).toBe(401);

    // logout with the freshly rotated cookie
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', bearer(user))
      .set('Cookie', rotatedCookies);
    expect(logout.status).toBe(200);

    // and that refresh token is now dead too
    const afterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookies);
    expect(afterLogout.status).toBe(401);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await createUser({ email: 'dupe@example.com' });

    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Other', email: 'dupe@example.com', password: 'password123' });
    expect(dup.status).toBe(409);

    const weak = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a generic error for bad credentials and blocks unauthenticated /me', async () => {
    await createUser({ email: 'generic@example.com' });

    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'generic@example.com', password: 'wrongpassword' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe('Invalid credentials');

    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.status).toBe(401);
  });
});
