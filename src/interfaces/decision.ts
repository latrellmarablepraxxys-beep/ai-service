import type { AttachmentPurpose } from '../enums/AttachmentPurpose.js';
import type { ConversationStage } from '../enums/ConversationStage.js';
import type { DecisionAction } from '../enums/DecisionAction.js';
import type { EscalationTopic } from './knowledge.js';
import type { DecisionValidation } from './persistence.js';
import type { DetectedLanguage, TokenUsage } from './llm.js';

export type AiIntent =
  | 'GREETING'
  | 'PRODUCT_PRICE_INQUIRY'
  | 'INSTALLMENT_PRICE_INQUIRY'
  | 'CASH_PRICE_INQUIRY'
  | 'FREEBIES_INQUIRY'
  | 'APPLICATION_INQUIRY'
  | 'REQUIREMENTS_INQUIRY'
  | 'BRANCH_INQUIRY'
  | 'FOLLOW_UP'
  | 'RECOMMENDATION'
  | 'SECOND_HAND_INQUIRY'
  | 'PARTS_SERVICE_INQUIRY'
  | 'POST_PURCHASE'
  | 'RESTRICTED_TOPIC'
  | 'GENERAL_INQUIRY'
  | 'OTHER';

export type AiAttachmentType = 'image' | 'video' | 'file' | 'link';

export interface AiAttachmentReference {
  kind: string;
  id: string;
}

export interface AiAttachment {
  type: AiAttachmentType;
  url: string;
  name?: string | undefined;
  purpose: AttachmentPurpose;
  reference?: AiAttachmentReference | undefined;
}

export interface AiDecisionResponse {
  message: string;
  templateKey?: string | undefined;
  attachments: AiAttachment[];
}

export type EscalationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface AiDecisionEscalation {
  topicKey: string;
  reason: string;
  department: string;
  priority: EscalationPriority;
  summary: string;
}

export interface StateTransition {
  stage: ConversationStage;
  set?: Record<string, string | number | boolean | null> | undefined;
}

export type MemoryUpdateSource = 'customer_stated' | 'ai_inferred';

export interface MemoryUpdate {
  op: 'upsert' | 'invalidate';
  key: string;
  value?: string | undefined;
  source: MemoryUpdateSource;
  confidence: number;
}

export interface KnowledgeRef {
  key: string;
  version: number;
}

export interface AiDecisionMetadata {
  model?: string | undefined;
  promptKey?: string | undefined;
  promptVersion?: number | undefined;
  usage?: TokenUsage | undefined;
  latencyMs?: number | undefined;
}

export interface AiDecision {
  schemaVersion: number;
  intent: AiIntent;
  action: DecisionAction;
  confidence: number;
  language: DetectedLanguage;
  response: AiDecisionResponse;
  escalation: AiDecisionEscalation | null;
  stateTransition?: StateTransition | undefined;
  memoryUpdates?: MemoryUpdate[] | undefined;
  knowledgeUsed?: KnowledgeRef[] | undefined;
  metadata?: AiDecisionMetadata | undefined;
}

export interface DecisionPostCheckContext {
  guardHit?: EscalationTopic | null | undefined;
  paymentPreference?: string | null | undefined;
  variantCount?: number | undefined;
  selectedVariantId?: string | null | undefined;
  isFirstAssistantTurn?: boolean | undefined;
}

export interface ValidatedDecision {
  decision: AiDecision;
  validation: DecisionValidation;
  fallback: boolean;
  greeting: boolean;
}
