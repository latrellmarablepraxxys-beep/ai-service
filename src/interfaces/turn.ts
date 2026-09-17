import type {
  AiAttachment,
  AiDecision,
  KnowledgeRef,
} from './decision.js';
import type {
  ConversationResult,
  HandleConversationInput,
} from './conversation.js';
import type {
  CatalogProduct,
  EscalationTopic,
} from './knowledge.js';
import type {
  ChatMessage,
  DetectedLanguage,
  LlmProvider,
  TokenUsage,
} from './llm.js';
import type {
  ConversationState,
  Persistence,
  Thread,
} from './persistence.js';
import type { KnowledgeService } from './knowledge.js';

export interface TurnPipelineOptions {
  persistence: Persistence;
  llm: LlmProvider;
  knowledge: KnowledgeService;
}

export interface TurnPipeline {
  execute(input: HandleConversationInput): Promise<ConversationResult>;
}

export interface LoadTurnContextInput {
  persistence: Persistence;
  ticketId: string;
  threadId?: string | undefined;
  request: HandleConversationInput['request'];
}

export interface LoadedTurnContext {
  thread: Thread;
  state: ConversationState | null;
  history: ChatMessage[];
  isFirstAssistantTurn: boolean;
}

export interface ApplyDecisionInput {
  persistence: Persistence;
  knowledge: KnowledgeService;
  thread: Thread;
  state: ConversationState | null;
  rawDecision: unknown;
  guardHit: EscalationTopic | null;
  isFirstAssistantTurn: boolean;
  language: DetectedLanguage | null;
  usage: TokenUsage | null;
  model: string | undefined;
  latencyMs: number;
  runId: string;
  replyToExternalId: string | null;
  baseKnowledgeUsed: KnowledgeRef[];
}

export interface BuildTurnPromptInput {
  userMessage: string;
  history: ChatMessage[];
  customerName?: string | undefined;
  stateSummary?: string | undefined;
  topics: EscalationTopic[];
}

export interface RenderInput {
  knowledge: KnowledgeService;
  knowledgeUsed: KnowledgeRef[];
  templateKey: string;
  decision: AiDecision;
  merged: Record<string, unknown>;
  catalog: CatalogProduct[] | null;
}

export interface RenderedTemplate {
  message: string;
  attachments: AiAttachment[];
}
