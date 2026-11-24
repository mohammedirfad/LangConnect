import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { AuthService } from './auth.service.js';
import { loginSchema, refreshTokenSchema, registerSchema } from './auth.schema.js';

export function registerController(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const input = registerSchema.parse(request.body);
    const session = await service.register(input);
    return reply.code(201).send(session);
  };
}

export function loginController(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const input = loginSchema.parse(request.body);
    return reply.send(await service.login(input));
  };
}

export function refreshController(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    return reply.send(await service.refresh(refreshToken));
  };
}

export function logoutController(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    await service.logout(refreshToken);
    return reply.code(204).send();
  };
}

export function meController(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in again.');
    return reply.send({ user: await service.getUser(request.auth.userId) });
  };
}
