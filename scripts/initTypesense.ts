/**
 * Idempotent Typesense bootstrap for the collections this service owns.
 *
 * The RAG index is shared with, and owned by, the Laravel admin (Scout) — this
 * service consumes `crm_vector_ai` instead of creating it, so no collection is
 * provisioned by default. The script verifies connectivity and reports both the
 * service-owned schemas registered here and the collections visible under
 * `TYPESENSE_COLLECTION_PREFIX`. Safe to re-run.
 *
 * Usage: npm run typesense:init
 */
import { typesenseConfig } from '../src/config/typesense.js';
import type { CollectionSchema } from '../src/interfaces/search.js';
import {
  createTypesenseClient,
  createTypesenseSearchClient,
} from '../src/services/typesense/TypesenseSearchClient.js';
import { logger } from '../src/utils/logger.js';

/**
 * Service-owned collection schemas, keyed by the unprefixed logical name.
 * Empty by design: the shared index belongs to Laravel (see `.env.example`).
 * Register a `CollectionSchema` here when this service starts owning a collection.
 */
const SERVICE_COLLECTIONS: Readonly<Record<string, CollectionSchema>> = Object.freeze({});

const init = async (): Promise<void> => {
  const client = createTypesenseClient();
  const search = createTypesenseSearchClient({ client });

  const health = await search.health();
  if (!health.connected) {
    throw new Error(
      `Typesense is not reachable at ${typesenseConfig.protocol}://${typesenseConfig.host}:${typesenseConfig.port}`,
    );
  }

  const collections = await client.collections().retrieve();
  const existingNames = new Set(collections.map((collection) => collection.name));
  const created: string[] = [];
  const existing: string[] = [];

  for (const [
    name,
    schema
  ] of Object.entries(SERVICE_COLLECTIONS)) {
    const fullName = `${typesenseConfig.collectionPrefix}${name}`;
    if (existingNames.has(fullName)) {
      existing.push(fullName);
      continue;
    }

    await search.ensureCollection(name, schema);
    created.push(fullName);
    logger.info({ collection: fullName }, 'Collection ensured');
  }

  logger.info({
    prefix: typesenseConfig.collectionPrefix,
    created,
    existing,
    total: Object.keys(SERVICE_COLLECTIONS).length,
    visible: collections.map((collection) => collection.name),
  }, 'Typesense initialization complete');
};

init().catch((error: unknown) => {
  logger.error({ err: error }, 'Typesense initialization failed');
  process.exitCode = 1;
});
