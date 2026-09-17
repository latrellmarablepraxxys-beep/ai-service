import {
  describe, expect, it 
} from 'vitest';

import type { ChatMessage } from '@interfaces/llm.js';
import {MEMORY_SUMMARY_SYSTEM_PROMPT, buildMemorySummaryMessages} from '@prompts/MemorySummary.js';

describe('MEMORY_SUMMARY_SYSTEM_PROMPT',
  () => {
    it('describes a rolling merge, not a replacement',
      () => {
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('rolling summary');
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('Merge, do not replace');
      });

    it('lists the facts to capture',
      () => {
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('Language');
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('Purchase intent stage');
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('Units and models discussed');
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('escalation topic');
      });

    it('enforces the token budget and forbids invention',
      () => {
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('300 tokens');
        expect(MEMORY_SUMMARY_SYSTEM_PROMPT).toContain('Do not invent');
      });
  });

describe('buildMemorySummaryMessages',
  () => {
    it('renders the conversation transcript as role-prefixed lines',
      () => {
        const messages: ChatMessage[] = [
          {
            role: 'user',
            content: 'Magkano po?' 
          },
          {
            role: 'assistant',
            content: 'Ano pong unit?' 
          },
        ];

        const built = buildMemorySummaryMessages({ messages });
        const content = built[1]?.content ?? '';

        expect(content).toContain('<conversation>');
        expect(content).toContain('user: Magkano po?');
        expect(content).toContain('assistant: Ano pong unit?');
      });

    it('includes the previous summary when provided',
      () => {
        const built = buildMemorySummaryMessages({
          messages: [
            {
              role: 'user',
              content: 'Hello' 
            }
          ],
          previousSummary: 'Customer wants a Click 125',
        });

        const content = built[1]?.content ?? '';
        expect(content).toContain('<previous_summary>');
        expect(content).toContain('Customer wants a Click 125');
      });

    it('omits the previous summary section when absent',
      () => {
        const built = buildMemorySummaryMessages({
          messages: [
            {
              role: 'user',
              content: 'Hello' 
            }
          ],
        });

        const content = built[1]?.content ?? '';
        expect(content).not.toContain('<previous_summary>');
      });
  });
