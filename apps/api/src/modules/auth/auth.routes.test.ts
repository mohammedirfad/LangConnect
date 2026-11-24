import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient, UserRole } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthSessionDto } from './auth.dto.js';

test('auth routes register, authenticate, rotate, detect replay and logout', async () => {
  const database = new PrismaClient();
  const app = await buildApp(database);
  const email = `phase1-${randomUUID()}@example.invalid`;
  let userId: string | undefined;

  try {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        displayName: 'Phase One Test',
        email,
        password: 'test-password-at-least-twelve',
        role: UserRole.SELLER,
      },
    });
    assert.equal(register.statusCode, 201, register.body);
    const initial = register.json<AuthSessionDto>();
    userId = initial.user.id;
    assert.equal(initial.user.email, email);
    assert.equal('phone' in initial.user, false);
    assert.equal('passwordHash' in initial.user, false);

    const unauthorized = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    assert.equal(unauthorized.statusCode, 401);

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${initial.accessToken}` },
    });
    assert.equal(me.statusCode, 200, me.body);
    assert.equal(me.json<{ user: { role: string } }>().user.role, 'SELLER');

    const rotation = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initial.refreshToken },
    });
    assert.equal(rotation.statusCode, 200, rotation.body);
    const rotated = rotation.json<AuthSessionDto>();
    assert.notEqual(rotated.refreshToken, initial.refreshToken);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initial.refreshToken },
    });
    assert.equal(replay.statusCode, 401);

    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'test-password-at-least-twelve' },
    });
    assert.equal(relogin.statusCode, 200, relogin.body);
    const loggedIn = relogin.json<AuthSessionDto>();
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: loggedIn.refreshToken },
    });
    assert.equal(logout.statusCode, 204);

    const revoked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: loggedIn.refreshToken },
    });
    assert.equal(revoked.statusCode, 401);

    const storedTokens = await database.refreshToken.findMany({ where: { userId } });
    assert.equal(
      storedTokens.every((token) => token.tokenHash !== initial.refreshToken),
      true,
    );
  } finally {
    await app.close();
    if (userId) await database.user.deleteMany({ where: { id: userId } });
    await database.$disconnect();
  }
});
