import type { RunStatus } from '../enums/RunStatus.js';
import type { ThreadStatus } from '../enums/ThreadStatus.js';
import type { TicketRoute } from './domain.js';

export type { RunStatus, ThreadStatus };

export type PersistenceErrorCode =
  | 'PERSISTENCE_CONNECTION_ERROR'
  | 'PERSISTENCE_QUERY_ERROR'
  | 'PERSISTENCE_TIMEOUT'
  | 'PERSISTENCE_DUPLICATE_KEY'
  | 'PERSISTENCE_NOT_FOUND';

export type EntityId = string;

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type RunType = 'routing' | 'escalation' | 'response';

export interface Thread {
  id: EntityId;
  ticketId: string;
  status: ThreadStatus;
  route: TicketRoute;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: EntityId;
  threadId: EntityId;
  role: MessageRole;
  content: string;
  tokenCount: number | undefined;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Memory {
  id: EntityId;
  threadId: EntityId;
  summary: string;
  tokenCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: EntityId;
  threadId: EntityId;
  type: RunType;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | undefined;
  error: string | undefined;
  startedAt: string;
  completedAt: string | undefined;
}

export interface CreateThreadInput {
  ticketId: string;
  route: TicketRoute;
  metadata?: Record<string, unknown>;
}

export interface UpdateThreadInput {
  status?: ThreadStatus;
  route?: TicketRoute;
  metadata?: Record<string, unknown>;
}

export interface CreateMessageInput {
  threadId: EntityId;
  role: MessageRole;
  content: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface UpsertMemoryInput {
  threadId: EntityId;
  summary: string;
  tokenCount: number;
}

export interface CreateRunInput {
  threadId: EntityId;
  type: RunType;
  input: Record<string, unknown>;
}

export interface UpdateRunInput {
  status?: RunStatus;
  output?: Record<string, unknown>;
  error?: string;
  completedAt?: string;
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
}

export interface HealthStatus {
  connected: boolean;
  latencyMs: number | undefined;
}

export interface ThreadRepository {
  create(input: CreateThreadInput): Promise<Thread>;
  findById(id: EntityId): Promise<Thread | null>;
  findByTicketId(ticketId: string): Promise<Thread | null>;
  update(id: EntityId, input: UpdateThreadInput): Promise<Thread>;
  listByTicketId(ticketId: string, params?: PaginationParams): Promise<PaginatedResult<Thread>>;
}

export interface MessageRepository {
  create(input: CreateMessageInput): Promise<Message>;
  findById(id: EntityId): Promise<Message | null>;
  listByThread(threadId: EntityId, params?: PaginationParams): Promise<PaginatedResult<Message>>;
}

export interface MemoryRepository {
  upsert(input: UpsertMemoryInput): Promise<Memory>;
  findByThread(threadId: EntityId): Promise<Memory | null>;
}

export interface RunRepository {
  create(input: CreateRunInput): Promise<Run>;
  findById(id: EntityId): Promise<Run | null>;
  update(id: EntityId, input: UpdateRunInput): Promise<Run>;
  listByThread(threadId: EntityId, params?: PaginationParams): Promise<PaginatedResult<Run>>;
}

export interface Persistence {
  threads: ThreadRepository;
  messages: MessageRepository;
  memories: MemoryRepository;
  runs: RunRepository;
  connect(): Promise<void>;
  close(): Promise<void>;
  health(): Promise<HealthStatus>;
}
