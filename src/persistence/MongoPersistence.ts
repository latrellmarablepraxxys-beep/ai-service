import type { CreateMongoPersistenceOptions } from '../interfaces/mongo.js';
import type {
  MemoryRepository,
  MessageRepository,
  Persistence,
  RunRepository,
  ThreadRepository,
} from '../interfaces/persistence.js';
import { createMemoryRepository } from './repositories/MemoryRepository.js';
import { createMessageRepository } from './repositories/MessageRepository.js';
import { createRunRepository } from './repositories/RunRepository.js';
import { createThreadRepository } from './repositories/ThreadRepository.js';

/**
 * Builds the MongoDB-backed persistence port.
 *
 * Repositories are resolved lazily from `connection.getDb()` on first access so
 * that constructing the persistence layer never requires a live connection —
 * `getDb()` itself raises `PERSISTENCE_CONNECTION_ERROR` when called too early.
 */
export const createMongoPersistence = (options: CreateMongoPersistenceOptions): Persistence => {
  const { connection } = options;

  let threads: ThreadRepository | undefined;
  let messages: MessageRepository | undefined;
  let memories: MemoryRepository | undefined;
  let runs: RunRepository | undefined;

  return {
    get threads(): ThreadRepository {
      threads ??= createThreadRepository(connection.getDb());
      return threads;
    },

    get messages(): MessageRepository {
      messages ??= createMessageRepository(connection.getDb());
      return messages;
    },

    get memories(): MemoryRepository {
      memories ??= createMemoryRepository(connection.getDb());
      return memories;
    },

    get runs(): RunRepository {
      runs ??= createRunRepository(connection.getDb());
      return runs;
    },

    connect: (): Promise<void> => connection.connect(),

    close: (): Promise<void> => connection.close(),

    health: () => connection.health(),
  };
};
