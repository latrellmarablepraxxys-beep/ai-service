import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections.js';
import type {
  DocumentImportParameters,
  DocumentWriteParameters,
  SearchParams,
} from 'typesense/lib/Typesense/Documents.js';

import type { SearchDocument } from './search.js';

export interface TypesenseHitLike<T extends object> {
  document: T;
}

export interface TypesenseSearchResponseLike<T extends object> {
  found: number;
  page: number;
  per_page: number;
  hits?: TypesenseHitLike<T>[];
  facet_counts?: unknown;
}

export interface TypesenseDocumentsLike<T extends object> {
  upsert(document: SearchDocument<T>, options: DocumentWriteParameters): Promise<unknown>;
  search(params: SearchParams): Promise<TypesenseSearchResponseLike<T>>;
  import(documents: SearchDocument<T>[], options: DocumentImportParameters): Promise<unknown>;
}

export interface TypesenseDocumentLike {
  delete(): Promise<unknown>;
}

export interface TypesenseCollectionLike<T extends object> {
  documents(): TypesenseDocumentsLike<T>;
  documents(id: string): TypesenseDocumentLike;
}

export interface TypesenseCollectionInfoLike {
  name: string;
}

export interface TypesenseCollectionsLike {
  create(schema: CollectionCreateSchema): Promise<unknown>;
  retrieve(): Promise<TypesenseCollectionInfoLike[]>;
}

export interface TypesenseClientLike {
  collections(): TypesenseCollectionsLike;
  collections<T extends object>(name: string): TypesenseCollectionLike<T>;
  health: { retrieve(): Promise<{ ok: boolean }> };
}

export interface CreateTypesenseSearchClientOptions {
  client: TypesenseClientLike;
  collectionPrefix?: string;
}
