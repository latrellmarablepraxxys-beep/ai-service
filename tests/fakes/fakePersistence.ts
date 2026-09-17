import { RunStatus } from '@enums/RunStatus.js';
import { ThreadStatus } from '@enums/ThreadStatus.js';
import type {
  CreateMessageInput,
  CreateRunInput,
  CreateThreadInput,
  EntityId,
  Memory,
  Message,
  PaginatedResult,
  PaginationParams,
  Persistence,
  Run,
  Thread,
  UpdateRunInput,
  UpdateThreadInput,
  UpsertMemoryInput,
} from '@interfaces/persistence.js';

const nowIso = (): string => new Date().toISOString();

const paginate = <T>(rows: T[], params: PaginationParams | undefined): PaginatedResult<T> => {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 50;
  const start = (page - 1) * perPage;
  const items = rows.slice(start, start + perPage);

  return {
    items,
    total: rows.length,
    page,
    perPage,
    hasNextPage: start + perPage < rows.length,
  };
};

/** In-memory `Persistence` for tests — deterministic ids, no Mongo. */
export class FakePersistence implements Persistence {
  private threadRows: Thread[] = [];
  private messageRows: Message[] = [];
  private memoryRows: Memory[] = [];
  private runRows: Run[] = [];
  private sequence = 0;

  private nextId(prefix: string): EntityId {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  readonly threads = {
    create: (input: CreateThreadInput): Promise<Thread> => {
      const thread: Thread = {
        id: this.nextId('thread'),
        ticketId: input.ticketId,
        status: ThreadStatus.Active,
        route: input.route,
        metadata: input.metadata ?? {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.threadRows.push(thread);
      return Promise.resolve(thread);
    },

    findById: (id: EntityId): Promise<Thread | null> =>
      Promise.resolve(this.threadRows.find((thread) => thread.id === id) ?? null),

    findByTicketId: (ticketId: string): Promise<Thread | null> =>
      Promise.resolve(this.threadRows.find((thread) => thread.ticketId === ticketId) ?? null),

    update: (id: EntityId, input: UpdateThreadInput): Promise<Thread> => {
      const index = this.threadRows.findIndex((thread) => thread.id === id);
      const current = this.threadRows[index];
      if (current === undefined) return Promise.reject(new Error(`thread "${id}" not found`));

      const updated: Thread = {
        ...current,
        ...input,
        updatedAt: nowIso(),
      };
      this.threadRows[index] = updated;
      return Promise.resolve(updated);
    },

    listByTicketId: (ticketId: string, params?: PaginationParams): Promise<PaginatedResult<Thread>> =>
      Promise.resolve(paginate(
        this.threadRows.filter((thread) => thread.ticketId === ticketId),
        params,
      )),
  };

  readonly messages = {
    create: (input: CreateMessageInput): Promise<Message> => {
      const message: Message = {
        id: this.nextId('message'),
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        tokenCount: input.tokenCount,
        metadata: input.metadata ?? {},
        createdAt: nowIso(),
      };
      this.messageRows.push(message);
      return Promise.resolve(message);
    },

    findById: (id: EntityId): Promise<Message | null> =>
      Promise.resolve(this.messageRows.find((message) => message.id === id) ?? null),

    listByThread: (threadId: EntityId, params?: PaginationParams): Promise<PaginatedResult<Message>> =>
      Promise.resolve(paginate(
        this.messageRows.filter((message) => message.threadId === threadId),
        params,
      )),
  };

  readonly memories = {
    upsert: (input: UpsertMemoryInput): Promise<Memory> => {
      const existing = this.memoryRows.find((memory) => memory.threadId === input.threadId);
      if (existing === undefined) {
        const memory: Memory = {
          id: this.nextId('memory'),
          threadId: input.threadId,
          summary: input.summary,
          tokenCount: input.tokenCount,
          version: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        this.memoryRows.push(memory);
        return Promise.resolve(memory);
      }

      existing.summary = input.summary;
      existing.tokenCount = input.tokenCount;
      existing.version += 1;
      existing.updatedAt = nowIso();
      return Promise.resolve(existing);
    },

    findByThread: (threadId: EntityId): Promise<Memory | null> =>
      Promise.resolve(this.memoryRows.find((memory) => memory.threadId === threadId) ?? null),
  };

  readonly runs = {
    create: (input: CreateRunInput): Promise<Run> => {
      const run: Run = {
        id: this.nextId('run'),
        threadId: input.threadId,
        type: input.type,
        status: RunStatus.Running,
        input: input.input,
        output: undefined,
        error: undefined,
        startedAt: nowIso(),
        completedAt: undefined,
      };
      this.runRows.push(run);
      return Promise.resolve(run);
    },

    findById: (id: EntityId): Promise<Run | null> =>
      Promise.resolve(this.runRows.find((run) => run.id === id) ?? null),

    update: (id: EntityId, input: UpdateRunInput): Promise<Run> => {
      const index = this.runRows.findIndex((run) => run.id === id);
      const current = this.runRows[index];
      if (current === undefined) return Promise.reject(new Error(`run "${id}" not found`));

      const updated: Run = {
        ...current,
        ...input,
      };
      this.runRows[index] = updated;
      return Promise.resolve(updated);
    },

    listByThread: (threadId: EntityId, params?: PaginationParams): Promise<PaginatedResult<Run>> =>
      Promise.resolve(paginate(
        this.runRows.filter((run) => run.threadId === threadId),
        params,
      )),
  };

  connect(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  health(): Promise<{ connected: boolean; latencyMs: number | undefined }> {
    return Promise.resolve({
      connected: true,
      latencyMs: 0 
    });
  }
}
