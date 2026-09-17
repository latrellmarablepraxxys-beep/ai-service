import { Router } from 'express';

import { appConfig } from '../config/app.js';
import {
  listAiResponseTemplates,
  listBranches,
  listEscalationTopics,
  listKnowledgeEntries,
  listMotorcycles,
  listPromotions,
} from './listers.js';
import { mockRequiresPlatform } from './middleware/RequiresPlatform.js';
import { mockValidApiKey } from './middleware/ValidApiKey.js';
import { sendSuccess, sendValidationError } from './responses.js';
import {
  aiResponseTemplateQuerySchema,
  branchQuerySchema,
  escalationTopicQuerySchema,
  knowledgeEntryQuerySchema,
  motorcycleQuerySchema,
  promotionQuerySchema,
  toValidationError,
} from './validators.js';

/**
 * Mock of the Laravel admin's `/api/v1`. Mirrors the real route table:
 * `health` needs the platform header; the three list endpoints are
 * service-to-service and only need the API key (applied router-wide).
 */
export const createMockAdminRouter = (): Router => {
  const router = Router();

  router.use(mockValidApiKey);

  router.get('/health', mockRequiresPlatform, (_req, res) => {
    sendSuccess(res, {
      status: 'ok',
      environment: appConfig.env,
      database: 'ok',
      timestamp: new Date().toISOString(),
    }, 'Service is healthy.');
  });

  router.get('/motorcycles', (req, res) => {
    const parsed = motorcycleQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const {
        message, fields 
      } = toValidationError(parsed.error);
      sendValidationError(res, message, fields);
      return;
    }

    const {
      items, meta 
    } = listMotorcycles(parsed.data);
    sendSuccess(res, items, 'Motorcycles retrieved.', meta);
  });

  router.get('/branches', (req, res) => {
    const parsed = branchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const {
        message, fields 
      } = toValidationError(parsed.error);
      sendValidationError(res, message, fields);
      return;
    }

    const {
      items, meta 
    } = listBranches(parsed.data);
    sendSuccess(res, items, 'Branches retrieved.', meta);
  });

  router.get('/ai-response-templates', (req, res) => {
    const parsed = aiResponseTemplateQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const {
        message, fields 
      } = toValidationError(parsed.error);
      sendValidationError(res, message, fields);
      return;
    }

    const {
      items, meta 
    } = listAiResponseTemplates(parsed.data);
    sendSuccess(res, items, 'AI response templates retrieved.', meta);
  });

  router.get('/knowledge-entries', (req, res) => {
    const parsed = knowledgeEntryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const {
        message, fields 
      } = toValidationError(parsed.error);
      sendValidationError(res, message, fields);
      return;
    }

    const {
      items, meta 
    } = listKnowledgeEntries(parsed.data);
    sendSuccess(res, items, 'Knowledge entries retrieved.', meta);
  });

  router.get('/escalation-topics', (req, res) => {
    const parsed = escalationTopicQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const {
        message, fields 
      } = toValidationError(parsed.error);
      sendValidationError(res, message, fields);
      return;
    }

    const {
      items, meta 
    } = listEscalationTopics(parsed.data);
    sendSuccess(res, items, 'Escalation topics retrieved.', meta);
  });

  router.get('/promotions', (req, res) => {
    const parsed = promotionQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const {
        message, fields 
      } = toValidationError(parsed.error);
      sendValidationError(res, message, fields);
      return;
    }

    const {
      items, meta 
    } = listPromotions(parsed.data);
    sendSuccess(res, items, 'Promotions retrieved.', meta);
  });

  return router;
};
