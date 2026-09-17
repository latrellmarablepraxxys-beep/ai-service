import type { EscalationTopic } from '../../interfaces/knowledge.js';

const normalize = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Deterministic restricted-topic match. The longest matching keyword wins so
 * a specific topic (e.g. `orcr plate`) beats a generic one (`documents`);
 * ties keep the first topic in array order.
 */
export const matchEscalationTopic = (
  text: string,
  topics: EscalationTopic[],
): EscalationTopic | null => {
  const padded = ` ${normalize(text)} `;
  if (padded.trim().length === 0) return null;

  let best: EscalationTopic | null = null;
  let bestLength = 0;

  for (const topic of topics) {
    for (const keyword of topic.keywords) {
      const needle = normalize(keyword);
      // Whole-phrase match on the space-padded transcript: a bare substring
      // check fires `plate` inside `template` and `less` inside `priceless`.
      if (needle.length === 0 || !padded.includes(` ${needle} `)) continue;
      if (needle.length > bestLength) {
        best = topic;
        bestLength = needle.length;
      }
    }
  }

  return best;
};
