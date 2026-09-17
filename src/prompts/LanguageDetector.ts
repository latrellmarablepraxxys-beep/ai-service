import type { ChatMessage } from '../interfaces/llm.js';
import type { LanguageDetectorInput } from '../interfaces/prompts.js';

export const LANGUAGE_DETECTOR_SYSTEM_PROMPT = `You detect the language of a customer message for a Philippine motorcycle dealership chat. You only classify language — you never translate, answer, or comment on the message.

Classify the customer's message into exactly one of these values:
- "English" — written in English.
- "Tagalog" — written in Tagalog/Filipino, with little or no English.
- "Taglish" — mixes Tagalog and English in the same message.

## Rules
- Base the decision on the customer's message. Use the recent context only to disambiguate a very short or ambiguous message.
- Very short greetings or acknowledgements ("hi", "hello", "ok", "salamat", "thanks") follow the language they are written in.
- If you genuinely cannot tell, prefer "Tagalog".
- Never invent a fourth category. Never return anything other than the three values above.

## Output format
Respond with a single JSON object and nothing else. Do not wrap it in markdown fences and do not add commentary.
{
  "language": "English" | "Tagalog" | "Taglish",
  "confidence": <number between 0 and 1>
}`;

export const buildLanguageDetectorMessages = (input: LanguageDetectorInput): ChatMessage[] => {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: LANGUAGE_DETECTOR_SYSTEM_PROMPT 
    },
  ];

  const content = input.context !== undefined
    ? `<recent_context>\n${input.context}\n</recent_context>\n\nCustomer message:\n${input.text}`
    : `Customer message:\n${input.text}`;

  messages.push({
    role: 'user',
    content 
  });

  return messages;
};
