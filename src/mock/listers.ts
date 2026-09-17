import type {
  MockAiResponseTemplateQuery,
  MockAiResponseTemplateResource,
  MockBranchQuery,
  MockBranchResource,
  MockBranchStatus,
  MockMotorcycleQuery,
  MockMotorcycleResource,
  MockMotorcycleStatus,
  MockPaginationMeta,
} from '../interfaces/mockAdminApi.js';
import {
  MOCK_AI_RESPONSE_TEMPLATES,
  MOCK_BRANCHES,
  MOCK_MOTORCYCLES,
} from './data.js';

const DEFAULT_PER_PAGE = 15;

const MOTORCYCLE_STATUS_LABELS: Record<MockMotorcycleStatus, string> = {
  0: 'Available',
  1: 'Discontinued',
  2: 'Out of Stock',
};

const BRANCH_STATUS_LABELS: Record<MockBranchStatus, string> = {
  0: 'Inactive',
  1: 'Active',
};

const paginate = <T>(
  rows: readonly T[],
  page: number,
  perPage: number,
): { items: T[]; meta: MockPaginationMeta } => {
  const total = rows.length;
  const start = (page - 1) * perPage;

  return {
    items: rows.slice(start, start + perPage),
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage)),
    },
  };
};

const matchesSearch = (values: readonly (string | null)[], search: string | undefined): boolean => {
  if (search === undefined || search.length === 0) return true;
  const needle = search.toLowerCase();
  return values.some((value) => (value ?? '').toLowerCase().includes(needle));
};

export const listMotorcycles = (
  query: MockMotorcycleQuery,
): { items: MockMotorcycleResource[]; meta: MockPaginationMeta } => {
  const filtered = MOCK_MOTORCYCLES.filter((motorcycle) => {
    if (!matchesSearch([
      motorcycle.name,
      motorcycle.code
    ], query.search)) return false;
    if (query.brand !== undefined && !query.brand.includes(motorcycle.brand)) return false;
    if (query.status !== undefined && !query.status.includes(motorcycle.status)) return false;
    if (query.variant_type !== undefined && motorcycle.variant_type !== query.variant_type) {
      return false;
    }
    if (query.min_srp !== undefined && motorcycle.srp < query.min_srp) return false;
    if (query.max_srp !== undefined && motorcycle.srp > query.max_srp) return false;
    if (query.available !== undefined && (motorcycle.status === 0) !== query.available) return false;
    return true;
  });

  const sort = query.sort ?? 'name';
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'srp_asc':
        return a.srp - b.srp;
      case 'srp_desc':
        return b.srp - a.srp;
      case 'newest':
        return b.id - a.id;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const {
    items, meta 
  } = paginate(sorted, query.page ?? 1, query.per_page ?? DEFAULT_PER_PAGE);

  return {
    items: items.map((motorcycle) => ({
      id: motorcycle.id,
      name: motorcycle.name,
      code: motorcycle.code,
      brand: motorcycle.brand,
      variant_type: motorcycle.variant_type,
      srp: motorcycle.srp,
      status: motorcycle.status,
      status_label: MOTORCYCLE_STATUS_LABELS[motorcycle.status],
      is_available: motorcycle.status === 0,
      description: motorcycle.description,
      image_url: motorcycle.image_url,
    })),
    meta,
  };
};

export const listBranches = (
  query: MockBranchQuery,
): { items: MockBranchResource[]; meta: MockPaginationMeta } => {
  const filtered = MOCK_BRANCHES.filter((branch) => {
    if (!matchesSearch([
      branch.name,
      branch.address,
      branch.code
    ], query.search)) return false;
    if (query.status !== undefined && !query.status.includes(branch.status)) return false;
    if (query.enable_ai_assist !== undefined && branch.enable_ai_assist !== query.enable_ai_assist) {
      return false;
    }
    return true;
  });

  const sort = query.sort ?? 'name';
  const sorted = [...filtered].sort((a, b) =>
    sort === 'newest' ? b.id - a.id : a.name.localeCompare(b.name));

  const {
    items, meta 
  } = paginate(sorted, query.page ?? 1, query.per_page ?? DEFAULT_PER_PAGE);

  return {
    items: items.map((branch) => ({
      ...branch,
      status_label: BRANCH_STATUS_LABELS[branch.status],
    })),
    meta,
  };
};

export const listAiResponseTemplates = (
  query: MockAiResponseTemplateQuery,
): { items: MockAiResponseTemplateResource[]; meta: MockPaginationMeta } => {
  const filtered = MOCK_AI_RESPONSE_TEMPLATES.filter((template) => {
    if (!matchesSearch([
      template.title,
      template.content
    ], query.search)) return false;
    if (query.type !== undefined && !query.type.includes(template.type)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.id - b.id);
  const {
    items, meta 
  } = paginate(sorted, query.page ?? 1, query.per_page ?? DEFAULT_PER_PAGE);

  return {
    items: items.map((template) => ({
      ...template,
      type_label: template.type === 1 ? 'Greeting' : 'Templated',
    })),
    meta,
  };
};
