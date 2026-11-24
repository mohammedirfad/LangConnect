import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'Server failed to start');
  await app.close();
  process.exitCode = 1;
}
