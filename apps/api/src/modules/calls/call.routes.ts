import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../plugins/authenticate.js';
import {
  createCallController,
  endCallController,
  getCallStatusController,
  joinCallController,
} from './call.controller.js';
import type { CallService } from './call.service.js';

export function createCallRoutes(service: CallService): FastifyPluginAsync {
  return async (app) => {
    app.post('/', {
      preHandler: authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      handler: createCallController(service),
    });
    app.post('/:callId/join', {
      preHandler: authenticate,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      handler: joinCallController(service),
    });
    app.get('/:callId', {
      preHandler: authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: getCallStatusController(service),
    });
    app.post('/:callId/end', {
      preHandler: authenticate,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      handler: endCallController(service),
    });
  };
}
