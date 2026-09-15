import {
  describe, expect, it, vi 
} from 'vitest';
import type { MongoClient } from 'mongodb';

import { createMongoConnection } from '@services/mongodb/MongoConnection.js';

const createFakeDb = () => ({ command: vi.fn() });

const createFakeClient = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  db: vi.fn(),
});

const makeConnection = (
  client: ReturnType<typeof createFakeClient>,
  fakeDb: ReturnType<typeof createFakeDb>,
  dbName = 'test-db',
) => {
  client.db.mockReturnValue(fakeDb);
  return createMongoConnection({
    client: client as unknown as MongoClient,
    dbName 
  });
};

describe('mongoConnection',
  () => {
    it('connects and exposes the configured database',
      async () => {
        const client = createFakeClient();
        const fakeDb = createFakeDb();
        const connection = makeConnection(client, fakeDb);

        await connection.connect();
        const result = connection.getDb();

        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(client.db).toHaveBeenCalledWith('test-db');
        expect(result).toBe(fakeDb);
      });

    it('defaults the database name from config',
      async () => {
        const client = createFakeClient();
        const fakeDb = createFakeDb();
        client.db.mockReturnValue(fakeDb);
        const connection = createMongoConnection({ client: client as unknown as MongoClient });

        await connection.connect();
        connection.getDb();

        expect(client.db).toHaveBeenCalledWith('motorcentral-omnichannel-ai');
      });

    it('throws PERSISTENCE_CONNECTION_ERROR when getDb is called before connect',
      () => {
        const client = createFakeClient();
        const connection = makeConnection(client, createFakeDb());

        let thrown: unknown;
        try {
          connection.getDb();
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toMatchObject({
          code: 'PERSISTENCE_CONNECTION_ERROR',
          status: 503 
        });
      });

    it('closes the underlying client',
      async () => {
        const client = createFakeClient();
        const connection = makeConnection(client, createFakeDb());

        await connection.connect();
        await connection.close();

        expect(client.close).toHaveBeenCalledTimes(1);
      });

    it('close() is a no-op when never connected',
      async () => {
        const client = createFakeClient();
        const connection = makeConnection(client, createFakeDb());

        await expect(connection.close()).resolves.toBeUndefined();
        expect(client.close).not.toHaveBeenCalled();
      });

    it('reports healthy with latency when ping succeeds',
      async () => {
        const client = createFakeClient();
        const fakeDb = createFakeDb();
        fakeDb.command.mockResolvedValue({ ok: 1 });
        const connection = makeConnection(client, fakeDb);

        await connection.connect();
        const health = await connection.health();

        expect(health.connected).toBe(true);
        expect(health.latencyMs).toEqual(expect.any(Number));
        expect(fakeDb.command).toHaveBeenCalledWith({ ping: 1 });
      });

    it('degrades gracefully when the health ping fails',
      async () => {
        const client = createFakeClient();
        const fakeDb = createFakeDb();
        fakeDb.command.mockRejectedValue(new Error('connection refused'));
        const connection = makeConnection(client, fakeDb);

        await connection.connect();
        const health = await connection.health();

        expect(health).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });

    it('degrades gracefully when health is checked before connect',
      async () => {
        const connection = makeConnection(createFakeClient(), createFakeDb());

        const health = await connection.health();

        expect(health).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });
  });
