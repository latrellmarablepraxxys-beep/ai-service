import type {
  ConversationResult,
  ConversationService,
  ConversationServiceOptions,
  HandleConversationInput,
} from '../../interfaces/conversation.js';

/**
 * Thin facade over the turn pipeline. Threading, escalation guarding,
 * decision validation, template rendering, and persistence all live in
 * `src/services/turn/` — this file only owns the service boundary.
 */
export const createConversationService = (
  options: ConversationServiceOptions,
): ConversationService => {
  const { pipeline } = options;

  return {
    async handle(input: HandleConversationInput): Promise<ConversationResult> {
      return pipeline.execute(input);
    },
  };
};
