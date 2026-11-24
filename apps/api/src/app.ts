import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { corsOrigins, env } from './config/env.js';
import { prisma, type PrismaService } from './lib/prisma.js';
import { AppError } from './lib/app-error.js';
import { createAuthRoutes } from './modules/auth/auth.routes.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { openApiDocument, swaggerUiHtml } from './openapi.js';

export async function buildApp(database: PrismaService = prisma): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 1024 * 1024,
    trustProxy: env.TRUST_PROXY,
  });

  app.decorateRequest('auth', null);
  await app.register(helmet);
  await app.register(compress);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Origin is not allowed'), false);
    },
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Check the highlighted fields and try again.',
          issues: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
        },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'An account with those details already exists.' },
      });
    }
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const status = statusCode;
      return reply.status(status).send({
        error: {
          code: status === 429 ? 'RATE_LIMITED' : 'REQUEST_ERROR',
          message:
            status === 429
              ? 'Too many requests. Please try again shortly.'
              : 'The request could not be completed.',
        },
      });
    }

    request.log.error({ err: error }, 'Request failed');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (request, reply) => {
    try {
      await database.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected' };
    } catch (error) {
      request.log.warn({ err: error }, 'Readiness check failed');
      return reply.status(503).send({
        error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not available.' },
      });
    }
  });
  app.get('/openapi.json', async (_request, reply) => {
    return reply.header('Cache-Control', 'no-store').send(openApiDocument);
  });
  app.get('/docs', async (_request, reply) => {
    const nonce = randomBytes(18).toString('base64');
    const csp = [
      "default-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      `script-src 'self' https://unpkg.com 'nonce-${nonce}'`,
      "style-src 'self' https://unpkg.com 'unsafe-inline'",
      'font-src https://unpkg.com data:',
      "img-src 'self' data: https://unpkg.com",
      "connect-src 'self'",
    ].join('; ');
    return reply
      .header('Content-Security-Policy', csp)
      .header('Cache-Control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(swaggerUiHtml(nonce));
  });
  const repository = new AuthRepository(database);
  const service = new AuthService(repository, {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtl: env.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  });
  await app.register(createAuthRoutes(service), { prefix: '/api/v1/auth' });
  app.addHook('onClose', async () => {
    if (database === prisma) await database.$disconnect();
  });

  return app;
}
