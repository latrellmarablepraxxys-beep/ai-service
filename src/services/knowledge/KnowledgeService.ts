import { z } from 'zod';

import { KnowledgeContentType } from '../../enums/KnowledgeContentType.js';
import type {
  CatalogInstallmentTerm,
  CatalogProduct,
  CatalogVariant,
  EscalationTopic,
  KnowledgeEntry,
  KnowledgeService,
  KnowledgeServiceOptions,
  PaymentApplicability,
  Promotion,
  PromotionItem,
} from '../../interfaces/knowledge.js';
import { AppError } from '../../utils/errors.js';
import type { DomainHttpQueryValue } from '../../interfaces/domain.js';
import { DEGRADED_ESCALATION_TOPICS } from './DegradedEscalationSeed.js';

const idSchema = z.union([
  z.string(),
  z.number()
]).transform((value) => String(value));

const knowledgeEntryRowSchema = z.object({
  key: z.string().min(1),
  title: z.string(),
  content: z.string(),
  content_type: z.nativeEnum(KnowledgeContentType),
  version: z.number().int(),
}).strip();

const escalationTopicRowSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  keywords: z.array(z.string()),
  department: z.string(),
  priority: z.enum([
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
  ]),
  fallback_template_key: z.string(),
}).strip();

const installmentTermRowSchema = z.object({
  term_months: z.number().int().positive(),
  monthly_amount: z.number(),
}).strip();

const variantRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  image_url: z.string().nullish(),
  cash_price: z.number().nullish(),
  min_downpayment: z.number().nullish(),
  updated_payment_less: z.number().nullish(),
  terms: z.array(installmentTermRowSchema).optional(),
}).strip();

const motorcycleRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  brand: z.string(),
  variants: z.array(variantRowSchema).optional(),
}).strip();

const promotionItemRowSchema = z.object({
  body: z.string(),
  sort_order: z.number().int(),
}).strip();

const promotionRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  applicability: z.enum([
    'cash',
    'installment',
    'bajaj',
    'all'
  ]),
  items: z.array(promotionItemRowSchema),
}).strip();

type MotorcycleRow = z.infer<typeof motorcycleRowSchema>;
type MotorcycleVariantRow = z.infer<typeof variantRowSchema>;
type PromotionRow = z.infer<typeof promotionRowSchema>;

const ESCALATION_TOPICS_KEY = 'knowledge:escalation_topics';

const templateKeyFor = (key: string): string => `knowledge:template:${key}`;

const entriesKeyFor = (keys: readonly string[]): string =>
  `knowledge:entries:${[...keys].sort().join(',')}`;

const searchKeyFor = (normalizedQuery: string): string => `catalog:search:${normalizedQuery}`;

const freebiesKeyFor = (applicability: string): string => `catalog:freebies:${applicability}`;

/**
 * The guard must never go blind on an admin outage, but the degraded seed
 * must not mask a contract break: only connection/timeout/5xx failures
 * degrade. Validation/auth/4xx errors rethrow so bad envelopes and revoked
 * credentials surface instead of silently serving stale topics.
 */
const isDegradableTopicError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) return true;
  switch (error.code) {
    case 'DOMAIN_CONNECTION_ERROR':
    case 'DOMAIN_TIMEOUT':
    case 'CACHE_CONNECTION_ERROR':
    case 'CACHE_TIMEOUT':
      return true;
    case 'DOMAIN_API_ERROR':
      return error.status >= 500;
    default:
      return false;
  }
};

/** The wire never carries `variables`/`triggers` — the port requires them, so they default empty. */
const toKnowledgeEntry = (row: z.infer<typeof knowledgeEntryRowSchema>): KnowledgeEntry => ({
  key: row.key,
  title: row.title,
  content: row.content,
  contentType: row.content_type,
  variables: [],
  triggers: [],
  version: row.version,
});

const toEscalationTopic = (row: z.infer<typeof escalationTopicRowSchema>): EscalationTopic => ({
  key: row.key,
  label: row.label,
  keywords: row.keywords,
  department: row.department,
  priority: row.priority,
  fallbackTemplateKey: row.fallback_template_key,
});

const toCatalogVariant = (
  product: Pick<MotorcycleRow, 'id' | 'name'>,
  variant: MotorcycleVariantRow,
): CatalogVariant => ({
  id: variant.id,
  productId: product.id,
  productName: product.name,
  variantName: variant.name,
  imageUrl: variant.image_url ?? null,
  cashPrice: variant.cash_price ?? null,
  minDownpayment: variant.min_downpayment ?? null,
  updatedPaymentLess: variant.updated_payment_less ?? null,
  terms: (variant.terms ?? [])
    .map((term): CatalogInstallmentTerm => ({
      termMonths: term.term_months,
      monthlyAmount: term.monthly_amount,
    }))
    .sort((a, b) => a.termMonths - b.termMonths),
});

const toCatalogProduct = (row: MotorcycleRow): CatalogProduct => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  variants: (row.variants ?? []).map((variant) => toCatalogVariant(row, variant)),
});

const toPromotion = (row: PromotionRow): Promotion => ({
  id: row.id,
  name: row.name,
  applicability: row.applicability,
  items: row.items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item): PromotionItem => ({
      body: item.body,
      sortOrder: item.sort_order,
    })),
});

export const createKnowledgeService = (options: KnowledgeServiceOptions): KnowledgeService => {
  const {
    client, cache, ttlSeconds 
  } = options;

  const fetchEnvelopeData = async <Row>(
    path: string,
    query: Record<string, DomainHttpQueryValue>,
    rowSchema: z.ZodType<Row, z.ZodTypeDef, unknown>,
  ): Promise<Row[]> => {
    const payload = await client.get(path, query);
    const parsed = z.object({
      success: z.literal(true),
      data: z.array(rowSchema),
    }).strip().safeParse(payload);
    if (!parsed.success) {
      throw new AppError(
        'DOMAIN_VALIDATION_ERROR',
        502,
        `Domain API returned an invalid response for "${path}"`,
        { issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) },
      );
    }
    return parsed.data.data;
  };

  const getEntries = async (keys: string[]): Promise<KnowledgeEntry[]> => {
    if (keys.length === 0) return [];
    const joined = [...keys].sort().join(',');
    const cacheKey = entriesKeyFor(keys);
    const cached = await cache.get<KnowledgeEntry[]>(cacheKey);
    if (cached !== null) return cached;
    const rows = await fetchEnvelopeData(
      '/knowledge-entries',
      {
        keys: joined,
        current: 1,
      },
      knowledgeEntryRowSchema,
    );
    const entries = rows.map(toKnowledgeEntry);
    await cache.withTtl(cacheKey, entries, ttlSeconds);
    return entries;
  };

  const getTemplate = async (key: string): Promise<KnowledgeEntry | null> => {
    const cacheKey = templateKeyFor(key);
    const cached = await cache.get<KnowledgeEntry>(cacheKey);
    if (cached !== null) return cached;
    const [entry] = await getEntries([key]);
    if (entry === undefined) return null;
    await cache.withTtl(cacheKey, entry, ttlSeconds);
    return entry;
  };

  const getEscalationTopics = async (): Promise<EscalationTopic[]> => {
    const cached = await cache.get<EscalationTopic[]>(ESCALATION_TOPICS_KEY).catch(() => null);
    if (cached !== null) return cached;
    try {
      const rows = await fetchEnvelopeData(
        '/escalation-topics',
        { active: 1 },
        escalationTopicRowSchema,
      );
      const topics = rows.map(toEscalationTopic);
      await cache.withTtl(ESCALATION_TOPICS_KEY, topics, ttlSeconds).catch(() => undefined);
      return topics;
    } catch (error) {
      if (!isDegradableTopicError(error)) throw error;
      return DEGRADED_ESCALATION_TOPICS;
    }
  };

  const findProducts = async (query: string): Promise<CatalogProduct[]> => {
    const normalized = query.trim().toLowerCase();
    const cacheKey = searchKeyFor(normalized);
    const cached = await cache.get<CatalogProduct[]>(cacheKey);
    if (cached !== null) return cached;
    const rows = await fetchEnvelopeData(
      '/motorcycles',
      {
        search: normalized,
        include: 'variants,terms',
        available: 1,
      },
      motorcycleRowSchema,
    );
    const products = rows.map(toCatalogProduct);
    await cache.withTtl(cacheKey, products, ttlSeconds);
    return products;
  };

  const getFreebies = async (
    applicability: Exclude<PaymentApplicability, 'all'>,
  ): Promise<Promotion | null> => {
    const cacheKey = freebiesKeyFor(applicability);
    const cached = await cache.get<Promotion>(cacheKey);
    if (cached !== null) return cached;
    const rows = await fetchEnvelopeData(
      '/promotions',
      {
        applicability,
        current: 1,
      },
      promotionRowSchema,
    );
    const [first] = rows;
    if (first === undefined) return null;
    const promotion = toPromotion(first);
    await cache.withTtl(cacheKey, promotion, ttlSeconds);
    return promotion;
  };

  return {
    getTemplate,
    getEntries,
    getEscalationTopics,
    findProducts,
    getFreebies,
  };
};
