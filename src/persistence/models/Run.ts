import type { WithId } from 'mongodb';
import { z } from 'zod';

import { RunStatus } from '../../enums/RunStatus.js';
import type { CollectionName, IndexSpec } from '../../interfaces/mongo.js';
import type { Run } from '../../interfaces/persistence.js';

export const RUN_COLLECTION = 'runs' satisfies CollectionName;

export const RUN_INDEXES: readonly IndexSpec[] = [
  {
    key: {
      threadId: 1,
      startedAt: -1 
    } 
  },
  {
    key: {
      type: 1,
      status: 1 
    } 
  }
];

export const runDocumentSchema = z
  .object({
    threadId: z.string().min(1),
    type: z.enum([
      'routing',
      'escalation',
      'response'
    ]),
    status: z.nativeEnum(RunStatus),
    input: z.record(z.unknown()),
    output: z.record(z.unknown()).optional(),
    error: z.string().optional(),
    startedAt: z.string().min(1),
    completedAt: z.string().optional(),
  })
  .strip();

export type RunDocument = z.infer<typeof runDocumentSchema>;

/** Read mapper: validates the stored body and lifts `_id` to the boundary `id`. */
export const toRun = (doc: WithId<RunDocument>): Run => {
  const {
    _id, ...rest 
  } = doc;
  const parsed = runDocumentSchema.parse(rest);
  return {
    id: _id.toString(),
    ...parsed,
    output: parsed.output ?? undefined,
    error: parsed.error ?? undefined,
    completedAt: parsed.completedAt ?? undefined,
  };
};

/** Write validator: fails fast when a repository would persist a malformed document. */
export const toRunDocument = (doc: RunDocument): RunDocument =>
  runDocumentSchema.parse(doc);
