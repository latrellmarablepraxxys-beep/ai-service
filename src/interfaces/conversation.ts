import type { TicketRoute } from './domain.js';
import type {
  DetectedLanguage, LlmProvider, TokenUsage 
} from './llm.js';
import type { MessageRole, Persistence } from './persistence.js';

export type ConversationAttachmentKind = 'image' | 'file';

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

export interface ConversationMedia {
  kind: ConversationAttachmentKind;
  url: string;
  name?: string | undefined;
}

/** Internal result of a conversation turn. Serialized to the wire by the controller. */
export interface ConversationResult {
  reply: string;
  replyToExternalId: string | null;
  transferToAgent: null;
  media: ConversationMedia | null;
  route: TicketRoute;
  aiRouted: boolean;
  language: DetectedLanguage | null;
  usage: TokenUsage | null;
}

/** Wire shape returned under `data` (snake_case, admin-aligned). */
export interface ConversationResponseData {
  reply: string;
  reply_to_external_id: string | null;
  transfer_to_agent: null;
  media: ConversationMedia | null;
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
  persistence: Persistence;
  llm: LlmProvider;
}
