import type { Db } from 'mongodb';
import {
  beforeEach, describe, expect, it, vi 
} from 'vitest';

import {
  assertDestructiveAllowed,
  dropCollection,
  ensureCollection,
  withMongoConnection,
} from '../../../scripts/mongoHelpers.js';

const mocks = vi.hoisted(() => ({
  connection: {
    connect: vi.fn(),
    getDb: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('@services/mongodb/MongoConnection.js',
  () => ({createMongoConnection: vi.fn(() => mocks.connection),}));

beforeEach(() => {
  vi.clearAllMocks();
});

/** Minimal `Db` stand-in covering the surface `ensureCollection` touches. */
const fakeEnsureDb = (options: { exists?: boolean; createCollection?: () => Promise<unknown> }) => {
  const hasNext = vi.fn().mockResolvedValue(options.exists ?? false);
  return {
    listCollections: vi.fn(() => ({ hasNext })),
    createCollection: vi.fn(options.createCollection ?? (() => Promise.resolve())),
  } as unknown as Db;
};

/** Minimal `Db` stand-in covering the surface `dropCollection` touches. */
const fakeDropDb = (drop: () => Promise<unknown>) =>
  ({ collection: vi.fn(() => ({ drop: vi.fn(drop) })) }) as unknown as Db;

describe('withMongoConnection',
  () => {
    it('opens the connection, runs the body, and closes it',
      async () => {
        const db = { marker: true } as unknown as Db;
        mocks.connection.connect.mockResolvedValue(undefined);
        mocks.connection.getDb.mockReturnValue(db);
        mocks.connection.close.mockResolvedValue(undefined);

        const result = await withMongoConnection((handle) =>
          Promise.resolve(handle === db ? 'ok' : 'bad'));

        expect(result).toBe('ok');
        expect(mocks.connection.connect).toHaveBeenCalledTimes(1);
        expect(mocks.connection.close).toHaveBeenCalledTimes(1);
      });

    it('closes the connection when the body throws',
      async () => {
        mocks.connection.connect.mockResolvedValue(undefined);
        mocks.connection.getDb.mockReturnValue({});
        mocks.connection.close.mockResolvedValue(undefined);

        await expect(
          withMongoConnection(() => Promise.reject(new Error('boom'))),
        ).rejects.toThrow('boom');
        expect(mocks.connection.close).toHaveBeenCalledTimes(1);
      });
  });

describe('ensureCollection',
  () => {
    it('returns false without creating when the collection exists',
      async () => {
        const db = fakeEnsureDb({ exists: true });

        await expect(ensureCollection(db, 'threads')).resolves.toBe(false);
        expect((db as unknown as { createCollection: ReturnType<typeof vi.fn> }).createCollection)
          .not.toHaveBeenCalled();
      });

    it('creates and returns true when the collection is missing',
      async () => {
        const db = fakeEnsureDb({ exists: false });

        await expect(ensureCollection(db, 'threads')).resolves.toBe(true);
        expect((db as unknown as { createCollection: ReturnType<typeof vi.fn> }).createCollection)
          .toHaveBeenCalledWith('threads');
      });

    it('returns false when creation races another process (code 48)',
      async () => {
        const db = fakeEnsureDb({
          exists: false,
          createCollection: () => Promise.reject(Object.assign(new Error('exists'), { code: 48 })),
        });

        await expect(ensureCollection(db, 'threads')).resolves.toBe(false);
      });

    it('rethrows non-race failures',
      async () => {
        const db = fakeEnsureDb({
          exists: false,
          createCollection: () => Promise.reject(new Error('nope')),
        });

        await expect(ensureCollection(db, 'threads')).rejects.toThrow('nope');
      });
  });

describe('dropCollection',
  () => {
    it('returns true when the drop succeeds',
      async () => {
        await expect(dropCollection(fakeDropDb(() => Promise.resolve()), 'runs')).resolves.toBe(true);
      });

    it('returns false when the collection does not exist (code 26)',
      async () => {
        const db = fakeDropDb(() =>
          Promise.reject(Object.assign(new Error('missing'), { code: 26 })));

        await expect(dropCollection(db, 'runs')).resolves.toBe(false);
      });

    it('rethrows non-namespace failures',
      async () => {
        const db = fakeDropDb(() => Promise.reject(new Error('nope')));

        await expect(dropCollection(db, 'runs')).rejects.toThrow('nope');
      });
  });

describe('assertDestructiveAllowed',
  () => {
    it('allows a forced run outside production',
      () => {
        expect(() => assertDestructiveAllowed('db:clear', {
          isProd: false,
          force: true 
        })).not.toThrow();
      });

    it('refuses outside production without --force',
      () => {
        expect(() => assertDestructiveAllowed('db:clear', {
          isProd: false,
          force: false 
        })).toThrow(/destructive/);
      });

    it('refuses in production even with --force',
      () => {
        expect(() => assertDestructiveAllowed('db:fresh', {
          isProd: true,
          force: true 
        })).toThrow(/production/);
      });
  });
