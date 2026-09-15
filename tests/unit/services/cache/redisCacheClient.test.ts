import {
  describe, expect, it, vi 
} from 'vitest';
import type { Redis } from 'ioredis';

import { appConfig } from '@config/app.js';
import { createRedisCacheClient } from '@services/cache/RedisCacheClient.js';

const createFakeClient = () => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
});

const makeCache = (client: ReturnType<typeof createFakeClient>, namespace?: string) =>
  createRedisCacheClient({
    client: client as unknown as Redis,
    ...(namespace !== undefined && { namespace }),
  });

describe('redisCacheClient',
  () => {
    it('round-trips values through JSON with the default namespace',
      async () => {
        const client = createFakeClient();
        client.get.mockResolvedValue('{"a":1}');
        const cache = makeCache(client);

        await cache.set('foo', { a: 1 });
        const value = await cache.get<{ a: number }>('foo');

        expect(client.set).toHaveBeenCalledWith(`${appConfig.name}:cache:foo`, '{"a":1}');
        expect(client.get).toHaveBeenCalledWith(`${appConfig.name}:cache:foo`);
        expect(value).toEqual({ a: 1 });
      });

    it('applies a custom namespace to keys',
      async () => {
        const client = createFakeClient();
        client.get.mockResolvedValue('null');
        const cache = makeCache(client, 'tenant:cache:');

        await cache.get('foo');

        expect(client.get).toHaveBeenCalledWith('tenant:cache:foo');
      });

    it('returns null on a cache miss',
      async () => {
        const client = createFakeClient();
        client.get.mockResolvedValue(null);
        const cache = makeCache(client);

        await expect(cache.get('missing')).resolves.toBeNull();
      });

    it('passes an EX ttl through withTtl',
      async () => {
        const client = createFakeClient();
        const cache = makeCache(client);

        await cache.withTtl('sess', { user: 7 }, 60);

        expect(client.set).toHaveBeenCalledWith(`${appConfig.name}:cache:sess`,
          '{"user":7}',
          'EX',
          60);
      });

    it('maps withTtl failures to CACHE_ERROR',
      async () => {
        const client = createFakeClient();
        client.set.mockRejectedValue(new Error('wrong type'));
        const cache = makeCache(client);

        await expect(cache.withTtl('sess', { user: 7 }, 60)).rejects.toMatchObject({
          code: 'CACHE_ERROR',
          status: 500,
        });
      });

    it('deletes a key under the namespace',
      async () => {
        const client = createFakeClient();
        const cache = makeCache(client);

        await cache.del('foo');

        expect(client.del).toHaveBeenCalledWith(`${appConfig.name}:cache:foo`);
      });

    it('reports has based on redis exists',
      async () => {
        const client = createFakeClient();
        client.exists.mockResolvedValue(1);
        const cache = makeCache(client);

        await expect(cache.has('foo')).resolves.toBe(true);
        expect(client.exists).toHaveBeenCalledWith(`${appConfig.name}:cache:foo`);

        client.exists.mockResolvedValue(0);
        await expect(cache.has('foo')).resolves.toBe(false);
      });

    it('maps has failures to CACHE_ERROR',
      async () => {
        const client = createFakeClient();
        client.exists.mockRejectedValue(new Error('wrong type'));
        const cache = makeCache(client);

        await expect(cache.has('foo')).rejects.toMatchObject({
          code: 'CACHE_ERROR',
          status: 500 
        });
      });

    it('maps command timeouts to CACHE_TIMEOUT',
      async () => {
        const client = createFakeClient();
        client.get.mockRejectedValue(new Error('Command timed out after 2000ms'));
        const cache = makeCache(client);

        await expect(cache.get('foo')).rejects.toMatchObject({
          code: 'CACHE_TIMEOUT',
          status: 504 
        });
      });

    it('maps commandTimeout errors to CACHE_TIMEOUT',
      async () => {
        const client = createFakeClient();
        client.get.mockRejectedValue(new Error('commandTimeout: 2000ms exceeded'));
        const cache = makeCache(client);

        await expect(cache.get('foo')).rejects.toMatchObject({
          code: 'CACHE_TIMEOUT',
          status: 504 
        });
      });

    it('maps a timeout-coded connection error to CACHE_TIMEOUT, not CACHE_CONNECTION_ERROR',
      async () => {
        const client = createFakeClient();
        client.set.mockRejectedValue(
          Object.assign(new Error('Command timed out after 2000ms'), { code: 'ETIMEDOUT' }),
        );
        const cache = makeCache(client);

        await expect(cache.set('foo', 1)).rejects.toMatchObject({
          code: 'CACHE_TIMEOUT',
          status: 504 
        });
      });

    it('maps client errors to CACHE_ERROR AppErrors',
      async () => {
        const client = createFakeClient();
        client.get.mockRejectedValue(new Error('wrong type'));
        const cache = makeCache(client);

        await expect(cache.get('foo')).rejects.toMatchObject({
          code: 'CACHE_ERROR',
          status: 500 
        });
      });

    it('maps connection-level errors to CACHE_CONNECTION_ERROR',
      async () => {
        const client = createFakeClient();
        client.set.mockRejectedValue(
          Object.assign(new Error('socket closed'), { code: 'ECONNREFUSED' }),
        );
        const cache = makeCache(client);

        await expect(cache.set('foo', 1)).rejects.toMatchObject({
          code: 'CACHE_CONNECTION_ERROR',
          status: 503,
        });
      });

    it('wraps non-Error throws as CACHE_ERROR',
      async () => {
        const client = createFakeClient();
        client.del.mockRejectedValue('boom');
        const cache = makeCache(client);

        await expect(cache.del('foo')).rejects.toMatchObject({
          code: 'CACHE_ERROR',
          status: 500 
        });
      });

    it('maps undecodable cached values to CACHE_ERROR',
      async () => {
        const client = createFakeClient();
        client.get.mockResolvedValue('not-json{');
        const cache = makeCache(client);

        await expect(cache.get('foo')).rejects.toMatchObject({
          code: 'CACHE_ERROR',
          status: 500 
        });
      });

    it('reports healthy with latency when ping succeeds',
      async () => {
        const cache = makeCache(createFakeClient());

        const health = await cache.health();

        expect(health.connected).toBe(true);
        expect(health.latencyMs).toEqual(expect.any(Number));
      });

    it('degrades gracefully when ping fails',
      async () => {
        const client = createFakeClient();
        client.ping.mockRejectedValue(new Error('refused'));
        const cache = makeCache(client);

        const health = await cache.health();

        expect(health).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });
  });
