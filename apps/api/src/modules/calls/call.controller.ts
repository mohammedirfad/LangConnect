import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import { callIdParamsSchema, createCallSchema } from './call.schema.js';
import type { CallService } from './call.service.js';

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return request.auth.userId;
}

export function createCallController(service: CallService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createCallSchema.parse(request.body);
    const result = await service.create({ ...input, callerId: requireUserId(request) });
    return reply.code(201).send(result);
  };
}

export function joinCallController(service: CallService) {
  return async (request: FastifyRequest) => {
    const { callId } = callIdParamsSchema.parse(request.params);
    return service.join(callId, requireUserId(request));
  };
}

export function getCallStatusController(service: CallService) {
  return async (request: FastifyRequest) => {
    const { callId } = callIdParamsSchema.parse(request.params);
    return service.getStatus(callId, requireUserId(request));
  };
}

export function getActiveCallController(service: CallService) {
  return async (request: FastifyRequest) => service.getActiveForUser(requireUserId(request));
}

export function endCallController(service: CallService) {
  return async (request: FastifyRequest) => {
    const { callId } = callIdParamsSchema.parse(request.params);
    return service.end(callId, requireUserId(request));
  };
}
