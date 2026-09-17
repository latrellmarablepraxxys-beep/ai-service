import request from 'supertest';
import {
  describe, expect, it, vi 
} from 'vitest';

import type { ConversationResponseData } from '@interfaces/conversation.js';
import type { ErrorResponse } from '@interfaces/errors.js';
import type { SuccessResponse } from '@interfaces/http.js';
import { buildExpressApp } from '@src/app.js';

import { stubDependencies } from './stubDependencies.js';

vi.mock('@config/aiApi.js',
  () => ({aiApiConfig: { apiKeys: ['test-api-key'] },}));

const URL = '/api/v1/tickets/TK-00001/conversations';

const validBody = {
  context_history: [
    {
      external_id: 'mid_0',
      role: 'user',
      body: 'Hi po',
    },
  ],
  latest_message: {
    external_id: 'mid_1',
    role: 'user',
    body: 'Magkano po?',
  },
  customer: { display_name: 'Juan' },
};

describe('POST /api/v1/tickets/:ticketId/conversations',
  () => {
    it('rejects a request without an API key',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post(URL)
          .send(validBody);

        expect(response.status).toBe(401);
        expect((response.body as ErrorResponse).error.code).toBe('UNAUTHORIZED');
      });

    it('rejects a request with a wrong API key',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post(URL)
          .set('X-Api-Key', 'wrong')
          .send(validBody);

        expect(response.status).toBe(401);
      });

    it('rejects an invalid payload with 422 field details',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post(URL)
          .set('X-Api-Key', 'test-api-key')
          .send({ context_history: [] });

        expect(response.status).toBe(422);
        const body = response.body as ErrorResponse;
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toHaveProperty('fields');
      });

    it('returns the AI reply in the success envelope',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post(URL)
          .set('X-Api-Key', 'test-api-key')
          .send(validBody);

        expect(response.status).toBe(200);
        const body = response.body as SuccessResponse<ConversationResponseData>;
        expect(body.success).toBe(true);
        // The stub LLM's canned reply is not decision JSON, so the pipeline
        // degrades to the hardcoded fallback line (no knowledge backend here).
        expect(body.data.reply).toBe(
          'Pasensya na po — pakiulit po ang inyong tanong, o ikokonekta ko po kayo sa aming team member na makakatulong.',
        );
        expect(body.data.reply_to_external_id).toBe('mid_1');
        expect(body.data.transfer_to_agent).toBe(false);
        expect(body.data.attachments).toEqual([]);
        expect(body.data.route).toBe('ai');
        expect(body.data.ai_routed).toBe(true);
        expect(body.data.language).toBe('Tagalog');
        expect(body.data.usage).toEqual({
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        });
      });
  });
