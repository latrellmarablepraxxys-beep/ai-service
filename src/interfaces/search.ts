export type SearchErrorCode =
  | 'SEARCH_REQUEST_FAILED'
  | 'SEARCH_TIMEOUT'
  | 'SEARCH_UNAUTHORIZED'
  | 'SEARCH_RATE_LIMITED'
  | 'SEARCH_UNAVAILABLE'
  | 'SEARCH_COLLECTION_ERROR'
  | 'SEARCH_NOT_FOUND';

export type SearchDocument<T extends object> = Omit<T, 'id'> & { id: string };

export type CollectionFieldType =
  | 'string'
  | 'int32'
  | 'int64'
  | 'float'
  | 'bool'
  | 'auto'
  | 'string[]'
  | 'int32[]'
  | 'int64[]'
  | 'float[]'
  | 'bool[]';

export interface CollectionField {
  name: string;
  type: CollectionFieldType;
  facet?: boolean;
  optional?: boolean;
  index?: boolean;
  sort?: boolean;
}

export interface CollectionSchema {
  name: string;
  fields: CollectionField[];
  defaultSortingField?: string;
  tokenSeparators?: string[];
}

export interface SearchQuery {
  q: string;
  queryBy: string[];
  filterBy?: string;
  sortBy?: string;
  page?: number;
  perPage?: number;
  maxHits?: number;
}

export interface SearchResult<T> {
  items: T[];
  /** Authoritative hit count reported by Typesense. */
  found: number;
  page: number;
  perPage: number;
  facetCounts: Record<string, unknown> | undefined;
}

export interface HealthStatus {
  connected: boolean;
  latencyMs: number | undefined;
}

export interface SearchClient {
  upsertDocument<T extends object>(collection: string, document: SearchDocument<T>): Promise<void>;
  upsertDocuments<T extends object>(
    collection: string,
    documents: SearchDocument<T>[],
  ): Promise<void>;
  deleteDocument(collection: string, id: string): Promise<void>;
  search<T extends object>(collection: string, query: SearchQuery): Promise<SearchResult<T>>;
  ensureCollection(name: string, schema: CollectionSchema): Promise<void>;
  health(): Promise<HealthStatus>;
}
