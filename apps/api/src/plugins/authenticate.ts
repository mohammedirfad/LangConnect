import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from '../lib/app-error.js';
import { canRoleAccess } from './rbac.js';

export interface AuthIdentity {
  userId: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthIdentity | null;
  }
}

function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).some((role) => role === value);
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }

  let payload: JwtPayload;
  try {
    const verified = jwt.verify(authorization.slice(7), env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'landconnect-api',
      audience: 'landconnect-mobile',
    });
    if (typeof verified === 'string') throw new Error('Invalid access token payload');
    payload = verified;
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }

  if (typeof payload.sub !== 'string' || !isUserRole(payload.role)) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session is invalid. Please sign in again.');
  }
  request.auth = { userId: payload.sub, role: payload.role };
}

export function requireRole(...roles: UserRole[]): preHandlerAsyncHookHandler {
  return async (request) => {
    if (!request.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    if (!canRoleAccess(roles, request.auth.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }
  };
}
