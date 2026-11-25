import { CallStatus, Prisma, type CallType } from '@prisma/client';
import type { PrismaService } from '../../lib/prisma.js';

const callSelect = {
  id: true,
  callerId: true,
  calleeId: true,
  roomName: true,
  type: true,
  status: true,
  startedAt: true,
  acceptedAt: true,
  endedAt: true,
} satisfies Prisma.CallSelect;

export type CallRecord = Prisma.CallGetPayload<{ select: typeof callSelect }>;

export interface CallRepositoryPort {
  create(input: {
    id: string;
    callerId: string;
    calleeId: string;
    type: CallType;
  }): Promise<CallRecord | null>;
  join(callId: string, userId: string): Promise<CallRecord | null>;
  findForParticipant(callId: string, userId: string): Promise<CallRecord | null>;
  end(callId: string, userId: string): Promise<CallRecord | null>;
}

export class CallRepository implements CallRepositoryPort {
  constructor(private readonly database: PrismaService) {}

  async create(input: { id: string; callerId: string; calleeId: string; type: CallType }) {
    return this.database.$transaction(async (transaction) => {
      const callee = await transaction.user.findUnique({
        where: { id: input.calleeId },
        select: { id: true },
      });
      if (!callee || input.callerId === input.calleeId) return null;

      const blocked = await transaction.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: input.callerId, blockedId: input.calleeId },
            { blockerId: input.calleeId, blockedId: input.callerId },
          ],
        },
        select: { blockerId: true },
      });
      if (blocked) return null;

      return transaction.call.create({
        data: {
          id: input.id,
          callerId: input.callerId,
          calleeId: input.calleeId,
          type: input.type,
          roomName: `landconnect-${input.id}`,
        },
        select: callSelect,
      });
    });
  }

  async join(callId: string, userId: string): Promise<CallRecord | null> {
    return this.database.$transaction(async (transaction) => {
      const call = await transaction.call.findUnique({ where: { id: callId }, select: callSelect });
      if (!call || (call.callerId !== userId && call.calleeId !== userId)) return null;
      if (call.status !== CallStatus.RINGING && call.status !== CallStatus.ACCEPTED) return null;

      if (call.calleeId === userId && call.status === CallStatus.RINGING) {
        await transaction.call.updateMany({
          where: { id: callId, calleeId: userId, status: CallStatus.RINGING },
          data: { status: CallStatus.ACCEPTED, acceptedAt: new Date() },
        });
      } else if (call.callerId === userId && call.status === CallStatus.RINGING) {
        return null;
      }

      return transaction.call.findUnique({ where: { id: callId }, select: callSelect });
    });
  }

  findForParticipant(callId: string, userId: string): Promise<CallRecord | null> {
    return this.database.call.findFirst({
      where: { id: callId, OR: [{ callerId: userId }, { calleeId: userId }] },
      select: callSelect,
    });
  }

  async end(callId: string, userId: string): Promise<CallRecord | null> {
    return this.database.$transaction(async (transaction) => {
      const call = await transaction.call.findUnique({ where: { id: callId }, select: callSelect });
      if (!call || (call.callerId !== userId && call.calleeId !== userId)) return null;
      if (call.status === CallStatus.ENDED) return call;
      if (call.status !== CallStatus.RINGING && call.status !== CallStatus.ACCEPTED) return null;

      await transaction.call.updateMany({
        where: {
          id: callId,
          status: { in: [CallStatus.RINGING, CallStatus.ACCEPTED] },
        },
        data: { status: CallStatus.ENDED, endedAt: new Date() },
      });
      return transaction.call.findUnique({ where: { id: callId }, select: callSelect });
    });
  }
}
