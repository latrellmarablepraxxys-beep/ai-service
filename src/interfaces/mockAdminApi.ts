export type MockMotorcycleBrand = 'HONDA' | 'YAMAHA' | 'SUZUKI' | 'KAWASAKI';
export type MockMotorcycleStatus = 0 | 1 | 2;
export type MockBranchStatus = 0 | 1;
export type MockAiResponseTemplateType = 1 | 2;

/** A seeded motorcycle row (the shape the admin stores). */
export interface MockMotorcycle {
  id: number;
  name: string;
  code: string;
  brand: MockMotorcycleBrand;
  status: MockMotorcycleStatus;
  variant_type: string | null;
  srp: number;
  description: string | null;
  image_url: string | null;
}

/** The motorcycle as returned by `GET /api/v1/motorcycles`. */
export interface MockMotorcycleResource {
  id: number;
  name: string;
  code: string;
  brand: MockMotorcycleBrand;
  variant_type: string | null;
  srp: number;
  status: MockMotorcycleStatus;
  status_label: string;
  is_available: boolean;
  description: string | null;
  image_url: string | null;
}

export interface MockBranch {
  id: number;
  code: string;
  name: string;
  address: string;
  status: MockBranchStatus;
  enable_ai_assist: boolean;
  page_name: string | null;
}

/** The branch as returned by `GET /api/v1/branches`. */
export interface MockBranchResource extends MockBranch {
  status_label: string;
}

export interface MockAiResponseTemplate {
  id: number;
  title: string;
  content: string;
  type: MockAiResponseTemplateType;
}

/** The template as returned by `GET /api/v1/ai-response-templates`. */
export interface MockAiResponseTemplateResource extends MockAiResponseTemplate {
  type_label: string;
}

export interface MockMotorcycleQuery {
  search?: string | undefined;
  brand?: MockMotorcycleBrand[] | undefined;
  status?: MockMotorcycleStatus[] | undefined;
  variant_type?: string | undefined;
  min_srp?: number | undefined;
  max_srp?: number | undefined;
  available?: boolean | undefined;
  sort?: 'name' | 'srp_asc' | 'srp_desc' | 'newest' | undefined;
  per_page?: number | undefined;
  page?: number | undefined;
}

export interface MockBranchQuery {
  search?: string | undefined;
  status?: MockBranchStatus[] | undefined;
  enable_ai_assist?: boolean | undefined;
  sort?: 'name' | 'newest' | undefined;
  per_page?: number | undefined;
  page?: number | undefined;
}

export interface MockAiResponseTemplateQuery {
  search?: string | undefined;
  type?: MockAiResponseTemplateType[] | undefined;
  per_page?: number | undefined;
  page?: number | undefined;
}

export interface MockPaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** Admin success envelope: `{ success, data, message?, meta? }`. */
export interface MockSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: MockPaginationMeta;
}

/** Admin error envelope: `{ error, status? }`. */
export interface MockErrorResponse {
  error: string;
  status?: number;
}

/** Admin platform/validation failure envelope. */
export interface MockValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}
