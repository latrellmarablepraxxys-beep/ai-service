import type { WithId } from 'mongodb';

import type {
  CollectionName,
  DecisionDocument,
  IndexSpec,
} from '../../interfaces/mongo.js';
import type { Decision } from '../../interfaces/persistence.js';

export const DECISION_COLLECTION = 'decisions' satisfies CollectionName;

export const DECISION_INDEXES: readonly IndexSpec[] = [
  {
    key: { runId: 1 },
    unique: true,
  },
  {
    key: {
      threadId: 1,
      createdAt: -1,
    },
  },
];

export type { DecisionDocument };

/** Read mapper: validates nothing, lifts `_id` to the boundary `id`. */
export const toDecision = (doc: WithId<DecisionDocument>): Decision => {
  const {
    _id, ...rest
  } = doc;
  return {
    id: _id.toString(),
    ...rest,
  };
};
