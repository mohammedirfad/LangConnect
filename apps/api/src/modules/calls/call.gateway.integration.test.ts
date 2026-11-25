import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { io as createClient, type Socket } from 'socket.io-client';
import { CallType, PrismaClient, UserRole } from '@prisma/client';
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

function connect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
}

test('Socket.IO handshake requires JWT and validates call event payloads', async () => {
  const app = await buildApp();
  app.log.level = 'silent';
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const valid = createClient(address, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: accessToken(randomUUID()) },
  });
  const invalid = createClient(address, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: 'invalid' },
  });

  try {
    await connect(valid);
    const result = await new Promise<{
      ok: boolean;
      error?: { code: string };
    }>((resolve, reject) => {
      valid
        .timeout(5_000)
        .emit(
          'call:invite',
          { calleeId: 'not-a-uuid', type: 'VIDEO' },
          (error: Error | null, response: { ok: boolean; error?: { code: string } }) => {
            if (error) reject(error);
            else resolve(response);
          },
        );
    });
    assert.deepEqual(result, {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'The call request is invalid.' },
    });

    const rejected = new Promise<Error>((resolve) => invalid.once('connect_error', resolve));
    invalid.connect();
    const authError = await rejected;
    assert.equal(authError.message, 'unauthorized');
  } finally {
    valid.disconnect();
    invalid.disconnect();
    await app.close();
  }
});

test('Socket.IO delivers invite, accepted sessions, and end to the call participants', async () => {
  const database = new PrismaClient();
  const app = await buildApp(database);
  app.log.level = 'silent';
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const callerId = randomUUID();
  const calleeId = randomUUID();
  const suffix = randomUUID();
  let callId: string | undefined;
  const caller = createClient(address, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: accessToken(callerId) },
  });
  const callee = createClient(address, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: accessToken(calleeId) },
  });

  try {
    await database.user.createMany({
      data: [callerId, calleeId].map((id, index) => ({
        id,
        email: `phase3-socket-${index}-${suffix}@example.invalid`,
        passwordHash: 'test-only-not-a-login-hash',
        displayName: `Phase Three ${index}`,
        role: UserRole.BUYER,
      })),
    });
    await Promise.all([connect(caller), connect(callee)]);

    const incomingEvent = new Promise<{ call: { id: string; status: string } }>((resolve) => {
      callee.once('call:incoming', resolve);
    });
    const created = await new Promise<{ call: { id: string; status: string } }>(
      (resolve, reject) => {
        caller.timeout(5_000).emit(
          'call:invite',
          { calleeId, type: CallType.VIDEO },
          (
            error: Error | null,
            response: {
              ok: boolean;
              data?: { call: { id: string; status: string } };
              error?: { message: string };
            },
          ) => {
            if (error) reject(error);
            else if (!response.ok || !response.data)
              reject(new Error(response.error?.message ?? 'Invite failed'));
            else resolve(response.data);
          },
        );
      },
    );
    callId = created.call.id;
    const incoming = await incomingEvent;
    assert.equal(incoming.call.id, callId);
    assert.equal(incoming.call.status, 'RINGING');

    const acceptedEvent = new Promise<{
      call: { id: string; status: string };
      livekit: { token: string };
    }>((resolve) => {
      caller.once('call:accepted', resolve);
    });
    const calleeSession = await new Promise<{
      call: { id: string; status: string };
      livekit: { token: string };
    }>((resolve, reject) => {
      callee.timeout(5_000).emit(
        'call:accept',
        { callId },
        (
          error: Error | null,
          response: {
            ok: boolean;
            data?: { call: { id: string; status: string }; livekit: { token: string } };
            error?: { message: string };
          },
        ) => {
          if (error) reject(error);
          else if (!response.ok || !response.data)
            reject(new Error(response.error?.message ?? 'Accept failed'));
          else resolve(response.data);
        },
      );
    });
    const callerSession = await acceptedEvent;
    assert.equal(calleeSession.call.status, 'ACCEPTED');
    assert.equal(callerSession.call.id, callId);
    assert.ok(calleeSession.livekit.token);
    assert.ok(callerSession.livekit.token);
    assert.notEqual(calleeSession.livekit.token, callerSession.livekit.token);

    const endedEvent = new Promise<{ call: { id: string; status: string } }>((resolve) => {
      caller.once('call:ended', resolve);
    });
    await new Promise<void>((resolve, reject) => {
      callee
        .timeout(5_000)
        .emit(
          'call:end',
          { callId },
          (error: Error | null, response: { ok: boolean; error?: { message: string } }) => {
            if (error) reject(error);
            else if (!response.ok) reject(new Error(response.error?.message ?? 'End failed'));
            else resolve();
          },
        );
    });
    const ended = await endedEvent;
    assert.equal(ended.call.status, 'ENDED');
  } finally {
    caller.disconnect();
    callee.disconnect();
    await app.close();
    if (callId) await database.call.deleteMany({ where: { id: callId } });
    await database.user.deleteMany({ where: { id: { in: [callerId, calleeId] } } });
    await database.$disconnect();
  }
});
