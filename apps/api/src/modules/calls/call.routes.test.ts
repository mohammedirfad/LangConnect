import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { CallType, PrismaClient, UserRole } from '@prisma/client';
import { TokenVerifier } from 'livekit-server-sdk';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';

function accessToken(userId: string): string {
  return jwt.sign({ role: UserRole.BUYER }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: 'landconnect-api',
    audience: 'landconnect-mobile',
    expiresIn: '15m',
  });
}

test('call routes accept the callee and issue room-scoped tokens only to participants', async () => {
  const database = new PrismaClient();
  const app = await buildApp(database);
  app.log.level = 'silent';
  const users = [randomUUID(), randomUUID(), randomUUID()];
  const suffix = randomUUID();
  let callId: string | undefined;

  try {
    await database.user.createMany({
      data: users.map((id, index) => ({
        id,
        email: `phase2-call-${index}-${suffix}@example.invalid`,
        passwordHash: 'test-only-not-a-login-hash',
        displayName: `Phase Two ${index}`,
        role: UserRole.BUYER,
      })),
    });
    await database.userBlock.create({ data: { blockerId: users[0]!, blockedId: users[2]! } });

    const callerAuth = { authorization: `Bearer ${accessToken(users[0]!)}` };
    const calleeAuth = { authorization: `Bearer ${accessToken(users[1]!)}` };
    const outsiderAuth = { authorization: `Bearer ${accessToken(users[2]!)}` };

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/calls',
      headers: callerAuth,
      payload: { calleeId: users[1], type: CallType.VIDEO },
    });
    assert.equal(created.statusCode, 201, created.body);
    const pending = created.json<{ call: { id: string; status: string; callerId: string } }>();
    callId = pending.call.id;
    assert.equal(pending.call.status, 'RINGING');
    assert.equal(pending.call.callerId, users[0]);
    assert.equal(
      'livekit' in pending,
      false,
      'caller must not receive a room token before acceptance',
    );

    const prematureCallerJoin = await app.inject({
      method: 'POST',
      url: `/api/v1/calls/${callId}/join`,
      headers: callerAuth,
    });
    assert.equal(prematureCallerJoin.statusCode, 404);

    const outsiderJoin = await app.inject({
      method: 'POST',
      url: `/api/v1/calls/${callId}/join`,
      headers: outsiderAuth,
    });
    assert.equal(outsiderJoin.statusCode, 404);

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/v1/calls/${callId}/join`,
      headers: calleeAuth,
    });
    assert.equal(accepted.statusCode, 200, accepted.body);
    const calleeSession = accepted.json<{
      call: { status: string; roomName: string };
      livekit: { url: string; token: string; expiresInSeconds: number };
    }>();
    assert.equal(calleeSession.call.status, 'ACCEPTED');
    assert.equal(calleeSession.livekit.url, env.LIVEKIT_URL);

    const verifier = new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
    const calleeClaims = await verifier.verify(calleeSession.livekit.token);
    assert.equal(calleeClaims.video?.room, calleeSession.call.roomName);
    assert.equal(calleeClaims.video?.roomJoin, true);
    assert.equal(calleeClaims.video?.canPublishData, false);

    const callerSessionResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/calls/${callId}/join`,
      headers: callerAuth,
    });
    assert.equal(callerSessionResponse.statusCode, 200, callerSessionResponse.body);
    const callerSession = callerSessionResponse.json<{
      call: { status: string; roomName: string };
      livekit: { token: string };
    }>();
    const callerClaims = await verifier.verify(callerSession.livekit.token);
    assert.equal(callerClaims.video?.room, calleeSession.call.roomName);
    assert.notEqual(callerClaims.sub, calleeClaims.sub);

    const blockedTarget = await app.inject({
      method: 'POST',
      url: '/api/v1/calls',
      headers: callerAuth,
      payload: { calleeId: users[2], type: CallType.AUDIO },
    });
    assert.equal(blockedTarget.statusCode, 404);

    const privateStatus = await app.inject({
      method: 'GET',
      url: `/api/v1/calls/${callId}`,
      headers: outsiderAuth,
    });
    assert.equal(privateStatus.statusCode, 404);
  } finally {
    await app.close();
    if (callId) await database.call.deleteMany({ where: { id: callId } });
    await database.userBlock.deleteMany({ where: { blockerId: { in: users } } });
    await database.user.deleteMany({ where: { id: { in: users } } });
    await database.$disconnect();
  }
});
