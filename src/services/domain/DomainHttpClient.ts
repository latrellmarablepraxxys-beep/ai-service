import type {
  DomainErrorCode,
  DomainHttpClient,
  DomainHttpClientOptions,
  DomainHttpQueryValue,
} from '../../interfaces/domain.js';
import { AppError } from '../../utils/errors.js';

const errorName = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  if (typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string') {
    return error.name;
  }
  return '';
};

const isTimeoutError = (error: unknown): boolean => {
  const name = errorName(error);
  return name === 'TimeoutError' || name === 'AbortError';
};

const causeDetails = (error: unknown): { cause: string } | undefined =>
  error instanceof Error ? { cause: error.message } : undefined;

/** Maps transport failures to AppErrors; the API key is never echoed. */
const toTransportAppError = (error: unknown, path: string): AppError => {
  if (error instanceof AppError) return error;
  const details = causeDetails(error);
  let code: DomainErrorCode = 'DOMAIN_CONNECTION_ERROR';
  let status = 503;
  let message = `Domain API connection failed for "${path}"`;
  if (isTimeoutError(error)) {
    code = 'DOMAIN_TIMEOUT';
    status = 504;
    message = `Domain API request timed out for "${path}"`;
  }
  return details === undefined
    ? new AppError(code, status, message)
    : new AppError(code, status, message, details);
};

/** Maps HTTP error statuses to AppErrors; the status travels in the message. */
const toStatusAppError = (status: number, path: string): AppError => {
  const message = `Domain API request failed with status ${status} for "${path}"`;
  const details = { status };
  let code: DomainErrorCode = 'DOMAIN_API_ERROR';
  if (status === 401 || status === 403) {
    code = 'DOMAIN_AUTH_ERROR';
  } else if (status === 404) {
    code = 'DOMAIN_NOT_FOUND';
  } else if (status === 429) {
    code = 'DOMAIN_RATE_LIMITED';
  }
  return new AppError(code, status, message, details);
};

export const createDomainHttpClient = (options: DomainHttpClientOptions): DomainHttpClient => {
  const trimmedBaseUrl = options.baseUrl.endsWith('/') ? options.baseUrl.slice(0, -1) : options.baseUrl;
  const {
    apiKey, timeoutMs 
  } = options;

  const buildUrl = (path: string, query: Record<string, DomainHttpQueryValue> | undefined): string => {
    const url = new URL(`${trimmedBaseUrl}${path}`);
    if (query === undefined) return url.toString();
    for (const [
      key,
      value
    ] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return url.toString();
  };

  return {
    async get(path, query): Promise<unknown> {
      let url: string;
      try {
        url = buildUrl(path, query);
      } catch (error) {
        const details = causeDetails(error);
        throw details === undefined
          ? new AppError('DOMAIN_API_ERROR', 500, `Domain API request failed for "${path}"`)
          : new AppError('DOMAIN_API_ERROR', 500, `Domain API request failed for "${path}"`, details);
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey !== '') {
        headers['X-Api-Key'] = apiKey;
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw toTransportAppError(error, path);
      }

      if (!response.ok) {
        throw toStatusAppError(response.status, path);
      }

      try {
        return (await response.json());
      } catch (error) {
        const details = causeDetails(error);
        throw details === undefined
          ? new AppError('DOMAIN_API_ERROR', 502, `Domain API returned invalid JSON for "${path}"`)
          : new AppError('DOMAIN_API_ERROR', 502, `Domain API returned invalid JSON for "${path}"`, details);
      }
    },
  };
};
