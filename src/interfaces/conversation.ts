import type { AiAttachment } from './decision.js';
import type { TicketRoute } from './domain.js';
import type {DetectedLanguage, TokenUsage} from './llm.js';
import type { MessageRole } from './persistence.js';
import type { TurnPipeline } from './turn.js';

export interface InboundAttachment {
  type: string;
  url: string;
}

export interface InboundConversationMessage {
  externalId?: string | undefined;
  role: MessageRole;
  body: string;
  attachments?: InboundAttachment[] | undefined;
  sentAt?: string | undefined;
}

export interface InboundCustomer {
  displayName?: string | undefined;
}

export interface ConversationRequest {
  contextHistory?: InboundConversationMessage[] | undefined;
  latestMessage: InboundConversationMessage;
  customer?: InboundCustomer | undefined;
}

/** Internal result of a conversation turn. Serialized to the wire by the controller. */
export interface ConversationResult {
  reply: string;
  replyToExternalId: string | null;
  transferToAgent: boolean;
  attachments: AiAttachment[];
  route: TicketRoute;
  aiRouted: boolean;
  language: DetectedLanguage | null;
  usage: TokenUsage | null;
}

/** Wire shape returned under `data` (snake_case, admin-aligned). */
export interface ConversationResponseData {
  reply: string;
  reply_to_external_id: string | null;
  transfer_to_agent: boolean;
  attachments: AiAttachment[];
  route: TicketRoute;
  ai_routed: boolean;
  language: DetectedLanguage | null;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

export interface HandleConversationInput {
  ticketId: string;
  request: ConversationRequest;
}

export interface ConversationService {
  handle(input: HandleConversationInput): Promise<ConversationResult>;
}

export interface ConversationServiceOptions {
  pipeline: TurnPipeline;
}
