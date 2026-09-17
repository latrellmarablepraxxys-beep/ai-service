import { ConversationStage } from '../../enums/ConversationStage.js';
import { DecisionAction } from '../../enums/DecisionAction.js';
import { RunStatus } from '../../enums/RunStatus.js';
import type {
  ConversationResult,
  HandleConversationInput,
} from '../../interfaces/conversation.js';
import type { KnowledgeRef } from '../../interfaces/decision.js';
import type { EscalationTopic } from '../../interfaces/knowledge.js';
import type {
  ChatMessage,
  DetectedLanguage,
} from '../../interfaces/llm.js';
import type { ConversationState } from '../../interfaces/persistence.js';
import type {
  TurnPipeline,
  TurnPipelineOptions,
} from '../../interfaces/turn.js';
import { applyDecision } from './ValidateAndApply.js';
import { buildTurnPrompt } from './BuildPrompt.js';
import { matchEscalationTopic } from './EscalationGuard.js';
import { loadTurnContext } from './LoadContext.js';

/** Recent turns shared with the language detector to disambiguate short messages. */
const DETECTION_CONTEXT_TURNS = 6;

const buildDetectionContext = (history: ChatMessage[]): string | undefined => {
  if (history.length === 0) return undefined;
  return history
    .slice(-DETECTION_CONTEXT_TURNS)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
};

const buildStateSummary = (state: ConversationState): string => {
  const stage = ConversationStage[state.stage] ?? state.stage;
  return `Current stage: ${stage}; known slots: ${JSON.stringify(state.data)}`;
};

/**
 * Builds the guard-hit decision in LLM wire format so it flows through the
 * same schema + post-checks as a model decision. The template key mirrors the
 * validator's own guard coercion, and the placeholder message satisfies the
 * wire's non-empty contract — the rendered handoff template replaces it.
 */
const buildGuardRawDecision = (
  topic: EscalationTopic,
  language: DetectedLanguage,
): Record<string, unknown> => ({
  schema_version: 1,
  intent: 'RESTRICTED_TOPIC',
  action: DecisionAction.Escalate,
  confidence: 1,
  language,
  response: {
    message: 'Salamat po — ikokonekta ko po kayo sa aming team member na makakatulong po sa inyo.',
    template_key: topic.fallbackTemplateKey,
    attachments: [],
  },
  escalation: {
    topic_key: topic.key,
    reason: 'Restricted topic matched deterministically',
    department: topic.department,
    priority: topic.priority,
    summary: `Customer message matched restricted topic ${topic.key}.`,
  },
  state_transition: {
    stage: ConversationStage.Escalated,
    set: { escalation_topic: topic.key },
  },
  knowledge_used: [
    {
      key: `escalation_topic:${topic.key}`,
      version: 1,
    },
  ],
});

/**
 * One conversation turn: load context, consult escalation topics, short-
 * circuit restricted topics without the LLM, otherwise ask the model for a
 * structured decision and apply it against live knowledge.
 */
export const createTurnPipeline = (options: TurnPipelineOptions): TurnPipeline => {
  const {
    persistence, llm, knowledge 
  } = options;

  return {
    async execute(input: HandleConversationInput): Promise<ConversationResult> {
      const loaded = await loadTurnContext({
        persistence,
        ticketId: input.ticketId,
        request: input.request,
      });
      const { thread } = loaded;
      const latest = input.request.latestMessage;

      const run = await persistence.runs.create({
        threadId: thread.id,
        type: 'response',
        input: {
          ticketId: input.ticketId,
          messageCount: (input.request.contextHistory ?? []).length + 1,
        },
      });

      try {
        const startedAt = Date.now();

        // Detection runs alongside the reply; a detection failure degrades to
        // `null` and never blocks the reply.
        const detectionContext = buildDetectionContext(loaded.history);
        const languagePromise = llm
          .detectLanguage({
            text: latest.body,
            ...(detectionContext === undefined ? {} : { context: detectionContext }),
          })
          .then((detected) => detected.language)
          .catch(() => null);

        // Phase-1 knowledge provenance: one ref marks that live topics were
        // consulted; template + catalog refs accumulate as each source renders.
        const baseKnowledgeUsed: KnowledgeRef[] = [
          {
            key: 'escalation_topics',
            version: 1 
          }
        ];
        const topics = await knowledge.getEscalationTopics();
        const guardHit = matchEscalationTopic(latest.body, topics);

        if (guardHit !== null) {
          const detected = await languagePromise;
          return await applyDecision({
            persistence,
            knowledge,
            thread,
            state: loaded.state,
            rawDecision: buildGuardRawDecision(guardHit, detected ?? 'Tagalog'),
            guardHit,
            isFirstAssistantTurn: loaded.isFirstAssistantTurn,
            language: detected,
            usage: null,
            model: undefined,
            latencyMs: Date.now() - startedAt,
            runId: run.id,
            replyToExternalId: latest.externalId ?? null,
            baseKnowledgeUsed,
          });
        }

        const messages = buildTurnPrompt({
          userMessage: latest.body,
          history: loaded.history,
          ...(input.request.customer?.displayName === undefined
            ? {}
            : { customerName: input.request.customer.displayName }),
          ...(loaded.state === null ? {} : { stateSummary: buildStateSummary(loaded.state) }),
          topics,
        });

        const completion = await llm.chat({
          messages,
          responseFormat: 'json_object',
        });
        const language = await languagePromise;

        return await applyDecision({
          persistence,
          knowledge,
          thread,
          state: loaded.state,
          rawDecision: completion.content,
          guardHit: null,
          isFirstAssistantTurn: loaded.isFirstAssistantTurn,
          language,
          usage: completion.usage ?? null,
          model: completion.model,
          latencyMs: Date.now() - startedAt,
          runId: run.id,
          replyToExternalId: latest.externalId ?? null,
          baseKnowledgeUsed,
        });
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
