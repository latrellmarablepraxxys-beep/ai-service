import {
  afterEach, describe, expect, it, vi 
} from 'vitest';

import { createDomainHttpClient } from '@services/domain/DomainHttpClient.js';

const fetchMock = vi.fn();

const stubFetch = (implementation: () => Promise<Response> | Promise<never>): void => {
  fetchMock.mockImplementation(implementation);
  vi.stubGlobal('fetch', fetchMock);
};

const jsonResponse = (data: unknown, status: number): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const clientWithKey = () =>
  createDomainHttpClient({
    baseUrl: 'http://localhost:8000/api',
    apiKey: 'secret',
    timeoutMs: 1000,
  });

const lastCall = (): [string, RequestInit] => {
  const [call] = fetchMock.mock.calls.slice(-1);
  if (call === undefined) throw new Error('fetch was not called');
  return call as [string, RequestInit];
};

describe('domainHttpClient',
  () => {
    afterEach(() => {
      fetchMock.mockReset();
      vi.unstubAllGlobals();
    });

    it('serializes query params, comma-joining arrays and dropping undefined',
      async () => {
        stubFetch(() => Promise.resolve(jsonResponse({
          success: true,
          data: [] 
        }, 200)));
        const client = clientWithKey();

        await client.get('/knowledge-entries', {
          keys: [
            'b',
            'a'
          ],
          current: 1,
          missing: undefined,
        });

        const [url] = lastCall();
        const parsed = new URL(url);
        expect(`${parsed.origin}${parsed.pathname}`).toBe('http://localhost:8000/api/knowledge-entries');
        expect(parsed.searchParams.get('keys')).toBe('b,a');
        expect(parsed.searchParams.get('current')).toBe('1');
        expect(parsed.searchParams.has('missing')).toBe(false);
      });

    it('sends the X-Api-Key header and an abort signal',
      async () => {
        stubFetch(() => Promise.resolve(jsonResponse({
          success: true,
          data: [] 
        }, 200)));
        const client = clientWithKey();

        await client.get('/escalation-topics', { active: 1 });

        const [
          , init
        ] = lastCall();
        expect(init.headers).toMatchObject({ 'X-Api-Key': 'secret' });
        expect(init.signal).toBeInstanceOf(AbortSignal);
      });

    it('omits the X-Api-Key header when no key is configured',
      async () => {
        stubFetch(() => Promise.resolve(jsonResponse({
          success: true,
          data: [] 
        }, 200)));
        const client = createDomainHttpClient({
          baseUrl: 'http://localhost:8000/api',
          apiKey: '',
          timeoutMs: 1000,
        });

        await client.get('/escalation-topics');

        const [
          , init
        ] = lastCall();
        expect(init.headers).toEqual({ Accept: 'application/json' });
      });

    it('returns the parsed JSON body on success',
      async () => {
        const body = {
          success: true,
          data: [{ key: 'a' }] 
        };
        stubFetch(() => Promise.resolve(jsonResponse(body, 200)));

        await expect(clientWithKey().get('/knowledge-entries')).resolves.toEqual(body);
      });

    it('maps 401 and 403 to DOMAIN_AUTH_ERROR',
      async () => {
        stubFetch(() => Promise.resolve(new Response('unauthorized', { status: 401 })));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_AUTH_ERROR',
          status: 401,
        });

        stubFetch(() => Promise.resolve(new Response('forbidden', { status: 403 })));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_AUTH_ERROR',
          status: 403,
        });
      });

    it('maps 404 to DOMAIN_NOT_FOUND',
      async () => {
        stubFetch(() => Promise.resolve(new Response('not found', { status: 404 })));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_NOT_FOUND',
          status: 404,
        });
      });

    it('maps 429 to DOMAIN_RATE_LIMITED',
      async () => {
        stubFetch(() => Promise.resolve(new Response('too many requests', { status: 429 })));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_RATE_LIMITED',
          status: 429,
        });
      });

    it('maps other non-2xx statuses to DOMAIN_API_ERROR with the status in the message',
      async () => {
        stubFetch(() => Promise.resolve(new Response('boom', { status: 500 })));

        const error = await clientWithKey().get('/knowledge-entries').catch((cause: unknown) => cause);

        expect(error).toMatchObject({
          code: 'DOMAIN_API_ERROR',
          status: 500,
        });
        expect((error as Error).message).toContain('500');
        expect((error as Error).message).not.toContain('secret');
      });

    it('maps an aborted signal to DOMAIN_TIMEOUT',
      async () => {
        stubFetch(() => Promise.reject(new DOMException('The operation timed out', 'TimeoutError')));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_TIMEOUT',
          status: 504,
        });
      });

    it('maps network failures to DOMAIN_CONNECTION_ERROR',
      async () => {
        stubFetch(() => Promise.reject(new TypeError('fetch failed')));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_CONNECTION_ERROR',
          status: 503,
        });
      });

    it('maps an undecodable 2xx body to DOMAIN_API_ERROR',
      async () => {
        stubFetch(() => Promise.resolve(new Response('not-json{', { status: 200 })));

        await expect(clientWithKey().get('/knowledge-entries')).rejects.toMatchObject({
          code: 'DOMAIN_API_ERROR',
          status: 502,
        });
      });
  });
