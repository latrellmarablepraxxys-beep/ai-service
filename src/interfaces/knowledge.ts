import type { KnowledgeContentType } from '../enums/KnowledgeContentType.js';
import type { CacheClient } from './cache.js';
import type { EscalationPriority } from './decision.js';
import type { DomainHttpClient } from './domain.js';

export type PaymentApplicability = 'cash' | 'installment' | 'bajaj' | 'all';

export interface KnowledgeEntry {
  key: string;
  title: string;
  content: string;
  contentType: KnowledgeContentType;
  variables: string[];
  triggers: string[];
  version: number;
}

export interface EscalationTopic {
  key: string;
  label: string;
  keywords: string[];
  department: string;
  priority: EscalationPriority;
  fallbackTemplateKey: string;
}

export interface CatalogInstallmentTerm {
  termMonths: number;
  monthlyAmount: number;
}

export interface CatalogVariant {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  cashPrice: number | null;
  minDownpayment: number | null;
  updatedPaymentLess: number | null;
  terms: CatalogInstallmentTerm[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  variants: CatalogVariant[];
}

export interface PromotionItem {
  body: string;
  sortOrder: number;
}

export interface Promotion {
  id: string;
  name: string;
  applicability: PaymentApplicability;
  items: PromotionItem[];
}

export interface KnowledgeService {
  getTemplate(key: string): Promise<KnowledgeEntry | null>;
  getEntries(keys: string[]): Promise<KnowledgeEntry[]>;
  getEscalationTopics(): Promise<EscalationTopic[]>;
  findProducts(query: string): Promise<CatalogProduct[]>;
  getFreebies(applicability: Exclude<PaymentApplicability, 'all'>): Promise<Promotion | null>;
}

export interface KnowledgeServiceOptions {
  client: DomainHttpClient;
  cache: CacheClient;
  ttlSeconds: number;
}
