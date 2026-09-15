import {
  describe, expect, it, vi 
} from 'vitest';
import type { Redis } from 'ioredis';

import { redisConfig } from '@config/redis.js';
import { createRedisConnection } from '@services/redis/RedisConnection.js';

vi.mock('ioredis',
  () => {
    const MockRedis = vi.fn((url?: string, options?: unknown) => ({
      url,
      options 
    }));
    return {
      Redis: MockRedis,
      default: MockRedis 
    };
  });

// The mocked default constructor — used to assert connection options.
import RedisMock from 'ioredis';

const createFakeClient = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
});

const makeConnection = (client: ReturnType<typeof createFakeClient>) =>
  createRedisConnection({ client: client as unknown as Redis });

const resetConstructorMock = () => {
  (RedisMock as unknown as { mockClear: () => void }).mockClear();
};

describe('redisConnection',
  () => {
    it('connects and exposes the underlying client',
      async () => {
        const client = createFakeClient();
        const connection = makeConnection(client);

        await connection.connect();

        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(connection.getClient()).toBe(client);
      });

    it('throws CACHE_CONNECTION_ERROR when getClient is called before connect',
      () => {
        const connection = makeConnection(createFakeClient());

        let thrown: unknown;
        try {
          connection.getClient();
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toMatchObject({
          code: 'CACHE_CONNECTION_ERROR',
          status: 503 
        });
      });

    it('closes the underlying client',
      async () => {
        const client = createFakeClient();
        const connection = makeConnection(client);

        await connection.connect();
        await connection.close();

        expect(client.quit).toHaveBeenCalledTimes(1);
      });

    it('close() is a no-op when never connected',
      async () => {
        const client = createFakeClient();
        const connection = makeConnection(client);

        await expect(connection.close()).resolves.toBeUndefined();
        expect(client.quit).not.toHaveBeenCalled();
      });

    it('defaults to the BullMQ-safe queue profile',
      () => {
        resetConstructorMock();

        createRedisConnection({ url: 'redis://example:6379' });

        expect(RedisMock).toHaveBeenCalledWith('redis://example:6379',
          {
            maxRetriesPerRequest: null,
            lazyConnect: true,
          });
      });

    it('uses the queue profile when requested explicitly',
      () => {
        resetConstructorMock();

        createRedisConnection({
          url: 'redis://example:6379',
          profile: 'queue' 
        });

        expect(RedisMock).toHaveBeenCalledWith('redis://example:6379',
          {
            maxRetriesPerRequest: null,
            lazyConnect: true,
          });
      });

    it('bounds retries and enables a command timeout for the cache profile',
      () => {
        resetConstructorMock();

        createRedisConnection({
          url: 'redis://example:6379',
          profile: 'cache' 
        });

        expect(RedisMock).toHaveBeenCalledWith('redis://example:6379',
          {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            commandTimeout: redisConfig.commandTimeoutMs,
            lazyConnect: true,
          });
      });

    it('bypasses the profile when a client is injected',
      () => {
        resetConstructorMock();

        createRedisConnection({ client: createFakeClient() as unknown as Redis });

        expect(RedisMock).not.toHaveBeenCalled();
      });

    it('reports healthy with latency when ping succeeds',
      async () => {
        const connection = makeConnection(createFakeClient());

        await connection.connect();
        const health = await connection.health();

        expect(health.connected).toBe(true);
        expect(health.latencyMs).toEqual(expect.any(Number));
      });

    it('degrades gracefully when ping fails',
      async () => {
        const client = createFakeClient();
        client.ping.mockRejectedValue(new Error('connection refused'));
        const connection = makeConnection(client);

        const health = await connection.health();

        expect(health).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });
  });
