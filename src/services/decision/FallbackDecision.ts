import { DecisionAction } from '../../enums/DecisionAction.js';
import type { AiDecision } from '../../interfaces/decision.js';

export const FALLBACK_TEMPLATE_KEY = 'fallback.general';

export const buildFallbackDecision = (_reason: string): AiDecision => ({
  schemaVersion: 1,
  intent: 'GENERAL_INQUIRY',
  action: DecisionAction.Respond,
  confidence: 0,
  language: 'Tagalog',
  response: {
    message:
      'Pasensya na po — pakiulit po ang inyong tanong, o ikokonekta ko po kayo sa aming team member na makakatulong.',
    attachments: [],
  },
  escalation: null,
});
