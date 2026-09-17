import { AttachmentPurpose } from '../../enums/AttachmentPurpose.js';
import { ConversationStage } from '../../enums/ConversationStage.js';
import { DecisionAction } from '../../enums/DecisionAction.js';
import { RunStatus } from '../../enums/RunStatus.js';
import type {
  AiAttachment,
  AiDecision,
  AiIntent,
  KnowledgeRef,
} from '../../interfaces/decision.js';
import type { ConversationResult } from '../../interfaces/conversation.js';
import type {
  CatalogProduct,
  CatalogVariant,
  KnowledgeService,
} from '../../interfaces/knowledge.js';
import type { DetectedLanguage } from '../../interfaces/llm.js';
import type {
  ApplyDecisionInput,
  RenderInput,
  RenderedTemplate,
} from '../../interfaces/turn.js';
import { RESPONSE_AGENT_VERSION } from '../../prompts/ResponseAgent.js';
import { parseAiDecisionWire } from '../decision/DecisionSchema.js';
import { validateDecision } from '../decision/DecisionValidator.js';
import {
  buildFallbackDecision,
  FALLBACK_TEMPLATE_KEY,
} from '../decision/FallbackDecision.js';
import {
  renderCashBlock,
  renderFreebiesList,
  renderInstallmentBlock,
  renderTemplate,
  spliceTemplate,
} from '../template/TemplateRenderer.js';

const STATE_SET_WHITELIST: readonly string[] = [
  'product_id',
  'product_name',
  'product_query',
  'selected_variant_id',
  'variant_name',
  'payment_preference',
  'pending_question',
  'escalation_topic',
];

const PRICE_INTENTS: readonly AiIntent[] = [
  'PRODUCT_PRICE_INQUIRY',
  'INSTALLMENT_PRICE_INQUIRY',
  'CASH_PRICE_INQUIRY',
];

/**
 * Deterministic stage assignment: the pipeline owns the stage, not the LLM.
 * `fallback.general` is intentionally absent — a general fallback never
 * advances the conversation.
 */
const TEMPLATE_STAGES: Record<string, ConversationStage> = {
  'price.installment':        ConversationStage.Quoted,
  'price.cash':               ConversationStage.Quoted,
  'pricing.ask_variant':      ConversationStage.AwaitingVariant,
  'pricing.ask_payment_type': ConversationStage.AwaitingPaymentType,
  'freebies.installment':     ConversationStage.FreebiesSent,
  'freebies.cash':            ConversationStage.FreebiesSent,
  'freebies.bajaj':           ConversationStage.FreebiesSent,
  'application.jotform_link': ConversationStage.ApplicationOffered,
  'greeting.initial':         ConversationStage.Greeted,
  'greeting.initial_en':      ConversationStage.Greeted,
  'fallback.escalation':      ConversationStage.Escalated,
};

const GREETING_TEMPLATE_KEYS: readonly string[] = [
  'greeting.initial',
  'greeting.initial_en',
];

const MERCHANTS_TEMPLATE_KEY = 'freebies.kaibigan_merchants';

// Single-branch default until Phase-3 per-branch pages land.
const DEFAULT_BRANCH_PAGE = 'Motorcentral Muntinlupa Page';

const readText = (data: Record<string, unknown>, key: string): string | null => {
  const value = data[key];
  return typeof value === 'string' ? value : null;
};

const mergeStateData = (
  current: Record<string, unknown>,
  set: Record<string, string | number | boolean | null> | undefined,
): Record<string, unknown> => {
  const merged = { ...current };
  if (set === undefined) return merged;
  for (const key of STATE_SET_WHITELIST) {
    if (key in set) merged[key] = set[key];
  }
  return merged;
};

const resolveCatalog = async (
  knowledge: KnowledgeService,
  merged: Record<string, unknown>,
): Promise<CatalogProduct[] | null> => {
  const query = readText(merged, 'product_query') ?? readText(merged, 'product_name') ?? '';
  if (query.trim().length === 0) return null;
  try {
    const products = await knowledge.findProducts(query);
    return products.length === 0 ? null : products;
  } catch {
    return null;
  }
};

const pickVariant = (
  catalog: CatalogProduct[] | null,
  merged: Record<string, unknown>,
): CatalogVariant | null => {
  const product = catalog?.[0] ?? null;
  if (product === undefined || product === null) return null;
  const selectedId = readText(merged, 'selected_variant_id');
  if (selectedId === null) return null;
  return product.variants.find((variant) => variant.id === selectedId) ?? null;
};

const variantImageAttachment = (variant: CatalogVariant): AiAttachment[] => {
  if (variant.imageUrl === null) return [];
  return [
    {
      type: 'image',
      url: variant.imageUrl,
      name: `${variant.productName} ${variant.variantName}`,
      purpose: AttachmentPurpose.ProductVariant,
      reference: {
        kind: 'product_variant',
        id: variant.id,
      },
    },
  ];
};

const renderKnowledgeTemplate = async (
  knowledge: KnowledgeService,
  knowledgeUsed: KnowledgeRef[],
  key: string,
  variables: Record<string, string>,
): Promise<string> => {
  const template = await knowledge.getTemplate(key);
  if (template === null) throw new Error(`knowledge template "${key}" not found`);
  const rendered = renderTemplate(template.content, variables);
  knowledgeUsed.push({
    key: template.key,
    version: template.version,
  });
  return rendered;
};

const freebiesApplicability = async (
  knowledge: KnowledgeService,
  merged: Record<string, unknown>,
): Promise<'installment' | 'cash' | 'bajaj' | null> => {
  const catalog = await resolveCatalog(knowledge, merged);
  const brand = catalog?.[0]?.brand.toUpperCase() ?? null;
  if (brand === 'BAJAJ') return 'bajaj';
  const preference = readText(merged, 'payment_preference');
  if (preference === 'installment' || preference === 'cash') return preference;
  return null;
};

const renderByTemplate = async (input: RenderInput): Promise<RenderedTemplate> => {
  const {
    knowledge, knowledgeUsed, templateKey, decision, merged, catalog 
  } = input;

  if (GREETING_TEMPLATE_KEYS.includes(templateKey)) {
    const message = await renderKnowledgeTemplate(knowledge, knowledgeUsed, templateKey, {branch_page: DEFAULT_BRANCH_PAGE,});
    return {
      message,
      attachments: [],
    };
  }

  if (templateKey === 'pricing.ask_variant') {
    const product = (await resolveCatalog(knowledge, merged))?.[0] ?? null;
    if (product === null) throw new Error('cannot ask for a variant without a matching product');
    const message = await renderKnowledgeTemplate(knowledge, knowledgeUsed, templateKey, {
      product_name: product.name,
      variant_list: product.variants.map((variant) => `• ${variant.variantName}`).join('\n'),
    });
    return {
      message,
      attachments: [],
    };
  }

  if (templateKey === 'pricing.ask_payment_type') {
    const message = await renderKnowledgeTemplate(knowledge, knowledgeUsed, templateKey, {});
    return {
      message,
      attachments: [],
    };
  }

  if (templateKey === 'price.installment') {
    const variant = pickVariant(catalog, merged);
    if (variant === null || variant.terms.length === 0 || variant.minDownpayment === null) {
      throw new Error('cannot quote installments without a priced variant');
    }
    knowledgeUsed.push({
      key: `catalog:variant:${variant.id}`,
      version: 1,
    });
    return {
      message: spliceTemplate(decision.response.message, renderInstallmentBlock({
        productName: variant.productName,
        variantName: variant.variantName,
        minDownpayment: variant.minDownpayment,
        terms: variant.terms,
        updatedPaymentLess: variant.updatedPaymentLess,
      })),
      // Pipeline-built attachments replace the LLM's entirely: the model
      // must never smuggle untrusted URLs into a quoted reply.
      attachments: variantImageAttachment(variant),
    };
  }

  if (templateKey === 'price.cash') {
    const variant = pickVariant(catalog, merged);
    if (variant === null || variant.cashPrice === null) {
      throw new Error('cannot quote cash without a priced variant');
    }
    knowledgeUsed.push({
      key: `catalog:variant:${variant.id}`,
      version: 1,
    });
    return {
      message: spliceTemplate(decision.response.message, renderCashBlock({
        productName: variant.productName,
        variantName: variant.variantName,
        cashPrice: variant.cashPrice,
      })),
      // Pipeline-built attachments replace the LLM's entirely: the model
      // must never smuggle untrusted URLs into a quoted reply.
      attachments: variantImageAttachment(variant),
    };
  }

  if (
    templateKey === 'freebies.installment' ||
    templateKey === 'freebies.cash' ||
    templateKey === 'freebies.bajaj'
  ) {
    const applicability = await freebiesApplicability(knowledge, merged);
    if (applicability === null) throw new Error('cannot quote freebies without a payment type');
    const promotion = await knowledge.getFreebies(applicability).catch(() => null);
    if (promotion === null) throw new Error(`no current ${applicability} freebies promotion`);
    const merchants = await knowledge.getTemplate(MERCHANTS_TEMPLATE_KEY)
      .then((entry) => entry?.content ?? null)
      .catch(() => null);
    const list = renderFreebiesList(promotion.items.map((item) => item.body));
    return {
      message: spliceTemplate(decision.response.message, merchants === null ? list : `${list}\n\n${merchants}`),
      attachments: [],
    };
  }

  if (templateKey === 'application.jotform_link') {
    const message = await renderKnowledgeTemplate(knowledge, knowledgeUsed, templateKey, {});
    return {
      message,
      attachments: [],
    };
  }

  if (templateKey === FALLBACK_TEMPLATE_KEY || templateKey === 'fallback.escalation') {
    try {
      const message = await renderKnowledgeTemplate(knowledge, knowledgeUsed, templateKey, {});
      return {
        message,
        attachments: [],
      };
    } catch {
      // A guard-mandated escalation must survive a template outage: the wire
      // placeholder carries the handoff instead of dropping the escalation.
      if (decision.action === DecisionAction.Escalate) {
        return {
          message: decision.response.message,
          attachments: [],
        };
      }
      throw new Error(`knowledge template "${templateKey}" is unavailable`);
    }
  }

  const message = await renderKnowledgeTemplate(knowledge, knowledgeUsed, templateKey, {});
  return {
    message,
    attachments: [],
  };
};

const prependGreeting = async (
  knowledge: KnowledgeService,
  knowledgeUsed: KnowledgeRef[],
  language: DetectedLanguage | null,
): Promise<string | null> => {
  // The greeting is additive — a missing template degrades to no greeting
  // rather than failing the turn.
  const key = language === 'English' ? 'greeting.initial_en' : 'greeting.initial';
  try {
    return await renderKnowledgeTemplate(knowledge, knowledgeUsed, key, {branch_page: DEFAULT_BRANCH_PAGE,});
  } catch {
    return null;
  }
};

/**
 * Validates the raw decision, renders its template against live knowledge,
 * and persists the run/decision/state/message records. Anything unrenderable
 * degrades to the fallback line — a data outage must never become a 500.
 */
export const applyDecision = async (input: ApplyDecisionInput): Promise<ConversationResult> => {
  const {
    persistence,
    knowledge,
    thread,
    state,
    rawDecision,
    guardHit,
    isFirstAssistantTurn,
    language,
    usage,
    model,
    latencyMs,
    runId,
    replyToExternalId,
  } = input;

  const incomingStage = state?.stage ?? ConversationStage.New;

  // Phase-1 knowledge provenance: `escalation_topics` marks that live topics
  // were consulted this turn; template refs accumulate as each entry renders;
  // `catalog:variant:<id>` marks the quoted variant. The topics endpoint and
  // synthetic keys carry no row version, so live refs pin version 1 (the
  // degraded seed reports its DEGRADED_SEED_VERSION where it applies);
  // Phase 3 replaces these pins with real row versions.
  const knowledgeUsed: KnowledgeRef[] = [...input.baseKnowledgeUsed];

  const persistTurn = async (args: {
    decision: AiDecision;
    validation: { valid: boolean; errors: string[] };
    fallback: boolean;
    stage: ConversationStage;
    data: Record<string, unknown>;
    message: string;
    attachments: AiAttachment[];
  }): Promise<ConversationResult> => {
    // Writes land before the run is marked Completed: a mid-turn throw must
    // leave the run Failed, never Completed with a partial turn. The pipeline
    // also marks Failed on its way out; this best-effort update runs first so
    // a direct applyDecision caller still records the failure.
    try {
      await persistence.decisions.create({
        runId,
        threadId: thread.id,
        schemaVersion: 1,
        intent: args.decision.intent,
        action: args.decision.action,
        confidence: args.decision.confidence,
        decision: JSON.parse(JSON.stringify(args.decision)) as Record<string, unknown>,
        validation: args.validation,
        fallback: args.fallback,
      });
      await persistence.conversationStates.upsert({
        threadId: thread.id,
        stage: args.stage,
        data: args.data,
      });
      const reply = await persistence.messages.create({
        threadId: thread.id,
        role: 'assistant',
        content: args.message,
        ...(usage === null ? {} : { tokenCount: usage.totalTokens }),
        metadata: {
          aiRunId: runId,
          attachments: args.attachments,
        },
      });

      if (args.decision.action === DecisionAction.Escalate && args.decision.escalation !== null) {
        const escalation = args.decision.escalation;
        await persistence.escalations.create({
          threadId: thread.id,
          runId,
          topicKey: escalation.topicKey,
          detectedIntent: args.decision.intent,
          reason: escalation.reason,
          summary: escalation.summary,
          department: escalation.department,
          priority: escalation.priority,
        });
      }

      await persistence.runs.update(runId, {
        status: RunStatus.Completed,
        completedAt: new Date().toISOString(),
        ...(model === undefined ? {} : { model }),
        promptKey: 'response_agent',
        promptVersion: RESPONSE_AGENT_VERSION,
        ...(usage === null ? {} : { usage }),
        latencyMs,
        knowledgeUsed,
      });

      const escalated = args.decision.action === DecisionAction.Escalate;
      return {
        reply: reply.content,
        replyToExternalId,
        transferToAgent: escalated,
        attachments: args.attachments,
        route: escalated ? 'agent' : 'ai',
        aiRouted: !escalated,
        language,
        usage,
      };
    } catch (error) {
      await persistence.runs.update(runId, {
        status: RunStatus.Failed,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
      }).catch(() => undefined);
      throw error;
    }
  };

  const persistFallback = async (
    data: Record<string, unknown>,
    decision: AiDecision,
    errors: string[],
  ): Promise<ConversationResult> => {
    let message: string | null = null;
    try {
      const template = await knowledge.getTemplate(FALLBACK_TEMPLATE_KEY);
      if (template !== null) {
        message = renderTemplate(template.content, {});
        knowledgeUsed.push({
          key: template.key,
          version: template.version,
        });
      }
    } catch {
      message = null;
    }
    return persistTurn({
      decision,
      validation: {
        valid: false,
        errors,
      },
      fallback: true,
      stage: incomingStage,
      data,
      message: message ?? decision.response.message,
      attachments: [],
    });
  };

  let parsed: AiDecision;
  try {
    parsed = parseAiDecisionWire(rawDecision);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'AI decision is invalid';
    return persistFallback({ ...(state?.data ?? {}) }, buildFallbackDecision(reason), [reason]);
  }

  const currentData = { ...(state?.data ?? {}) };
  const preMerged = mergeStateData(currentData, parsed.stateTransition?.set);

  let catalog: CatalogProduct[] | null = null;
  if (
    PRICE_INTENTS.includes(parsed.intent) &&
    parsed.action === DecisionAction.Respond &&
    (parsed.response.templateKey?.startsWith('price.') ?? false)
  ) {
    catalog = await resolveCatalog(knowledge, preMerged);
    if (catalog === null) {
      return persistFallback(preMerged, parsed, ['No matching product found for the price inquiry']);
    }
  }

  const validated = validateDecision(rawDecision, {
    ...(guardHit === null ? {} : { guardHit }),
    paymentPreference: readText(preMerged, 'payment_preference'),
    variantCount: catalog?.[0]?.variants.length ?? 0,
    selectedVariantId: readText(preMerged, 'selected_variant_id'),
    isFirstAssistantTurn,
  });

  if (validated.fallback) {
    return persistFallback(preMerged, validated.decision, validated.validation.errors);
  }

  // The validator may coerce stage/set (guard escalation, clarification), so
  // the persisted slots come from the post-check decision, not the raw parse.
  const merged = mergeStateData(currentData, validated.decision.stateTransition?.set);

  // A coerced AskClarification carries its own templateKey (pricing.ask_*),
  // so it renders through the same dispatch below — only the original
  // price-block render is skipped, never the clarification itself.
  const decision = validated.decision;
  // TODO(P2): apply decision.memoryUpdates to memory and record a metric; Phase 2 owns memory writes.
  const templateKey = decision.response.templateKey;
  const stage = templateKey === undefined
    ? incomingStage
    : (TEMPLATE_STAGES[templateKey] ?? incomingStage);

  let message = decision.response.message;
  let attachments: AiAttachment[] = [];
  if (templateKey !== undefined) {
    try {
      const rendered = await renderByTemplate({
        knowledge,
        knowledgeUsed,
        templateKey,
        decision,
        merged,
        catalog,
      });
      message = rendered.message;
      attachments = rendered.attachments;
    } catch {
      return persistFallback(merged, decision, [`Cannot render template "${templateKey}"`]);
    }
  }

  if (
    validated.greeting &&
    decision.action !== DecisionAction.Escalate &&
    (templateKey === undefined || !GREETING_TEMPLATE_KEYS.includes(templateKey))
  ) {
    await prependGreeting(knowledge, knowledgeUsed, language).then((greeting) => {
      if (greeting !== null) message = `${greeting}\n\n${message}`;
    });
  }

  return persistTurn({
    decision,
    validation: validated.validation,
    fallback: false,
    stage,
    data: merged,
    message,
    attachments,
  });
};
