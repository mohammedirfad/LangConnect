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
    return this.call;
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
