import {
  describe, expect, it 
} from 'vitest';

import {
  LANGUAGE_DETECTOR_SYSTEM_PROMPT,
  buildLanguageDetectorMessages,
} from '@prompts/LanguageDetector.js';

describe('LANGUAGE_DETECTOR_SYSTEM_PROMPT',
  () => {
    it('defines the three allowed languages',
      () => {
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('"English"');
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('"Tagalog"');
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('"Taglish"');
      });

    it('specifies the JSON output shape',
      () => {
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('"language"');
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('"confidence"');
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('JSON');
      });

    it('defaults to Tagalog when undecidable and forbids answering the message',
      () => {
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('prefer "Tagalog"');
        expect(LANGUAGE_DETECTOR_SYSTEM_PROMPT).toContain('never translate');
      });
  });

describe('buildLanguageDetectorMessages',
  () => {
    it('puts the system prompt first and the message last',
      () => {
        const messages = buildLanguageDetectorMessages({ text: 'Magkano po?' });

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({
          role: 'system',
          content: LANGUAGE_DETECTOR_SYSTEM_PROMPT,
        });
        expect(messages[1]?.content).toContain('Magkano po?');
        expect(messages[1]?.content).not.toContain('<recent_context>');
      });

    it('wraps the recent context when provided',
      () => {
        const messages = buildLanguageDetectorMessages({
          text: 'sige po',
          context: 'user: hello\nassistant: hi po',
        });

        const content = messages[1]?.content ?? '';
        expect(content).toContain('<recent_context>');
        expect(content).toContain('user: hello');
        expect(content).toContain('sige po');
      });
  });
