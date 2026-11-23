import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { corsOrigins, env } from './config/env.js';

const app = Fastify({
  logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  bodyLimit: 1024 * 1024,
});

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
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid request.' });
  }
  request.log.error({ err: error }, 'Request failed');
  return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
});

app.get('/health', async () => ({ status: 'ok' }));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'Server failed to start');
  process.exit(1);
}
