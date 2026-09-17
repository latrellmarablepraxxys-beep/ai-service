import type { ChatMessage } from '../../interfaces/llm.js';
import type { Message, Thread } from '../../interfaces/persistence.js';
import type {
  LoadedTurnContext,
  LoadTurnContextInput,
} from '../../interfaces/turn.js';

/** Upper bound on transcript turns fed back as prompt history. */
const MAX_HISTORY = 100;

const toChatMessage = (message: Message): ChatMessage => ({
  role: message.role,
  content: message.content,
});

const toPromptMessage = (
  message: LoadTurnContextInput['request']['latestMessage'],
): ChatMessage => ({
  role: message.role,
  content: message.body,
});

/**
 * Resolves the thread, dedupes + persists inbound turns, and assembles the
 * prompt history. First-turn detection reads the combined transcript (stored
 * plus inbound) before this turn's reply exists.
 */
export const loadTurnContext = async (
  input: LoadTurnContextInput,
): Promise<LoadedTurnContext> => {
  const {
    persistence, ticketId, request 
  } = input;

  let thread: Thread | null = input.threadId === undefined
    ? await persistence.threads.findByTicketId(ticketId)
    : await persistence.threads.findById(input.threadId);
  if (thread === null) {
    thread = await persistence.threads.create({
      ticketId,
      route: 'ai',
    });
  }

  const history = await persistence.messages.listByThread(thread.id, { perPage: MAX_HISTORY });
  const knownExternalIds = new Set(
    history.items
      .map((message) => message.metadata.externalId)
      .filter((value): value is string => typeof value === 'string'),
  );

  const contextHistory = request.contextHistory ?? [];
  // Phase-1 contract: inbound attachments are accepted by the validator but
  // dropped here — neither persisted on the message record nor fed to renders,
  // which attach server-built images only.
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
    // The latest message may repeat a context_history id (replayed webhooks);
    // without this the id below reads as unseen and persists a duplicate.
    if (message.externalId !== undefined) knownExternalIds.add(message.externalId);
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

  const state = await persistence.conversationStates.findByThread(thread.id);
  const isFirstAssistantTurn = !promptHistory.some((message) => message.role === 'assistant');

  return {
    thread,
    state,
    history: promptHistory,
    isFirstAssistantTurn,
  };
};
