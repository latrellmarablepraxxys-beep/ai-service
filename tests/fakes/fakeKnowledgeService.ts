import { KnowledgeContentType } from '@enums/KnowledgeContentType.js';
import type {
  CatalogProduct,
  EscalationTopic,
  KnowledgeEntry,
  KnowledgeService,
  PaymentApplicability,
  Promotion,
} from '@interfaces/knowledge.js';

export interface FakeKnowledgeServiceOptions {
  templates?: KnowledgeEntry[];
  topics?: EscalationTopic[];
  products?: CatalogProduct[];
  promotions?: Promotion[];
}

const DEFAULT_TEMPLATES: KnowledgeEntry[] = [
  {
    key: 'greeting.initial',
    title: 'Initial greeting',
    content: 'Kamusta po! Welcome to MotorCentral. How may I help you today?',
    contentType: KnowledgeContentType.Template,
    variables: [],
    triggers: [
      'hi',
      'hello',
      'kamusta'
    ],
    version: 1,
  }
];

const DEFAULT_TOPICS: EscalationTopic[] = [
  {
    key: 'ORCR',
    label: 'OR/CR',
    keywords: [
      'orcr',
      'or/cr',
      'rehistro'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallbackTemplateKey: 'fallback.escalation',
  },
  {
    key: 'MONTHLY_PAYMENT',
    label: 'Monthly Payment Computation',
    keywords: [
      'monthly payment',
      'monthly',
      'hulugan'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: 'fallback.escalation',
  }
];

const DEFAULT_PRODUCTS: CatalogProduct[] = [
  {
    id: '1',
    name: 'Honda Click 125',
    brand: 'Honda',
    variants: [
      {
        id: 'variant-std',
        productId: '1',
        productName: 'Honda Click 125',
        variantName: 'V4 STD',
        imageUrl: null,
        cashPrice: 84850,
        minDownpayment: 6700,
        updatedPaymentLess: 200,
        terms: [
          {
            termMonths: 12,
            monthlyAmount: 9105,
          },
          {
            termMonths: 24,
            monthlyAmount: 5395,
          },
          {
            termMonths: 36,
            monthlyAmount: 4250,
          }
        ],
      },
      {
        id: 'variant-se',
        productId: '1',
        productName: 'Honda Click 125',
        variantName: 'V4 SE',
        imageUrl: null,
        cashPrice: null,
        minDownpayment: null,
        updatedPaymentLess: null,
        terms: [],
      }
    ],
  }
];

const DEFAULT_PROMOTIONS: Promotion[] = [
  {
    id: 'promotion-installment',
    name: 'Installment Freebies',
    applicability: 'installment',
    items: [
      {
        body: 'Free Motorcentral Half Face Helmet.',
        sortOrder: 1,
      },
      {
        body: 'Free Kaibigan Service Plus Worth 40,000 (Para sa Damage ng Inyong Motor).',
        sortOrder: 2,
      }
    ],
  }
];

/**
 * Deterministic in-memory KnowledgeService for unit/E2E tests. Never touches
 * the network: canned templates, topics, catalog products, and promotions
 * with per-concern overrides.
 */
export class FakeKnowledgeService implements KnowledgeService {
  private readonly templates: KnowledgeEntry[];
  private readonly topics: EscalationTopic[];
  private readonly products: CatalogProduct[];
  private readonly promotions: Promotion[];

  constructor(options: FakeKnowledgeServiceOptions = {}) {
    this.templates = options.templates ?? DEFAULT_TEMPLATES;
    this.topics = options.topics ?? DEFAULT_TOPICS;
    this.products = options.products ?? DEFAULT_PRODUCTS;
    this.promotions = options.promotions ?? DEFAULT_PROMOTIONS;
  }

  getTemplate(key: string): Promise<KnowledgeEntry | null> {
    return Promise.resolve(this.templates.find((template) => template.key === key) ?? null);
  }

  getEntries(keys: string[]): Promise<KnowledgeEntry[]> {
    return Promise.resolve(this.templates.filter((template) => keys.includes(template.key)));
  }

  getEscalationTopics(): Promise<EscalationTopic[]> {
    return Promise.resolve(this.topics);
  }

  findProducts(query: string): Promise<CatalogProduct[]> {
    const normalized = query.trim().toLowerCase();
    if (normalized === '') return Promise.resolve(this.products);
    return Promise.resolve(
      this.products.filter((product) => product.name.toLowerCase().includes(normalized)),
    );
  }

  getFreebies(applicability: Exclude<PaymentApplicability, 'all'>): Promise<Promotion | null> {
    const exact = this.promotions.find((promotion) => promotion.applicability === applicability);
    if (exact !== undefined) return Promise.resolve(exact);
    return Promise.resolve(this.promotions.find((promotion) => promotion.applicability === 'all') ?? null);
  }
}
