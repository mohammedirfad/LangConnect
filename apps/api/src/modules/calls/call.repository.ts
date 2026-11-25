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

export type CreateCallResult =
  | { kind: 'created'; call: CallRecord }
  | { kind: 'unavailable' }
  | { kind: 'busy'; busyUserId: string };

export interface CallRepositoryPort {
  create(input: {
    id: string;
    callerId: string;
    calleeId: string;
    type: CallType;
  }): Promise<CreateCallResult>;
  accept(callId: string, userId: string): Promise<CallRecord | null>;
  reject(callId: string, userId: string): Promise<CallRecord | null>;
  markMissed(callId: string): Promise<CallRecord | null>;
  findExpiredRinging(cutoff: Date): Promise<CallRecord[]>;
  join(callId: string, userId: string): Promise<CallRecord | null>;
  findForParticipant(callId: string, userId: string): Promise<CallRecord | null>;
  findActiveForUser(userId: string): Promise<CallRecord | null>;
  end(callId: string, userId: string): Promise<CallRecord | null>;
}

export class CallRepository implements CallRepositoryPort {
  constructor(private readonly database: PrismaService) {}

  async create(input: { id: string; callerId: string; calleeId: string; type: CallType }) {
    return this.database.$transaction(async (transaction) => {
      // Serialize invitations involving either account so simultaneous invites
      // cannot put a participant in two live calls.
      const participantIds = [input.callerId, input.calleeId].sort();
      for (const participantId of participantIds) {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${participantId}, 0)) IS NULL`;
      }

      const callee = await transaction.user.findUnique({
        where: { id: input.calleeId },
        select: { id: true },
      });
      if (!callee || input.callerId === input.calleeId) return { kind: 'unavailable' as const };

      const blocked = await transaction.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: input.callerId, blockedId: input.calleeId },
            { blockerId: input.calleeId, blockedId: input.callerId },
          ],
        },
        select: { blockerId: true },
      });
      if (blocked) return { kind: 'unavailable' as const };

      const activeCall = await transaction.call.findFirst({
        where: {
          status: { in: [CallStatus.RINGING, CallStatus.ACCEPTED] },
          OR: [{ callerId: { in: participantIds } }, { calleeId: { in: participantIds } }],
        },
        select: { callerId: true, calleeId: true },
      });
      if (activeCall) {
        const busyUserId = participantIds.find(
          (id) => activeCall.callerId === id || activeCall.calleeId === id,
        );
        return { kind: 'busy' as const, busyUserId: busyUserId ?? input.calleeId };
      }

      const call = await transaction.call.create({
        data: {
          id: input.id,
          callerId: input.callerId,
          calleeId: input.calleeId,
          type: input.type,
          roomName: `landconnect-${input.id}`,
        },
        select: callSelect,
      });
      return { kind: 'created' as const, call };
    });
  }

  async accept(callId: string, userId: string): Promise<CallRecord | null> {
    return this.database.$transaction(async (transaction) => {
      const call = await transaction.call.findUnique({ where: { id: callId }, select: callSelect });
      if (!call || call.calleeId !== userId) return null;
      if (call.status === CallStatus.RINGING) {
        const accepted = await transaction.call.updateMany({
          where: { id: callId, calleeId: userId, status: CallStatus.RINGING },
          data: { status: CallStatus.ACCEPTED, acceptedAt: new Date() },
        });
        if (!accepted.count) {
          const latest = await transaction.call.findUnique({
            where: { id: callId },
            select: callSelect,
          });
          return latest?.status === CallStatus.ACCEPTED ? latest : null;
        }
      } else if (call.status !== CallStatus.ACCEPTED) {
        return null;
      }
      return transaction.call.findUnique({ where: { id: callId }, select: callSelect });
    });
  }

  async reject(callId: string, userId: string): Promise<CallRecord | null> {
    const updated = await this.database.call.updateMany({
      where: { id: callId, calleeId: userId, status: CallStatus.RINGING },
      data: { status: CallStatus.REJECTED, endedAt: new Date() },
    });
    if (!updated.count) return null;
    return this.database.call.findUnique({ where: { id: callId }, select: callSelect });
  }

  async markMissed(callId: string): Promise<CallRecord | null> {
    const updated = await this.database.call.updateMany({
      where: { id: callId, status: CallStatus.RINGING },
      data: { status: CallStatus.MISSED, endedAt: new Date() },
    });
    if (!updated.count) return null;
    return this.database.call.findUnique({ where: { id: callId }, select: callSelect });
  }

  findExpiredRinging(cutoff: Date): Promise<CallRecord[]> {
    return this.database.call.findMany({
      where: { status: CallStatus.RINGING, startedAt: { lte: cutoff } },
      select: callSelect,
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

  findActiveForUser(userId: string): Promise<CallRecord | null> {
    return this.database.call.findFirst({
      where: {
        status: { in: [CallStatus.RINGING, CallStatus.ACCEPTED] },
        OR: [{ callerId: userId }, { calleeId: userId }],
      },
      orderBy: { startedAt: 'desc' },
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
      const latest = await transaction.call.findUnique({
        where: { id: callId },
        select: callSelect,
      });
      return latest?.status === CallStatus.ENDED ? latest : null;
    });
  }
}
