import { z } from 'zod';

import { AttachmentPurpose } from '../../enums/AttachmentPurpose.js';
import { ConversationStage } from '../../enums/ConversationStage.js';
import { DecisionAction } from '../../enums/DecisionAction.js';
import type {
  AiAttachment,
  AiDecision,
  AiDecisionEscalation,
  AiDecisionMetadata,
  KnowledgeRef,
  MemoryUpdate,
  StateTransition,
} from '../../interfaces/decision.js';
import { AppError } from '../../utils/errors.js';

const INTENT_VALUES = [
  'GREETING',
  'PRODUCT_PRICE_INQUIRY',
  'INSTALLMENT_PRICE_INQUIRY',
  'CASH_PRICE_INQUIRY',
  'FREEBIES_INQUIRY',
  'APPLICATION_INQUIRY',
  'REQUIREMENTS_INQUIRY',
  'BRANCH_INQUIRY',
  'FOLLOW_UP',
  'RECOMMENDATION',
  'SECOND_HAND_INQUIRY',
  'PARTS_SERVICE_INQUIRY',
  'POST_PURCHASE',
  'RESTRICTED_TOPIC',
  'GENERAL_INQUIRY',
  'OTHER',
] as const;

const attachmentWireSchema = z
  .object({
    type: z.enum([
      'image',
      'video',
      'file',
      'link',
    ]),
    url: z.string().url(),
    name: z.string().optional(),
    purpose: z.nativeEnum(AttachmentPurpose),
    reference: z
      .object({
        kind: z.string(),
        id: z.string(),
      })
      .strip()
      .optional(),
  })
  .strip();

const responseWireSchema = z
  .object({
    message: z.string().min(1),
    template_key: z.string().optional(),
    attachments: z.array(attachmentWireSchema).default([]),
  })
  .strip();

const escalationWireSchema = z
  .object({
    topic_key: z.string().min(1),
    reason: z.string().min(1),
    department: z.string().min(1),
    priority: z.enum([
      'LOW',
      'MEDIUM',
      'HIGH',
      'URGENT',
    ]),
    summary: z.string().min(1),
  })
  .strip();

const stateTransitionWireSchema = z
  .object({
    stage: z.nativeEnum(ConversationStage),
    set: z
      .record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
        ]),
      )
      .optional(),
  })
  .strip();

const memoryUpdateWireSchema = z
  .object({
    op: z.enum([
      'upsert',
      'invalidate',
    ]),
    key: z.string().min(1),
    value: z.string().optional(),
    source: z.enum([
      'customer_stated',
      'ai_inferred',
    ]),
    confidence: z.number().min(0).max(1),
  })
  .strip();

const knowledgeRefWireSchema = z
  .object({
    key: z.string(),
    version: z.number().int().positive(),
  })
  .strip();

const metadataWireSchema = z
  .object({
    model: z.string().optional(),
    prompt_key: z.string().optional(),
    prompt_version: z.number().int().optional(),
    usage: z
      .object({
        prompt_tokens: z.number().int(),
        completion_tokens: z.number().int(),
        total_tokens: z.number().int(),
      })
      .strip()
      .optional(),
    latency_ms: z.number().int().optional(),
  })
  .strip();

const toAttachment = (wire: z.infer<typeof attachmentWireSchema>): AiAttachment => ({
  type: wire.type,
  url: wire.url,
  ...(wire.name !== undefined && { name: wire.name }),
  purpose: wire.purpose,
  ...(wire.reference !== undefined && { reference: wire.reference }),
});

const toEscalation = (
  wire: z.infer<typeof escalationWireSchema> | null,
): AiDecisionEscalation | null => {
  if (wire === null) return null;
  return {
    topicKey: wire.topic_key,
    reason: wire.reason,
    department: wire.department,
    priority: wire.priority,
    summary: wire.summary,
  };
};

const toStateTransition = (wire: z.infer<typeof stateTransitionWireSchema>): StateTransition => ({
  stage: wire.stage,
  ...(wire.set !== undefined && { set: wire.set }),
});

const toMemoryUpdates = (wire: z.infer<typeof memoryUpdateWireSchema>[]): MemoryUpdate[] =>
  wire.map(
    (entry): MemoryUpdate => ({
      op: entry.op,
      key: entry.key,
      ...(entry.value !== undefined && { value: entry.value }),
      source: entry.source,
      confidence: entry.confidence,
    }),
  );

const toKnowledgeUsed = (wire: z.infer<typeof knowledgeRefWireSchema>[]): KnowledgeRef[] =>
  wire.map(
    (entry): KnowledgeRef => ({
      key: entry.key,
      version: entry.version,
    }),
  );

const toMetadata = (wire: z.infer<typeof metadataWireSchema>): AiDecisionMetadata => ({
  ...(wire.model !== undefined && { model: wire.model }),
  ...(wire.prompt_key !== undefined && { promptKey: wire.prompt_key }),
  ...(wire.prompt_version !== undefined && { promptVersion: wire.prompt_version }),
  ...(wire.usage !== undefined && {
    usage: {
      promptTokens: wire.usage.prompt_tokens,
      completionTokens: wire.usage.completion_tokens,
      totalTokens: wire.usage.total_tokens,
    },
  }),
  ...(wire.latency_ms !== undefined && { latencyMs: wire.latency_ms }),
});

const decisionWireObjectSchema = z
  .object({
    schema_version: z.literal(1),
    intent: z.enum(INTENT_VALUES),
    action: z.nativeEnum(DecisionAction),
    confidence: z.number().min(0).max(1),
    language: z.enum([
      'English',
      'Tagalog',
      'Taglish',
    ]),
    response: responseWireSchema,
    escalation: escalationWireSchema.nullable(),
    state_transition: stateTransitionWireSchema.optional(),
    memory_updates: z.array(memoryUpdateWireSchema).optional(),
    knowledge_used: z.array(knowledgeRefWireSchema).optional(),
    metadata: metadataWireSchema.optional(),
  })
  .strip()
  .transform(
    (wire): AiDecision => ({
      schemaVersion: wire.schema_version,
      intent: wire.intent,
      action: wire.action,
      confidence: wire.confidence,
      language: wire.language,
      response: {
        message: wire.response.message,
        ...(wire.response.template_key !== undefined && {templateKey: wire.response.template_key,}),
        attachments: wire.response.attachments.map(toAttachment),
      },
      escalation: toEscalation(wire.escalation),
      ...(wire.state_transition !== undefined && {stateTransition: toStateTransition(wire.state_transition),}),
      ...(wire.memory_updates !== undefined && {memoryUpdates: toMemoryUpdates(wire.memory_updates),}),
      ...(wire.knowledge_used !== undefined && {knowledgeUsed: toKnowledgeUsed(wire.knowledge_used),}),
      ...(wire.metadata !== undefined && { metadata: toMetadata(wire.metadata) }),
    }),
  );

export type AiDecisionWire = z.input<typeof decisionWireObjectSchema> | string;

const summarizeIssues = (issues: z.ZodIssue[]): string => {
  const summary = issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
    .join('; ');
  return summary.length > 500 ? `${summary.slice(0, 500)}…` : summary;
};

export const aiDecisionWireSchema = z.unknown().transform((raw, ctx): AiDecision => {
  let coerced: unknown = raw;
  if (typeof raw === 'string') {
    try {
      coerced = JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Response is not valid JSON',
      });
      return z.NEVER;
    }
  }
  const parsed = decisionWireObjectSchema.safeParse(coerced);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) ctx.addIssue(issue);
    return z.NEVER;
  }
  return parsed.data;
}) as z.ZodType<AiDecision, z.ZodTypeDef, AiDecisionWire>;

export const parseAiDecisionWire = (raw: unknown): AiDecision => {
  const parsed = aiDecisionWireSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'DECISION_PARSE_ERROR',
      502,
      `AI decision is invalid: ${summarizeIssues(parsed.error.issues)}`,
    );
  }
  return parsed.data;
};
