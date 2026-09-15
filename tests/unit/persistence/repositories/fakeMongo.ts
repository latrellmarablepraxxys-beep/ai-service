import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { vi } from 'vitest';

/**
 * Minimal in-memory stand-in for the mongodb driver surface the repositories
 * use. Every method is a `vi.fn` so tests can force driver failures.
 */

type FakeDoc = Record<string, unknown>;

const sameValue = (left: unknown, right: unknown): boolean => {
  if (left instanceof ObjectId && right instanceof ObjectId) return left.equals(right);
  return left === right;
};

const matches = (doc: FakeDoc, filter: FakeDoc): boolean =>
  Object.entries(filter).every(([
    key,
    value
  ]) => sameValue(doc[key], value));

const asDoc = (value: unknown): FakeDoc => {
  if (typeof value === 'object' && value !== null) return value as FakeDoc;
  return {};
};

/**
 * The driver never stores explicit `undefined` — the key is omitted from the
 * stored document. Dropping undefined-valued keys here keeps the fake faithful,
 * so tests can assert the physical absence of keys the repos must omit.
 */
const withoutUndefined = (doc: FakeDoc): FakeDoc => {
  const clean: FakeDoc = {};
  for (const [
    key,
    value
  ] of Object.entries(doc)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
};

const asNumbers = (value: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (typeof value !== 'object' || value === null) return out;

  for (const [
    key,
    raw
  ] of Object.entries(value)) {
    if (typeof raw === 'number') out[key] = raw;
  }
  return out;
};

const compareValues = (left: unknown, right: unknown): number => {
  const a = left instanceof ObjectId ? left.toHexString() : String(left);
  const b = right instanceof ObjectId ? right.toHexString() : String(right);
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

const createCursor = (docs: FakeDoc[]) => {
  let sortSpec: Record<string, 1 | -1> = {};
  let skipCount = 0;
  let limitCount: number | undefined;

  const cursor = {
    sort(spec: Record<string, 1 | -1>) {
      sortSpec = spec;
      return cursor;
    },
    skip(value: number) {
      skipCount = value;
      return cursor;
    },
    limit(value: number) {
      limitCount = value;
      return cursor;
    },
    toArray(): FakeDoc[] {
      const entries = Object.entries(sortSpec);
      const sorted = [...docs].sort((a, b) => {
        for (const [
          key,
          direction
        ] of entries) {
          const result = compareValues(a[key], b[key]);
          if (result !== 0) return direction === -1 ? -result : result;
        }
        return 0;
      });

      return sorted.slice(skipCount, limitCount === undefined ? undefined : skipCount + limitCount);
    },
  };

  return cursor;
};

export const createFakeCollection = () => {
  const docs: FakeDoc[] = [];

  const insertOne = vi.fn((doc: FakeDoc) => {
    const clean = withoutUndefined(doc);
    const _id = clean._id instanceof ObjectId ? clean._id : new ObjectId();
    clean._id = _id;
    docs.push(clean);
    return {
      acknowledged: true,
      insertedId: _id 
    };
  });

  const findOne = vi.fn((filter: FakeDoc = {}): FakeDoc | null => {
    return docs.find((doc) => matches(doc, filter)) ?? null;
  });

  const find = vi.fn((filter: FakeDoc = {}) =>
    createCursor(docs.filter((doc) => matches(doc, filter))),
  );

  const countDocuments = vi.fn(
    (filter: FakeDoc = {}) => docs.filter((doc) => matches(doc, filter)).length,
  );

  const updateOne = vi.fn((filter: FakeDoc, update: FakeDoc, options?: { upsert?: boolean }) => {
    const target = docs.find((doc) => matches(doc, filter));
    const set = asDoc(update.$set);
    const setOnInsert = asDoc(update.$setOnInsert);
    const inc = asNumbers(update.$inc);

    if (!target) {
      if (!options?.upsert) {
        return {
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
          upsertedId: null 
        };
      }

      const inserted: FakeDoc = { _id: new ObjectId() };
      for (const [
        key,
        value
      ] of Object.entries(filter)) {
        if (!key.startsWith('$')) inserted[key] = value;
      }
      Object.assign(inserted, withoutUndefined(setOnInsert), withoutUndefined(set));
      for (const [
        key,
        value
      ] of Object.entries(inc)) {
        const current = inserted[key];
        inserted[key] = (typeof current === 'number' ? current : 0) + value;
      }

      docs.push(inserted);
      return {
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
        upsertedId: inserted._id 
      };
    }

    // $setOnInsert only applies on the insert branch, never to matched docs.
    Object.assign(target, withoutUndefined(set));
    for (const [
      key,
      value
    ] of Object.entries(inc)) {
      const current = target[key];
      target[key] = (typeof current === 'number' ? current : 0) + value;
    }

    return {
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null 
    };
  });

  return {
    docs,
    insertOne,
    findOne,
    find,
    countDocuments,
    updateOne 
  };
};

export const createFakeDb = () => {
  const collections = new Map<string, ReturnType<typeof createFakeCollection>>();

  const collection = vi.fn((name: string) => {
    const existing = collections.get(name);
    if (existing) return existing;

    const created = createFakeCollection();
    collections.set(name, created);
    return created;
  });

  const createCollection = vi.fn((name: string) => {
    if (collections.has(name)) {
      throw Object.assign(new Error(`Collection ${name} already exists`), { code: 48 });
    }

    collections.set(name, createFakeCollection());
    return { collectionName: name };
  });

  return {
    collection,
    createCollection,
    collections 
  };
};

/** Casting at the test boundary keeps repositories typed against the real driver. */
export const asDb = (fake: ReturnType<typeof createFakeDb>): Db => fake as unknown as Db;
