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
    model: z.string().optional(),
    promptKey: z.string().optional(),
    promptVersion: z.number().int().optional(),
    usage: z
      .object({
        promptTokens: z.number().int(),
        completionTokens: z.number().int(),
        totalTokens: z.number().int(),
      })
      .strip()
      .optional(),
    latencyMs: z.number().int().optional(),
    knowledgeUsed: z
      .array(z
        .object({
          key: z.string(),
          version: z.number().int(),
        })
        .strip())
      .optional(),
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
    model: parsed.model ?? undefined,
    promptKey: parsed.promptKey ?? undefined,
    promptVersion: parsed.promptVersion ?? undefined,
    usage: parsed.usage ?? undefined,
    latencyMs: parsed.latencyMs ?? undefined,
    knowledgeUsed: parsed.knowledgeUsed ?? undefined,
  };
};

/** Write validator: fails fast when a repository would persist a malformed document. */
export const toRunDocument = (doc: RunDocument): RunDocument =>
  runDocumentSchema.parse(doc);
