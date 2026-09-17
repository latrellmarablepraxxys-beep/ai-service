import type { WithId } from 'mongodb';

import type {
  CollectionName,
  EscalationRecordDocument,
  IndexSpec,
} from '../../interfaces/mongo.js';
import type { EscalationRecord } from '../../interfaces/persistence.js';

export const ESCALATION_COLLECTION = 'escalations' satisfies CollectionName;

export const ESCALATION_INDEXES: readonly IndexSpec[] = [
  {
    key: {
      threadId: 1,
      createdAt: -1,
    },
  },
  { key: { status: 1 } },
];

export type { EscalationRecordDocument };

/** Read mapper: lifts `_id` to `id`, normalizes stored nulls back to `undefined`. */
export const toEscalationRecord = (doc: WithId<EscalationRecordDocument>): EscalationRecord => {
  const {
    _id, ...rest
  } = doc;
  return {
    id: _id.toString(),
    ...rest,
    runId: rest.runId ?? undefined,
    detectedIntent: rest.detectedIntent ?? undefined,
  };
};
