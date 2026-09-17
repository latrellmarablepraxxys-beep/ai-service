import type { ChatMessage } from '../../interfaces/llm.js';
import type { BuildTurnPromptInput } from '../../interfaces/turn.js';
import { buildResponseAgentMessages } from '../../prompts/ResponseAgent.js';

/**
 * Assembles the ResponseAgent messages. Topics travel as compact
 * `key: label (keywords: …)` lines so the model can name the matching
 * restricted-topic key without a hardcoded topic list in the prompt.
 * User-controlled text (customer name, state data, topic lines) is wrapped in
 * delimiters matching the `<…_context>` block style so it stays structurally
 * separated from the instructions.
 */
export const buildTurnPrompt = (input: BuildTurnPromptInput): ChatMessage[] => {
  const topicLines = input.topics.map(
    (topic) => `${topic.key}: ${topic.label} (keywords: ${topic.keywords.join(', ')})`,
  );
  const topicBlock = `<topic_list>\n${topicLines.join('\n')}\n</topic_list>`;
  const knowledgeLines = input.stateSummary === undefined
    ? [topicBlock]
    : [
      topicBlock,
      `<state_summary>\n${input.stateSummary}\n</state_summary>`
    ];

  return buildResponseAgentMessages({
    userMessage: input.userMessage,
    history: input.history,
    context: {
      ...(input.customerName === undefined
        ? {}
        : { customerContext: `<customer_record>\nName: ${input.customerName}\n</customer_record>` }),
      knowledgeContext: knowledgeLines.join('\n\n'),
    },
  });
};
