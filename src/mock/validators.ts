import { z } from 'zod';
import type { ZodError } from 'zod';

import type {
  MockAiResponseTemplateType,
  MockBranchStatus,
  MockKnowledgeContentType,
  MockMotorcycleStatus,
} from '../interfaces/mockAdminApi.js';

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

/** Express can hand back a scalar or an array for the same key; normalise to an array. */
const toArray = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  return [value];
};

const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional());
const perPageQuery = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(50).optional(),
);
const pageQuery = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional());
const booleanQuery = z.preprocess(
  emptyToUndefined,
  z
    .enum([
      '0',
      '1',
      'true',
      'false'
    ])
    .transform((value) => value === '1' || value === 'true')
    .optional(),
);

const motorcycleStatusSchema = z
  .enum([
    '0',
    '1',
    '2'
  ])
  .transform((value): MockMotorcycleStatus => (value === '0' ? 0 : value === '1' ? 1 : 2));

const branchStatusSchema = z
  .enum([
    '0',
    '1'
  ])
  .transform((value): MockBranchStatus => (value === '1' ? 1 : 0));

const templateTypeSchema = z
  .enum([
    '1',
    '2'
  ])
  .transform((value): MockAiResponseTemplateType => (value === '1' ? 1 : 2));

const knowledgeContentTypeSchema = z
  .enum([
    '1',
    '2',
    '3',
    '4'
  ])
  .transform((value): MockKnowledgeContentType => {
    if (value === '1') return 1;
    if (value === '2') return 2;
    if (value === '3') return 3;
    return 4;
  });

/** Accepts `key=a,b`, `key=a&key=b`, and `key[]=a&key[]=b`; splits on commas. */
const commaSeparated = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  const parts = (Array.isArray(value) ? value : [value]).flatMap((entry) =>
    String(entry)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0));
  return parts.length === 0 ? undefined : parts;
};

export const motorcycleQuerySchema = z
  .object({
    search: z.string().max(255).optional(),
    brand: z.preprocess(
      toArray,
      z
        .array(z.enum([
          'HONDA',
          'YAMAHA',
          'SUZUKI',
          'KAWASAKI'
        ]))
        .optional(),
    ),
    status: z.preprocess(toArray, z.array(motorcycleStatusSchema).optional()),
    variant_type: z.string().max(255).optional(),
    min_srp: optionalNumber,
    max_srp: optionalNumber,
    available: booleanQuery,
    include: z.string().max(255).optional(),
    sort: z
      .enum([
        'name',
        'srp_asc',
        'srp_desc',
        'newest'
      ])
      .optional(),
    per_page: perPageQuery,
    page: pageQuery,
  })
  .strip();

export const branchQuerySchema = z
  .object({
    search: z.string().max(255).optional(),
    status: z.preprocess(toArray, z.array(branchStatusSchema).optional()),
    enable_ai_assist: booleanQuery,
    sort: z
      .enum([
        'name',
        'newest'
      ])
      .optional(),
    per_page: perPageQuery,
    page: pageQuery,
  })
  .strip();

export const aiResponseTemplateQuerySchema = z
  .object({
    search: z.string().max(255).optional(),
    type: z.preprocess(toArray, z.array(templateTypeSchema).optional()),
    per_page: perPageQuery,
    page: pageQuery,
  })
  .strip();

export const knowledgeEntryQuerySchema = z
  .object({
    keys: z.preprocess(
      commaSeparated,
      z
        .array(z.string().min(1).max(255))
        .optional(),
    ),
    content_type: z.preprocess(commaSeparated, z.array(knowledgeContentTypeSchema).optional()),
    search: z.string().max(255).optional(),
    current: booleanQuery,
    per_page: perPageQuery,
    page: pageQuery,
  })
  .strip();

export const escalationTopicQuerySchema = z
  .object({
    active: booleanQuery,
    search: z.string().max(255).optional(),
    per_page: perPageQuery,
    page: pageQuery,
  })
  .strip();

export const promotionQuerySchema = z
  .object({
    applicability: z.preprocess(
      emptyToUndefined,
      z
        .enum([
          'cash',
          'installment',
          'bajaj',
          'all'
        ])
        .optional(),
    ),
    current: booleanQuery,
    per_page: perPageQuery,
    page: pageQuery,
  })
  .strip();

/** Flattens a Zod error into the admin's `{ message, errors }` validation shape. */
export const toValidationError = (
  error: ZodError,
): { message: string; fields: Record<string, string[]> } => {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'error';
    const messages = fields[key] ?? [];
    messages.push(issue.message);
    fields[key] = messages;
  }

  return {
    message: error.issues[0]?.message ?? 'The given data was invalid.',
    fields,
  };
};
