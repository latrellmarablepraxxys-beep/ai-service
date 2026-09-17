import { RunStatus } from '../../enums/RunStatus.js';
import type {
  ConversationResult,
  ConversationService,
  ConversationServiceOptions,
  HandleConversationInput,
  InboundConversationMessage,
  InboundCustomer,
} from '../../interfaces/conversation.js';
import type { ChatMessage } from '../../interfaces/llm.js';
import type { Message, Thread } from '../../interfaces/persistence.js';
import { buildResponseAgentMessages } from '../../prompts/ResponseAgent.js';

/** Upper bound on transcript turns fed back as prompt history. */
const MAX_HISTORY = 100;

/** Recent turns shared with the language detector to disambiguate short messages. */
const DETECTION_CONTEXT_TURNS = 6;

const buildCustomerContext = (customer: InboundCustomer | undefined): string | undefined => {
  if (customer?.displayName === undefined) return undefined;
  return `Name: ${customer.displayName}`;
};

const toChatMessage = (message: Message): ChatMessage => ({
  role: message.role,
  content: message.content,
});

const toPromptMessage = (message: InboundConversationMessage): ChatMessage => ({
  role: message.role,
  content: message.body,
});

const buildDetectionContext = (history: ChatMessage[]): string | undefined => {
  if (history.length === 0) return undefined;
  return history
    .slice(-DETECTION_CONTEXT_TURNS)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
};

/**
 * Handles an admin-posted conversation scoped to a ticket: resolves the thread,
 * appends context history (deduped by `externalId`), generates an AI reply with
 * the ResponseAgent prompt, detects the customer's language concurrently,
 * persists the reply + run, and returns the minimal result contract.
 */
export const createConversationService = (
  options: ConversationServiceOptions,
): ConversationService => {
  const {
    persistence, llm 
  } = options;

  const resolveThread = async (ticketId: string): Promise<Thread> => {
    const existing = await persistence.threads.findByTicketId(ticketId);
    if (existing !== null) return existing;
    return persistence.threads.create({
      ticketId,
      route: 'ai' 
    });
  };

  return {
    async handle(input: HandleConversationInput): Promise<ConversationResult> {
      const {
        ticketId, request 
      } = input;
      const thread = await resolveThread(ticketId);

      const history = await persistence.messages.listByThread(thread.id, { perPage: MAX_HISTORY });
      const knownExternalIds = new Set(
        history.items
          .map((message) => message.metadata.externalId)
          .filter((value): value is string => typeof value === 'string'),
      );

      const contextHistory = request.contextHistory ?? [];
      const inboundHistory = contextHistory.filter(
        (message) => message.externalId === undefined || !knownExternalIds.has(message.externalId),
      );

      for (const message of inboundHistory) {
        await persistence.messages.create({
          threadId: thread.id,
          role: message.role,
          content: message.body,
          metadata: message.externalId === undefined ? {} : { externalId: message.externalId },
        });
      }

      // The latest message is the turn to answer. It is always used for the
      // prompt, but only persisted when it has not been seen before.
      const latest = request.latestMessage;
      const latestIsNew = latest.externalId === undefined || !knownExternalIds.has(latest.externalId);
      if (latestIsNew) {
        await persistence.messages.create({
          threadId: thread.id,
          role: latest.role,
          content: latest.body,
          metadata: latest.externalId === undefined ? {} : { externalId: latest.externalId },
        });
      }

      const promptHistory: ChatMessage[] = [
        ...history.items.map(toChatMessage),
        ...inboundHistory.map(toPromptMessage),
      ];

      const customerContext = buildCustomerContext(request.customer);
      const run = await persistence.runs.create({
        threadId: thread.id,
        type: 'response',
        input: {
          ticketId,
          messageCount: contextHistory.length + 1 
        },
      });

      try {
        const messages = buildResponseAgentMessages({
          userMessage: latest.body,
          history: promptHistory,
          ...(customerContext === undefined ? {} : { context: { customerContext } }),
        });

        // Detection runs alongside the reply; a detection failure degrades to
        // `null` and never blocks the reply.
        const detectionContext = buildDetectionContext(promptHistory);
        const languagePromise = llm
          .detectLanguage({
            text: latest.body,
            ...(detectionContext === undefined ? {} : { context: detectionContext }),
          })
          .then((detected) => detected.language)
          .catch(() => null);

        const completion = await llm.chat({ messages });
        const language = await languagePromise;

        const reply = await persistence.messages.create({
          threadId: thread.id,
          role: 'assistant',
          content: completion.content,
          ...(completion.usage === undefined ? {} : { tokenCount: completion.usage.totalTokens }),
        });

        await persistence.runs.update(run.id, {
          status: RunStatus.Completed,
          output: { messageId: reply.id },
          completedAt: new Date().toISOString(),
        });

        return {
          reply: reply.content,
          replyToExternalId: latest.externalId ?? null,
          transferToAgent: null,
          media: null,
          route: 'ai',
          aiRouted: true,
          language,
          usage: completion.usage ?? null,
        };
      } catch (error) {
        await persistence.runs.update(run.id, {
          status: RunStatus.Failed,
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString(),
        });
        throw error;
      }
    },
  };
};
