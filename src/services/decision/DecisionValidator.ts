import { ConversationStage } from '../../enums/ConversationStage.js';
import { DecisionAction } from '../../enums/DecisionAction.js';
import type {
  AiDecision,
  AiIntent,
  DecisionPostCheckContext,
  ValidatedDecision,
} from '../../interfaces/decision.js';
import type { EscalationTopic } from '../../interfaces/knowledge.js';
import { buildFallbackDecision } from './FallbackDecision.js';
import { parseAiDecisionWire } from './DecisionSchema.js';

const PRICE_INTENTS: readonly AiIntent[] = [
  'PRODUCT_PRICE_INQUIRY',
  'INSTALLMENT_PRICE_INQUIRY',
  'CASH_PRICE_INQUIRY',
];

const MIN_INFERRED_CONFIDENCE = 0.7;

const isPriceIntent = (intent: AiIntent): boolean => PRICE_INTENTS.includes(intent);

const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value.length > 0;

const toGuardEscalation = (decision: AiDecision, guardHit: EscalationTopic): AiDecision => ({
  ...decision,
  action: DecisionAction.Escalate,
  response: {
    message: '',
    templateKey: guardHit.fallbackTemplateKey,
    attachments: [],
  },
  escalation: {
    topicKey: guardHit.key,
    reason: 'Restricted topic matched deterministically',
    department: guardHit.department,
    priority: guardHit.priority,
    summary: `Customer message matched restricted topic ${guardHit.key}.`,
  },
  stateTransition: {
    stage: ConversationStage.Escalated,
    set: { escalation_topic: guardHit.key },
  },
});

const toClarification = (
  decision: AiDecision,
  templateKey: string,
  stage: ConversationStage,
): AiDecision => ({
  ...decision,
  action: DecisionAction.AskClarification,
  response: {
    message: '',
    templateKey,
    attachments: [],
  },
  stateTransition: {
    stage,
    ...(decision.stateTransition?.set !== undefined && { set: decision.stateTransition.set }),
  },
});

const toFallback = (reason: string): ValidatedDecision => ({
  decision: buildFallbackDecision(reason),
  validation: {
    valid: false,
    errors: [reason],
  },
  fallback: true,
  greeting: false,
});

export const validateDecision = (
  raw: unknown,
  context?: DecisionPostCheckContext,
): ValidatedDecision => {
  const active: DecisionPostCheckContext = context ?? {};

  let decision: AiDecision;
  try {
    decision = parseAiDecisionWire(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI decision is invalid';
    return toFallback(message);
  }

  const guardHit = active.guardHit ?? null;
  if (guardHit !== null) {
    const matchesGuard =
      decision.action === DecisionAction.Escalate &&
      decision.escalation?.topicKey === guardHit.key;
    if (!matchesGuard) decision = toGuardEscalation(decision, guardHit);
  } else if (decision.action === DecisionAction.Escalate) {
    return toFallback('LLM escalation references an unknown topic');
  }

  // Variant gating runs before payment gating: the pipeline resolves which
  // unit the customer means before asking how they want to pay for it, so the
  // variant question must win when both answers are still missing.
  if (
    isPriceIntent(decision.intent) &&
    decision.action === DecisionAction.Respond &&
    (active.variantCount ?? 0) > 1 &&
    !hasText(active.selectedVariantId)
  ) {
    decision = toClarification(decision, 'pricing.ask_variant', ConversationStage.AwaitingVariant);
  }

  if (
    isPriceIntent(decision.intent) &&
    decision.action === DecisionAction.Respond &&
    (decision.response.templateKey?.startsWith('price.') ?? false) &&
    !hasText(active.paymentPreference)
  ) {
    decision = toClarification(
      decision,
      'pricing.ask_payment_type',
      ConversationStage.AwaitingPaymentType,
    );
  }

  if (decision.memoryUpdates !== undefined) {
    decision = {
      ...decision,
      memoryUpdates: decision.memoryUpdates.filter(
        (entry) => entry.source !== 'ai_inferred' || entry.confidence >= MIN_INFERRED_CONFIDENCE,
      ),
    };
  }

  return {
    decision,
    validation: {
      valid: true,
      errors: [],
    },
    fallback: false,
    greeting: active.isFirstAssistantTurn === true,
  };
};
