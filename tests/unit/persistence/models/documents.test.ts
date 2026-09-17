import { ObjectId } from 'mongodb';
import {
  describe, expect, it 
} from 'vitest';

import { RunStatus } from '@enums/RunStatus.js';
import { ThreadStatus } from '@enums/ThreadStatus.js';
import type { MemoryDocument } from '@persistence/models/Memory.js';
import {
  MEMORY_COLLECTION,
  MEMORY_INDEXES,
  memoryDocumentSchema,
  toMemory,
} from '@persistence/models/Memory.js';
import type { MessageDocument } from '@persistence/models/Message.js';
import {
  MESSAGE_COLLECTION,
  MESSAGE_INDEXES,
  messageDocumentSchema,
  toMessage,
  toMessageDocument,
} from '@persistence/models/Message.js';
import type { RunDocument } from '@persistence/models/Run.js';
import {
  RUN_COLLECTION,
  RUN_INDEXES,
  runDocumentSchema,
  toRun,
  toRunDocument,
} from '@persistence/models/Run.js';
import type { ThreadDocument } from '@persistence/models/Thread.js';
import {
  THREAD_COLLECTION,
  THREAD_INDEXES,
  threadDocumentSchema,
  toThread,
  toThreadDocument,
} from '@persistence/models/Thread.js';

const threadDoc = {
  ticketId: 't-1',
  status: ThreadStatus.Active,
  route: 'ai',
  metadata: {},
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
} satisfies ThreadDocument;

const messageDoc = {
  threadId: 't-1',
  role: 'user',
  content: 'hello',
  metadata: {},
  createdAt: '2024-01-01T00:00:00.000Z',
} satisfies MessageDocument;

const memoryDoc = {
  threadId: 't-1',
  summary: 'short summary',
  tokenCount: 12,
  version: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
} satisfies MemoryDocument;

const runDoc = {
  threadId: 't-1',
  type: 'routing',
  status: RunStatus.Running,
  input: { ticketId: 't-1' },
  startedAt: '2024-01-01T00:00:00.000Z',
} satisfies RunDocument;

describe('threadDocumentSchema',
  () => {
    it('accepts a valid document and strips an unknown key',
      () => {
        const parsed = threadDocumentSchema.parse({
          ...threadDoc,
          extra: 1,
        });

        expect(parsed).toEqual(threadDoc);
        expect(parsed).not.toHaveProperty('extra');
      });

    it('rejects a string status instead of the int enum',
      () => {
        expect(() => threadDocumentSchema.parse({
          ...threadDoc,
          status: 'active',
        })).toThrow();
      });
  });

describe('toThread / toThreadDocument',
  () => {
    it('lifts _id to the string id and returns the entity',
      () => {
        const id = new ObjectId();

        const thread = toThread({
          _id: id,
          ...threadDoc,
        });

        expect(thread.id).toBe(id.toString());
        expect(thread).toMatchObject({
          ticketId: 't-1',
          status: ThreadStatus.Active,
          route: 'ai',
          metadata: {},
        });
      });

    it('passes a valid document through the write validator',
      () => {
        expect(toThreadDocument(threadDoc)).toEqual(threadDoc);
      });

    it('throws when the write validator gets an invalid document',
      () => {
        expect(() => toThreadDocument({
          ...threadDoc,
          status: 'active',
        } as unknown as ThreadDocument)).toThrow();
      });
  });

describe('messageDocumentSchema',
  () => {
    it('accepts a valid document and strips an unknown key',
      () => {
        const parsed = messageDocumentSchema.parse({
          ...messageDoc,
          extra: 1,
        });

        expect(parsed).toEqual(messageDoc);
        expect(parsed).not.toHaveProperty('extra');
      });

    it('rejects an invalid role',
      () => {
        expect(() => messageDocumentSchema.parse({
          ...messageDoc,
          role: 'operator',
        })).toThrow();
      });
  });

describe('toMessage / toMessageDocument',
  () => {
    it('lifts _id to the string id and normalizes an omitted tokenCount',
      () => {
        const id = new ObjectId();

        const message = toMessage({
          _id: id,
          ...messageDoc,
        });

        expect(message.id).toBe(id.toString());
        expect(message.tokenCount).toBeUndefined();
        expect(message).toMatchObject({
          threadId: 't-1',
          role: 'user',
          content: 'hello',
          metadata: {},
        });
      });

    it('passes a valid document through the write validator',
      () => {
        expect(toMessageDocument(messageDoc)).toEqual(messageDoc);
      });

    it('throws when the write validator gets an invalid document',
      () => {
        expect(() => toMessageDocument({
          ...messageDoc,
          role: 'operator',
        } as unknown as MessageDocument)).toThrow();
      });
  });

describe('memoryDocumentSchema',
  () => {
    it('accepts a valid document and strips an unknown key',
      () => {
        const parsed = memoryDocumentSchema.parse({
          ...memoryDoc,
          extra: 1,
        });

        expect(parsed).toEqual(memoryDoc);
        expect(parsed).not.toHaveProperty('extra');
      });

    it('rejects a non-numeric version',
      () => {
        expect(() => memoryDocumentSchema.parse({
          ...memoryDoc,
          version: 'one',
        })).toThrow();
      });
  });

describe('toMemory',
  () => {
    it('lifts _id to the string id and returns the entity',
      () => {
        const id = new ObjectId();

        const memory = toMemory({
          _id: id,
          ...memoryDoc,
        });

        expect(memory.id).toBe(id.toString());
        expect(memory).toMatchObject({
          threadId: 't-1',
          summary: 'short summary',
          tokenCount: 12,
          version: 1,
        });
      });
  });

describe('runDocumentSchema',
  () => {
    it('accepts a valid document and strips an unknown key',
      () => {
        const parsed = runDocumentSchema.parse({
          ...runDoc,
          extra: 1,
        });

        expect(parsed).toEqual(runDoc);
        expect(parsed).not.toHaveProperty('extra');
      });

    it('rejects a string status instead of the int enum',
      () => {
        expect(() => runDocumentSchema.parse({
          ...runDoc,
          status: 'completed',
        })).toThrow();
      });
  });

describe('toRun / toRunDocument',
  () => {
    it('lifts _id to the string id and normalizes omitted optional fields',
      () => {
        const id = new ObjectId();

        const run = toRun({
          _id: id,
          ...runDoc,
        });

        expect(run.id).toBe(id.toString());
        expect(run.output).toBeUndefined();
        expect(run.error).toBeUndefined();
        expect(run.completedAt).toBeUndefined();
        expect(run).toMatchObject({
          threadId: 't-1',
          type: 'routing',
          status: RunStatus.Running,
          input: { ticketId: 't-1' },
        });
      });

    it('passes a valid document through the write validator',
      () => {
        expect(toRunDocument(runDoc)).toEqual(runDoc);
      });

    it('throws when the write validator gets an invalid document',
      () => {
        expect(() => toRunDocument({
          ...runDoc,
          status: 'completed',
        } as unknown as RunDocument)).toThrow();
      });
  });

describe('collection names and indexes',
  () => {
    it('declares the lowercase-plural collection names',
      () => {
        expect(THREAD_COLLECTION).toBe('threads');
        expect(MESSAGE_COLLECTION).toBe('messages');
        expect(MEMORY_COLLECTION).toBe('memories');
        expect(RUN_COLLECTION).toBe('runs');
      });

    it('declares non-empty index specs for every collection',
      () => {
        expect(THREAD_INDEXES.length).toBeGreaterThan(0);
        expect(MESSAGE_INDEXES.length).toBeGreaterThan(0);
        expect(MEMORY_INDEXES.length).toBeGreaterThan(0);
        expect(RUN_INDEXES.length).toBeGreaterThan(0);
      });
  });
