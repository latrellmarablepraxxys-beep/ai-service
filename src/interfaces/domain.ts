export type DomainErrorCode =
  | 'DOMAIN_API_ERROR'
  | 'DOMAIN_CONNECTION_ERROR'
  | 'DOMAIN_TIMEOUT'
  | 'DOMAIN_AUTH_ERROR'
  | 'DOMAIN_VALIDATION_ERROR'
  | 'DOMAIN_RATE_LIMITED'
  | 'DOMAIN_NOT_FOUND';

export type TicketRoute = 'ai' | 'agent' | 'queue';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AgentStatus = 'online' | 'offline' | 'away' | 'busy';

export interface Ticket {
  id: string;
  externalId: string | undefined;
  subject: string | undefined;
  status: TicketStatus;
  priority: TicketPriority;
  channelId: string;
  contactId: string | undefined;
  assignedAgentId: string | undefined;
  slaId: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string | undefined;
  status: AgentStatus;
  capacity: number | undefined;
}

export interface SlaConfig {
  id: string;
  name: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationMinutes: number | undefined;
}

export interface CreateTicketInput {
  externalId: string;
  channelId: string;
  content: string;
  subject?: string;
  priority?: TicketPriority;
  contactId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  subject?: string;
  assignedAgentId?: string;
}

export interface ListTicketsParams {
  page?: number;
  perPage?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAgentId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
}

export interface DomainClient {
  upsertTicket(input: CreateTicketInput): Promise<Ticket>;
  updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket>;
  listTickets(params?: ListTicketsParams): Promise<PaginatedResult<Ticket>>;
  assignTicket(id: string, agentId: string): Promise<Ticket>;
  getSla(id: string): Promise<SlaConfig>;
}
