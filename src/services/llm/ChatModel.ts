import { ChatOpenAI } from '@langchain/openai';

import type { CreateChatModelOptions } from '../../interfaces/llm.js';

/**
 * Builds the LangChain chat model bound to the active provider connection.
 *
 * Verified against the installed types (@langchain/openai 0.3.17): `ChatOpenAIFields`
 * still exposes `maxTokens` (via `OpenAIChatInput` -> `OpenAIBaseInput`) — the
 * `maxOutputTokens` rename landed in later versions — so that is the option we
 * set when the caller overrides it.
 */
export const createChatModel = (options: CreateChatModelOptions): ChatOpenAI =>
  new ChatOpenAI({
    model: options.model ?? options.config.models.chat,
    apiKey: options.config.apiKey,
    configuration: { baseURL: options.config.baseUrl },
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
    ...(options.responseFormat !== undefined && {modelKwargs: { response_format: { type: options.responseFormat } },}),
  });
