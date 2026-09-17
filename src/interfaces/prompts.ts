import type { ChatMessage } from './llm.js';

export interface ResponseAgentContext {
  customerContext?: string;
  inventoryContext?: string;
  knowledgeContext?: string;
}

export interface ResponseAgentInput {
  userMessage: string;
  context?: ResponseAgentContext;
  history?: ChatMessage[];
}

export interface RouteClassifierInput {
  text: string;
  context?: string;
}

export interface EscalationHandoffInput {
  userMessage: string;
  triggerTopic: string;
  conversationSummary?: string;
  customerContext?: string;
  language?: string;
}

export interface MemorySummaryInput {
  messages: ChatMessage[];
  previousSummary?: string;
}

export interface LanguageDetectorInput {
  text: string;
  context?: string;
}
