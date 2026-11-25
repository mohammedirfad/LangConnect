import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { CallStatus, CallType } from '@prisma/client';
import { AppError } from '../../lib/app-error.js';
import type { CallRecord, CallRepositoryPort } from './call.repository.js';
import { CallService } from './call.service.js';
import type { CallTokenServicePort } from './livekit-token.service.js';

class MemoryCallRepository implements CallRepositoryPort {
  private call: CallRecord | null = null;

  async create(input: { id: string; callerId: string; calleeId: string; type: CallType }) {
    if (
      this.call &&
      [CallStatus.RINGING, CallStatus.ACCEPTED].includes(this.call.status) &&
      [this.call.callerId, this.call.calleeId].some((id) =>
        [input.callerId, input.calleeId].includes(id),
      )
    ) {
      return { kind: 'busy' as const, busyUserId: this.call.callerId };
    }
    this.call = {
      id: input.id,
      callerId: input.callerId,
      calleeId: input.calleeId,
      roomName: `landconnect-${input.id}`,
      type: input.type,
      status: CallStatus.RINGING,
      startedAt: new Date(),
      acceptedAt: null,
      endedAt: null,
    };
    return { kind: 'created' as const, call: this.call };
  }

  async accept(callId: string, userId: string) {
    if (!this.call || this.call.id !== callId || this.call.calleeId !== userId) return null;
    if (this.call.status === CallStatus.RINGING) {
      this.call = { ...this.call, status: CallStatus.ACCEPTED, acceptedAt: new Date() };
    } else if (this.call.status !== CallStatus.ACCEPTED) return null;
    return this.call;
  }

  async reject(callId: string, userId: string) {
    if (
      !this.call ||
      this.call.id !== callId ||
      this.call.calleeId !== userId ||
      this.call.status !== CallStatus.RINGING
    )
      return null;
    this.call = { ...this.call, status: CallStatus.REJECTED, endedAt: new Date() };
    return this.call;
  }

  async markMissed(callId: string) {
    if (!this.call || this.call.id !== callId || this.call.status !== CallStatus.RINGING)
      return null;
    this.call = { ...this.call, status: CallStatus.MISSED, endedAt: new Date() };
    return this.call;
  }

  async findExpiredRinging(_cutoff: Date) {
    return this.call?.status === CallStatus.RINGING ? [this.call] : [];
  }

  async join(callId: string, userId: string) {
    if (!this.call || this.call.id !== callId) return null;
    if (userId !== this.call.callerId && userId !== this.call.calleeId) return null;
    if (this.call.status === CallStatus.RINGING && userId === this.call.callerId) return null;
    if (this.call.status !== CallStatus.RINGING && this.call.status !== CallStatus.ACCEPTED)
      return null;
    if (userId === this.call.calleeId && this.call.status === CallStatus.RINGING) {
      this.call = { ...this.call, status: CallStatus.ACCEPTED, acceptedAt: new Date() };
    }
    return this.call;
  }

  async findForParticipant(callId: string, userId: string) {
    if (!this.call || this.call.id !== callId) return null;
    return userId === this.call.callerId || userId === this.call.calleeId ? this.call : null;
  }

  async findActiveForUser(userId: string) {
    if (!this.call || ![this.call.callerId, this.call.calleeId].includes(userId)) return null;
    return [CallStatus.RINGING, CallStatus.ACCEPTED].includes(this.call.status) ? this.call : null;
  }

  async end(callId: string, userId: string) {
    if (!this.call || this.call.id !== callId) return null;
    if (userId !== this.call.callerId && userId !== this.call.calleeId) return null;
    if (this.call.status === CallStatus.ENDED) return this.call;
    if (this.call.status !== CallStatus.RINGING && this.call.status !== CallStatus.ACCEPTED)
      return null;
    this.call = { ...this.call, status: CallStatus.ENDED, endedAt: new Date() };
    return this.call;
  }
}

class MemoryTokenService implements CallTokenServicePort {
  readonly issued: Array<{ callId: string; roomName: string; userId: string }> = [];
  readonly deletedRooms: string[] = [];

  async createParticipantToken(input: { callId: string; roomName: string; userId: string }) {
    this.issued.push(input);
    return { url: 'wss://livekit.test', token: 'test-only-token', expiresInSeconds: 600 };
  }

  async deleteRoom(roomName: string): Promise<void> {
    this.deletedRooms.push(roomName);
  }
}

test('callee acceptance gates room tokens; only participants can join or end', async () => {
  const repository = new MemoryCallRepository();
  const tokens = new MemoryTokenService();
  const service = new CallService(repository, tokens);
  const callerId = randomUUID();
  const calleeId = randomUUID();
  const outsiderId = randomUUID();
  const created = await service.create({ callerId, calleeId, type: CallType.AUDIO });

  assert.equal(created.call.status, CallStatus.RINGING);
  assert.equal(tokens.issued.length, 0);
  await assert.rejects(service.join(created.call.id, callerId), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 404);
    return true;
  });
  await assert.rejects(service.join(created.call.id, outsiderId), AppError);
  assert.equal(tokens.issued.length, 0);

  const accepted = await service.join(created.call.id, calleeId);
  assert.equal(accepted.call.status, CallStatus.ACCEPTED);
  assert.equal(tokens.issued.length, 1);
  assert.equal(tokens.issued[0]?.userId, calleeId);

  const caller = await service.join(created.call.id, callerId);
  assert.equal(caller.call.status, CallStatus.ACCEPTED);
  assert.equal(tokens.issued.length, 2);
  assert.equal(tokens.issued[1]?.userId, callerId);

  await assert.rejects(service.end(created.call.id, outsiderId), AppError);
  const ended = await service.end(created.call.id, callerId);
  assert.equal(ended.call.status, CallStatus.ENDED);
  assert.deepEqual(tokens.deletedRooms, [created.call.roomName]);
  await assert.rejects(service.join(created.call.id, calleeId), AppError);
});

test('busy accounts cannot be invited into a second active call', async () => {
  const repository = new MemoryCallRepository();
  const service = new CallService(repository, new MemoryTokenService());
  const callerId = randomUUID();
  const calleeId = randomUUID();
  const otherId = randomUUID();
  await service.create({ callerId, calleeId, type: CallType.AUDIO });

  await assert.rejects(
    service.create({ callerId: otherId, calleeId, type: CallType.VIDEO }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'CALL_BUSY');
      return true;
    },
  );
});

test('callee can reject a ring and stale rings become missed', async () => {
  const repository = new MemoryCallRepository();
  const service = new CallService(repository, new MemoryTokenService());
  const callerId = randomUUID();
  const calleeId = randomUUID();
  const rejected = await service.create({ callerId, calleeId, type: CallType.AUDIO });

  const rejection = await service.reject(rejected.call.id, calleeId);
  assert.equal(rejection.call.status, CallStatus.REJECTED);
  await assert.rejects(service.accept(rejected.call.id, calleeId), AppError);

  const missedCall = await service.create({ callerId, calleeId, type: CallType.VIDEO });
  const missed = await service.markMissed(missedCall.call.id);
  assert.equal(missed?.call.status, CallStatus.MISSED);
  assert.equal(await service.markMissed(missedCall.call.id), null);
});

test('active call recovery only returns the authenticated participant’s call', async () => {
  const repository = new MemoryCallRepository();
  const service = new CallService(repository, new MemoryTokenService());
  const callerId = randomUUID();
  const calleeId = randomUUID();
  const outsiderId = randomUUID();
  const created = await service.create({ callerId, calleeId, type: CallType.AUDIO });

  assert.equal((await service.getActiveForUser(calleeId)).call?.id, created.call.id);
  assert.equal((await service.getActiveForUser(outsiderId)).call, null);
  await service.reject(created.call.id, calleeId);
  assert.equal((await service.getActiveForUser(callerId)).call, null);
});
