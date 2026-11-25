import jwt, { type JwtPayload } from 'jsonwebtoken';
import { Server as SocketServer, type Socket } from 'socket.io';
import { z } from 'zod';
import type { Server as HttpServer } from 'node:http';
import { UserRole } from '@prisma/client';
import { env, corsOrigins } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import type { CallService } from './call.service.js';
import { callActionSchema, inviteCallSchema } from './call.schema.js';

const ringTimeoutMs = 30_000;
const maxCallEventsPerMinute = 12;
const socketAuthSchema = z.object({ token: z.string().min(1).max(4096) }).strict();

type SocketData = { userId: string; role: UserRole };
type Ack<T> = (
  result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } },
) => void;
type CallSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function isRole(value: unknown): value is UserRole {
  return Object.values(UserRole).some((role) => role === value);
}

export function verifyCallSocketToken(value: unknown): SocketData | null {
  const parsed = socketAuthSchema.safeParse({ token: value });
  if (!parsed.success) return null;
  try {
    const decoded = jwt.verify(parsed.data.token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'landconnect-api',
      audience: 'landconnect-mobile',
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || !isRole(decoded.role)) {
      return null;
    }
    return { userId: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

function publicError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  if (error instanceof z.ZodError) {
    return { code: 'VALIDATION_ERROR', message: 'The call request is invalid.' };
  }
  return { code: 'CALL_ERROR', message: 'The call could not be completed.' };
}

export function attachCallGateway(server: HttpServer, service: CallService) {
  const io = new SocketServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Origin is not allowed'), false);
      },
    },
    maxHttpBufferSize: 16 * 1024,
    connectTimeout: 10_000,
  });
  const ringTimers = new Map<string, NodeJS.Timeout>();
  const eventWindows = new Map<string, { startedAt: number; count: number }>();

  const withinLimit = (userId: string) => {
    const now = Date.now();
    let window = eventWindows.get(userId);
    if (!window || now - window.startedAt >= 60_000) {
      window = { startedAt: now, count: 0 };
      eventWindows.set(userId, window);
    }
    window.count += 1;
    if (eventWindows.size > 10_000) {
      for (const [id, entry] of eventWindows) {
        if (now - entry.startedAt >= 60_000) eventWindows.delete(id);
      }
    }
    return window.count <= maxCallEventsPerMinute;
  };

  const clearRingTimer = (callId: string) => {
    const timer = ringTimers.get(callId);
    if (timer) clearTimeout(timer);
    ringTimers.delete(callId);
  };

  const emitMissed = (
    call: NonNullable<Awaited<ReturnType<CallService['markMissed']>>>['call'],
  ) => {
    clearRingTimer(call.id);
    io.to(userRoom(call.callerId)).emit('call:missed', { call });
    io.to(userRoom(call.calleeId)).emit('call:missed', { call });
  };

  const scheduleMissed = (callId: string) => {
    clearRingTimer(callId);
    const timer = setTimeout(() => {
      void service
        .markMissed(callId)
        .then((result) => {
          if (result) emitMissed(result.call);
        })
        .catch(() => undefined)
        .finally(() => ringTimers.delete(callId));
    }, ringTimeoutMs);
    timer.unref();
    ringTimers.set(callId, timer);
  };

  const expireOverdueCalls = async () => {
    const overdue = await service.findExpiredRinging(new Date(Date.now() - ringTimeoutMs));
    for (const candidate of overdue) {
      const result = await service.markMissed(candidate.id);
      if (result) emitMissed(result.call);
    }
  };

  io.use((socket, next) => {
    const identity = verifyCallSocketToken(socket.handshake.auth?.token);
    if (!identity) return next(new Error('unauthorized'));
    socket.data.userId = identity.userId;
    socket.data.role = identity.role;
    next();
  });

  io.on('connection', (socket) => {
    const client = socket as CallSocket;
    const expiry = (jwt.decode(socket.handshake.auth?.token) as JwtPayload | null)?.exp;
    if (expiry) {
      const expiryTimer = setTimeout(
        () => socket.disconnect(true),
        Math.max(0, expiry * 1000 - Date.now()),
      );
      expiryTimer.unref();
      socket.once('disconnect', () => clearTimeout(expiryTimer));
    }
    void socket.join(userRoom(client.data.userId));

    const run = async <T>(ack: Ack<T> | undefined, action: () => Promise<T>) => {
      if (!withinLimit(client.data.userId)) {
        ack?.({
          ok: false,
          error: { code: 'RATE_LIMITED', message: 'Too many call actions. Please wait a moment.' },
        });
        return;
      }
      try {
        ack?.({ ok: true, data: await action() });
      } catch (error) {
        ack?.({ ok: false, error: publicError(error) });
      }
    };

    client.on('call:invite', (payload: unknown, ack?: Ack<{ call: unknown }>) => {
      void run(ack, async () => {
        const input = inviteCallSchema.parse(payload);
        const created = await service.create({ ...input, callerId: client.data.userId });
        const call = created.call;
        io.to(userRoom(call.calleeId)).emit('call:incoming', { call });
        scheduleMissed(call.id);
        return created;
      });
    });

    client.on('call:accept', (payload: unknown, ack?: Ack<{ call: unknown; livekit: unknown }>) => {
      void run(ack, async () => {
        const { callId } = callActionSchema.parse(payload);
        const accepted = await service.accept(callId, client.data.userId);
        clearRingTimer(callId);
        io.to(userRoom(accepted.call.callerId)).emit('call:accepted', accepted.caller);
        return accepted.callee;
      });
    });

    client.on('call:reject', (payload: unknown, ack?: Ack<{ call: unknown }>) => {
      void run(ack, async () => {
        const { callId } = callActionSchema.parse(payload);
        const result = await service.reject(callId, client.data.userId);
        clearRingTimer(callId);
        io.to(userRoom(result.call.callerId)).emit('call:rejected', { call: result.call });
        return result;
      });
    });

    client.on('call:end', (payload: unknown, ack?: Ack<{ call: unknown }>) => {
      void run(ack, async () => {
        const { callId } = callActionSchema.parse(payload);
        const result = await service.end(callId, client.data.userId);
        clearRingTimer(callId);
        const otherUserId =
          result.call.callerId === client.data.userId ? result.call.calleeId : result.call.callerId;
        io.to(userRoom(otherUserId)).emit('call:ended', { call: result.call });
        return result;
      });
    });
  });

  const recoveryTimer = setInterval(() => {
    void expireOverdueCalls().catch(() => undefined);
  }, 5_000);
  recoveryTimer.unref();
  void expireOverdueCalls().catch(() => undefined);

  return {
    io,
    close: async () => {
      clearInterval(recoveryTimer);
      for (const callId of ringTimers.keys()) clearRingTimer(callId);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
