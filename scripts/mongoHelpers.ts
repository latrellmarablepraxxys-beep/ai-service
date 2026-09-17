/**
 * Shared plumbing for the standalone database scripts in `scripts/`.
 *
 * Keeps every script on one connection lifecycle, one set of collection
 * helpers, and one destructive-operation guard. `scripts/` is excluded from
 * coverage; this module is exercised by `tests/unit/scripts/mongoHelpers.test.ts`.
 */
import type { Db } from 'mongodb';

import { appConfig } from '../src/config/app.js';
import type { CollectionName } from '../src/interfaces/mongo.js';
import { createMongoConnection } from '../src/services/mongodb/MongoConnection.js';
import { AppError } from '../src/utils/errors.js';

/** MongoDB `NamespaceNotFound` — the collection is already gone. */
const NAMESPACE_NOT_FOUND_CODE = 26;
/** MongoDB `NamespaceExists` — a create/check race; the collection exists either way. */
const NAMESPACE_EXISTS_CODE = 48;

const hasCode = (error: unknown): error is { code: unknown } =>
  typeof error === 'object' && error !== null && 'code' in error;

/** Opens the configured Mongo connection, runs `fn`, and always closes it. */
export const withMongoConnection = async <T>(run: (db: Db) => Promise<T>): Promise<T> => {
  const connection = createMongoConnection({});
  await connection.connect();

  try {
    return await run(connection.getDb());
  } finally {
    await connection.close();
  }
};

const collectionExists = async (db: Db, name: CollectionName): Promise<boolean> =>
  db.listCollections({ name }, { nameOnly: true }).hasNext();

/** Returns true when the collection was created by this call. */
export const ensureCollection = async (db: Db, name: CollectionName): Promise<boolean> => {
  if (await collectionExists(db, name)) return false;

  try {
    await db.createCollection(name);
    return true;
  } catch (error) {
    // Ignore a create/check race — the collection exists either way.
    if (hasCode(error) && error.code === NAMESPACE_EXISTS_CODE) return false;
    throw error;
  }
};

/** Returns true when the collection was dropped by this call. */
export const dropCollection = async (db: Db, name: CollectionName): Promise<boolean> => {
  try {
    await db.collection(name).drop();
    return true;
  } catch (error) {
    if (hasCode(error) && error.code === NAMESPACE_NOT_FOUND_CODE) return false;
    throw error;
  }
};

/** Overrides for `assertDestructiveAllowed`; default to the live env/argv. */
export interface DestructiveGuardOptions {
  isProd?: boolean;
  force?: boolean;
}

/**
 * Blocks a destructive script in production, and everywhere unless `--force`
 * is passed (`npm run db:clear -- --force`). `options` exists so the guard is
 * unit-testable without touching `process.argv` or the environment.
 */
export const assertDestructiveAllowed = (
  action: string,
  options: DestructiveGuardOptions = {},
): void => {
  const isProd = options.isProd ?? appConfig.isProd;
  const force = options.force ?? process.argv.includes('--force');

  if (isProd) {
    throw new AppError('FORBIDDEN', 403, `${action} refuses to run with NODE_ENV=production`);
  }

  if (!force) {
    throw new AppError('FORBIDDEN', 403, `${action} is destructive — re-run with \`--force\``);
  }
};
