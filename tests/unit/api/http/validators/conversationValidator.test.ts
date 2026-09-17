import {
  describe, expect, it 
} from 'vitest';

import {
  conversationBodySchema,
  conversationParamsSchema,
} from '@api/http/validators/ConversationValidator.js';

describe('conversationParamsSchema',
  () => {
    it('accepts a non-empty ticketId',
      () => {
        const result = conversationParamsSchema.safeParse({ ticketId: 'TK-00001' });

        expect(result.success).toBe(true);
      });

    it('rejects a blank ticketId',
      () => {
        expect(conversationParamsSchema.safeParse({ ticketId: '' }).success).toBe(false);
        expect(conversationParamsSchema.safeParse({}).success).toBe(false);
      });
  });

describe('conversationBodySchema',
  () => {
    it('accepts a minimal conversation and defaults context history to empty',
      () => {
        const result = conversationBodySchema.safeParse({
          latest_message: {
            role: 'user',
            body: 'Magkano po?' 
          },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.latestMessage).toEqual({
            role: 'user',
            body: 'Magkano po?' 
          });
          expect(result.data.contextHistory).toEqual([]);
        }
      });

    it('maps snake_case input onto the camelCase request contract',
      () => {
        const result = conversationBodySchema.safeParse({
          context_history: [
            {
              external_id: 'mid_100',
              role: 'assistant',
              body: 'Hello po!',
              sent_at: '2026-09-17T12:58:00Z',
            },
          ],
          latest_message: {
            external_id: 'mid_123',
            role: 'user',
            body: 'Ano po ito?',
            attachments: [
              {
                type: 'image',
                url: 'https://cdn.example.com/a.jpg' 
              }
            ],
            sent_at: '2026-09-17T13:00:00Z',
          },
          customer: { display_name: 'Juan' },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.latestMessage).toEqual({
            externalId: 'mid_123',
            role: 'user',
            body: 'Ano po ito?',
            attachments: [
              {
                type: 'image',
                url: 'https://cdn.example.com/a.jpg' 
              }
            ],
            sentAt: '2026-09-17T13:00:00Z',
          });
          expect(result.data.contextHistory).toEqual([
            {
              externalId: 'mid_100',
              role: 'assistant',
              body: 'Hello po!',
              sentAt: '2026-09-17T12:58:00Z',
            },
          ]);
          expect(result.data.customer).toEqual({ displayName: 'Juan' });
        }
      });

    it('allows an empty context history',
      () => {
        const result = conversationBodySchema.safeParse({
          context_history: [],
          latest_message: {
            role: 'user',
            body: 'Hi' 
          },
        });

        expect(result.success).toBe(true);
      });

    it('requires latest_message',
      () => {
        expect(conversationBodySchema.safeParse({}).success).toBe(false);
        expect(conversationBodySchema.safeParse({ context_history: [] }).success).toBe(false);
      });

    it('rejects an unknown role and a blank body',
      () => {
        expect(conversationBodySchema.safeParse({
          latest_message: {
            role: 'robot',
            body: 'hi' 
          },
        }).success).toBe(false);
        expect(conversationBodySchema.safeParse({
          latest_message: {
            role: 'user',
            body: '' 
          },
        }).success).toBe(false);
      });

    it('rejects an invalid attachment url',
      () => {
        const result = conversationBodySchema.safeParse({
          latest_message: {
            role: 'user',
            body: 'hi',
            attachments: [
              {
                type: 'image',
                url: 'not-a-url' 
              }
            ],
          },
        });

        expect(result.success).toBe(false);
      });

    it('strips unknown fields, including customer channel and language',
      () => {
        const result = conversationBodySchema.safeParse({
          latest_message: {
            role: 'user',
            body: 'hi',
            unexpected: true,
          },
          customer: {
            display_name: 'Juan',
            channel: 'messenger',
            language: 'Taglish',
          },
          extra: 'nope',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('extra');
          expect(result.data.latestMessage).not.toHaveProperty('unexpected');
          expect(result.data.customer).toEqual({ displayName: 'Juan' });
        }
      });
  });
