import { Router } from 'express';

import type { AppDependencies } from '../../../interfaces/http.js';
import { domainConfig } from '../../../config/domain.js';
import { knowledgeConfig } from '../../../config/knowledge.js';
import { createConversationService } from '../../../services/conversation/ConversationService.js';
import { createDomainHttpClient } from '../../../services/domain/DomainHttpClient.js';
import { createKnowledgeService } from '../../../services/knowledge/KnowledgeService.js';
import { createTurnPipeline } from '../../../services/turn/TurnPipeline.js';
import { createConversationController } from '../controllers/ConversationController.js';
import { createApiKeyAuth } from '../middleware/ApiKeyAuth.js';
import {
  validateConversationBody,
  validateConversationParams,
} from '../validators/ConversationValidator.js';

/**
 * Versioned admin API mounted at `/api/v1`. Every route is guarded by the
 * shared API key; callers are the MotorCentral admin app (server-to-server).
 */
export const createV1Router = (dependencies: AppDependencies): Router => {
  const router = Router();
  const knowledge = createKnowledgeService({
    client: createDomainHttpClient({
      baseUrl: domainConfig.baseUrl,
      apiKey: domainConfig.apiKey,
      timeoutMs: domainConfig.timeoutMs,
    }),
    cache: dependencies.cache,
    ttlSeconds: knowledgeConfig.ttlSeconds,
  });
  const pipeline = createTurnPipeline({
    persistence: dependencies.persistence,
    llm: dependencies.llm,
    knowledge,
  });
  const conversationService = createConversationService({ pipeline });

  router.post('/tickets/:ticketId/conversations',
    createApiKeyAuth(),
    validateConversationParams,
    validateConversationBody,
    createConversationController({ conversationService }));

  return router;
};
