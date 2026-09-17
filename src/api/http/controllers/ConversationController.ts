import type { RequestHandler } from 'express';

import type {
  ConversationResponseData,
  ConversationResult,
  ConversationService,
} from '../../../interfaces/conversation.js';
import type { SuccessResponse } from '../../../interfaces/http.js';
import type { ConversationBody, ConversationParams } from '../validators/ConversationValidator.js';

export interface ConversationControllerDependencies {
  conversationService: ConversationService;
}

/** Maps the internal camelCase result onto the snake_case wire contract. */
const toResponseData = (result: ConversationResult): ConversationResponseData => ({
  reply: result.reply,
  reply_to_external_id: result.replyToExternalId,
  transfer_to_agent: result.transferToAgent,
  media: result.media,
  route: result.route,
  ai_routed: result.aiRouted,
  language: result.language,
  usage: result.usage === null
    ? null
    : {
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      total_tokens: result.usage.totalTokens,
    },
});

/** Thin handler: validated input in, `{ success, data }` out. Errors go to the error handler. */
export const createConversationController = (
  dependencies: ConversationControllerDependencies,
): RequestHandler => {
  const { conversationService } = dependencies;

  return async (req, res, next) => {
    try {
      const { ticketId } = req.params as ConversationParams;
      const body = req.body as ConversationBody;

      const result = await conversationService.handle({
        ticketId,
        request: body 
      });

      const response: SuccessResponse<ConversationResponseData> = {
        success: true,
        data: toResponseData(result),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
};
