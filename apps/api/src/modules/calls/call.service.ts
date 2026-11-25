import { randomUUID } from 'node:crypto';
import { CallStatus, type CallType } from '@prisma/client';
import { AppError } from '../../lib/app-error.js';
import type { CallRecord, CallRepositoryPort } from './call.repository.js';
import type { CallTokenServicePort } from './livekit-token.service.js';

function toCallDto(call: CallRecord) {
  return {
    id: call.id,
    callerId: call.callerId,
    calleeId: call.calleeId,
    roomName: call.roomName,
    type: call.type,
    status: call.status,
    startedAt: call.startedAt.toISOString(),
    acceptedAt: call.acceptedAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
  };
}

export class CallService {
  constructor(
    private readonly repository: CallRepositoryPort,
    private readonly tokenService: CallTokenServicePort,
  ) {}

  async create(input: { callerId: string; calleeId: string; type: CallType }) {
    const result = await this.repository.create({ ...input, id: randomUUID() });
    if (result.kind === 'unavailable') {
      throw new AppError(404, 'CALL_TARGET_UNAVAILABLE', 'That user is unavailable for a call.');
    }
    if (result.kind === 'busy') {
      throw new AppError(409, 'CALL_BUSY', 'One of the participants is already in a call.');
    }
    // Do not issue room access until the callee accepts the invitation.
    return { call: toCallDto(result.call) };
  }

  async accept(callId: string, userId: string) {
    const call = await this.repository.accept(callId, userId);
    if (!call) {
      throw new AppError(409, 'CALL_NOT_ACCEPTABLE', 'This call is no longer available to accept.');
    }
    const [calleeLiveKit, callerLiveKit] = await Promise.all([
      this.tokenService.createParticipantToken({
        callId: call.id,
        roomName: call.roomName,
        userId: call.calleeId,
      }),
      this.tokenService.createParticipantToken({
        callId: call.id,
        roomName: call.roomName,
        userId: call.callerId,
      }),
    ]);
    return {
      call: toCallDto(call),
      callee: { call: toCallDto(call), livekit: calleeLiveKit },
      caller: { call: toCallDto(call), livekit: callerLiveKit },
    };
  }

  async reject(callId: string, userId: string) {
    const call = await this.repository.reject(callId, userId);
    if (!call) {
      throw new AppError(409, 'CALL_NOT_REJECTABLE', 'This call is no longer ringing.');
    }
    return { call: toCallDto(call) };
  }

  async markMissed(callId: string) {
    const call = await this.repository.markMissed(callId);
    return call ? { call: toCallDto(call) } : null;
  }

  async findExpiredRinging(cutoff: Date) {
    return this.repository.findExpiredRinging(cutoff);
  }

  async join(callId: string, userId: string) {
    const call = await this.repository.join(callId, userId);
    if (!call) {
      throw new AppError(
        404,
        'CALL_NOT_JOINABLE',
        'This call is unavailable or you are not a participant.',
      );
    }
    if (call.status !== CallStatus.RINGING && call.status !== CallStatus.ACCEPTED) {
      throw new AppError(409, 'CALL_NOT_ACTIVE', 'This call has already ended.');
    }
    return {
      call: toCallDto(call),
      livekit: await this.tokenService.createParticipantToken({
        callId: call.id,
        roomName: call.roomName,
        userId,
      }),
    };
  }

  async getStatus(callId: string, userId: string) {
    const call = await this.repository.findForParticipant(callId, userId);
    if (!call)
      throw new AppError(404, 'CALL_NOT_FOUND', 'Call not found or you are not a participant.');
    return { call: toCallDto(call) };
  }

  async getActiveForUser(userId: string) {
    const call = await this.repository.findActiveForUser(userId);
    return { call: call ? toCallDto(call) : null };
  }

  async end(callId: string, userId: string) {
    const call = await this.repository.end(callId, userId);
    if (!call)
      throw new AppError(404, 'CALL_NOT_FOUND', 'Call not found or you are not a participant.');
    if (call.status === CallStatus.ENDED) {
      try {
        await this.tokenService.deleteRoom(call.roomName);
      } catch {
        // The call record is already ended; room deletion is best effort during cleanup.
      }
    }
    return { call: toCallDto(call) };
  }
}
