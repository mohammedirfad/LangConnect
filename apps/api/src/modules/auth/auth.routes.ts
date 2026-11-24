import type { FastifyPluginAsync } from 'fastify';
import type { AuthService } from './auth.service.js';
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from './auth.controller.js';
import { authenticate } from '../../plugins/authenticate.js';

export function createAuthRoutes(service: AuthService): FastifyPluginAsync {
  return async (app) => {
    app.post('/register', {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      handler: registerController(service),
    });
    app.post('/login', {
      config: { rateLimit: { max: 8, timeWindow: '1 minute' } },
      handler: loginController(service),
    });
    app.post('/refresh', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      handler: refreshController(service),
    });
    app.post('/logout', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      handler: logoutController(service),
    });
    app.get('/me', { preHandler: authenticate, handler: meController(service) });
  };
}
