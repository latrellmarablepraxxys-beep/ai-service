import { Client, Errors } from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections.js';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection.js';
import type { SearchParams } from 'typesense/lib/Typesense/Documents.js';

import { typesenseConfig } from '../../config/typesense.js';
import type {
  CollectionSchema,
  HealthStatus,
  SearchClient,
  SearchDocument,
  SearchQuery,
  SearchResult,
} from '../../interfaces/search.js';
import type {
  CreateTypesenseSearchClientOptions,
  TypesenseClientLike,
  TypesenseCollectionLike,
} from '../../interfaces/typesenseClient.js';
import { AppError, isAppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const CONNECTION_ERROR_CODES = /^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)/;

const getHttpStatus = (error: unknown): number | undefined =>
  error instanceof Error && 'httpStatus' in error && typeof error.httpStatus === 'number'
    ? error.httpStatus
    : undefined;

const isConnectionError = (error: Error): boolean =>
  'code' in error && typeof error.code === 'string' && CONNECTION_ERROR_CODES.test(error.code);

/** Maps Typesense failures to AppErrors with port error codes. */
const toSearchAppError = (error: unknown, message: string): AppError => {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) {
      return new AppError('SEARCH_UNAUTHORIZED', status, message, { cause: error.message });
    }
    if (status === 404) {
      return new AppError('SEARCH_NOT_FOUND', 404, message, { cause: error.message });
    }
    if (status === 429) {
      return new AppError('SEARCH_RATE_LIMITED', 429, message, { cause: error.message });
    }
    if (status === 503) {
      return new AppError('SEARCH_UNAVAILABLE', 503, message, { cause: error.message });
    }
    if (status !== undefined) {
      return new AppError('SEARCH_REQUEST_FAILED', status, message, { cause: error.message });
    }
    const lower = error.message.toLowerCase();
    if (lower.includes('timed out') || lower.includes('timeout')) {
      return new AppError('SEARCH_TIMEOUT', 504, message, { cause: error.message });
    }
    if (isConnectionError(error)) {
      return new AppError('SEARCH_UNAVAILABLE', 503, message, { cause: error.message });
    }
  }
  return new AppError('SEARCH_REQUEST_FAILED', 500, message);
};

/** Collection creation failures (other than already-exists) are a service-side problem. */
const toCollectionAppError = (error: unknown, message: string): AppError => {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    return new AppError('SEARCH_COLLECTION_ERROR', 503, message, { cause: error.message });
  }
  return new AppError('SEARCH_COLLECTION_ERROR', 503, message);
};

const toTypesenseSchema = (name: string, schema: CollectionSchema): CollectionCreateSchema => ({
  name,
  // Port fields are a strict subset of the SDK's CollectionFieldSchema — cast
  // at the boundary instead of widening the port type.
  fields: schema.fields as CollectionFieldSchema[],
  ...(schema.defaultSortingField !== undefined && {default_sorting_field: schema.defaultSortingField,}),
  ...(schema.tokenSeparators !== undefined && { token_separators: schema.tokenSeparators }),
});

const toSearchParams = (query: SearchQuery): SearchParams => ({
  q: query.q,
  query_by: query.queryBy,
  ...(query.filterBy !== undefined && { filter_by: query.filterBy }),
  ...(query.sortBy !== undefined && { sort_by: query.sortBy }),
  ...(query.page !== undefined && { page: query.page }),
  ...(query.perPage !== undefined && { per_page: query.perPage }),
  // The SDK uses `limit_hits`, not `max_hits`.
  ...(query.maxHits !== undefined && { limit_hits: query.maxHits }),
});

export const createTypesenseSearchClient = (
  options: CreateTypesenseSearchClientOptions,
): SearchClient => {
  const prefix = options.collectionPrefix ?? typesenseConfig.collectionPrefix;
  const { client } = options;

  const collection = <T extends object>(name: string): TypesenseCollectionLike<T> =>
    client.collections<T>(`${prefix}${name}`);

  const upsertDocument = async <T extends object>(
    name: string,
    document: SearchDocument<T>,
  ): Promise<void> => {
    try {
      await collection(name).documents().upsert(document, { action: 'upsert' });
    } catch (error) {
      throw toSearchAppError(error, `Typesense upsert failed for collection "${name}"`);
    }
  };

  return {
    upsertDocument,
    async upsertDocuments<T extends object>(
      name: string,
      documents: SearchDocument<T>[],
    ): Promise<void> {
      try {
        // Bulk path — a single import request instead of N sequential upserts.
        await collection<T>(name).documents().import(documents, { action: 'upsert' });
      } catch (error) {
        throw toSearchAppError(error, `Typesense bulk upsert failed for collection "${name}"`);
      }
    },

    async deleteDocument(name: string, id: string): Promise<void> {
      try {
        await collection(name).documents(id).delete();
      } catch (error) {
        throw toSearchAppError(error, `Typesense delete failed for collection "${name}"`);
      }
    },

    async search<T extends object>(name: string, query: SearchQuery): Promise<SearchResult<T>> {
      try {
        const response = await collection<T>(name).documents().search(toSearchParams(query));
        return {
          items: (response.hits ?? []).map((hit) => hit.document),
          found: response.found,
          page: response.page,
          perPage: response.per_page,
          facetCounts: response.facet_counts as Record<string, unknown> | undefined,
        };
      } catch (error) {
        throw toSearchAppError(error, `Typesense search failed for collection "${name}"`);
      }
    },

    async ensureCollection(name: string, schema: CollectionSchema): Promise<void> {
      try {
        await client.collections().create(toTypesenseSchema(`${prefix}${name}`, schema));
      } catch (error) {
        // Creating an existing collection is idempotent from the caller's view.
        // Match the SDK's typed 409 error; the status check keeps stubs working.
        if (error instanceof Errors.ObjectAlreadyExists || getHttpStatus(error) === 409) {
          return;
        }
        throw toCollectionAppError(error, `Typesense collection creation failed for "${name}"`);
      }
    },

    async health(): Promise<HealthStatus> {
      const start = performance.now();
      try {
        const response = await client.health.retrieve();
        if (!response.ok) {
          return {
            connected: false,
            latencyMs: undefined 
          };
        }
        return {
          connected: true,
          latencyMs: Math.round(performance.now() - start) 
        };
      } catch (error) {
        logger.warn({ err: error }, 'Typesense health check failed');
        return {
          connected: false,
          latencyMs: undefined 
        };
      }
    },
  };
};

/**
 * Builds the real Typesense client from config. This is the only place the
 * `typesense` package is imported at runtime. The single cast at this factory
 * boundary adapts the SDK surface to `TypesenseClientLike` (tests inject stubs
 * with the same shape).
 */
export const createTypesenseClient = (): TypesenseClientLike =>
  new Client({
    // Spread into fresh node objects: the SDK mutates each node (sets `path`),
    // and the frozen config objects reject the write.
    nodes: typesenseConfig.nodes.map((node) => ({ ...node })),
    apiKey: typesenseConfig.apiKey,
    connectionTimeoutSeconds: typesenseConfig.connectionTimeoutSeconds,
  }) as unknown as TypesenseClientLike;
