import type { EscalationTopic } from '../../interfaces/knowledge.js';

export const DEGRADED_SEED_VERSION = 1;

const FALLBACK_TEMPLATE_KEY = 'fallback.escalation';

const seed: EscalationTopic[] = [
  {
    key: 'BIG_DOWNPAYMENT',
    label: 'Big Downpayment Computation',
    keywords: [
      'big downpayment',
      'downpayment',
      'down payment',
      'downpayment computation',
      'big dp',
      'malaking downpayment'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'CREDIT_CARD',
    label: 'Credit Card Computation',
    keywords: [
      'credit card',
      'creditcard',
      'card payment',
      'cc payment',
      'credit card computation'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'PAYMENT_711',
    label: '711 Payment',
    keywords: [
      '711',
      '7-11',
      '7 eleven',
      'seven eleven',
      '711 payment',
      'cliqq'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'GCASH_PAYMENT',
    label: 'GCash Payment',
    keywords: [
      'gcash',
      'g-cash',
      'gcash payment',
      'e-wallet',
      'wallet payment'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'GGIVES',
    label: 'GGives',
    keywords: [
      'ggives',
      'gives',
      'ggives installment',
      'gcash gives'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'MONTHLY_PAYMENT',
    label: 'Monthly Payment Computation',
    keywords: [
      'monthly payment',
      'monthly',
      'monthly amortization',
      'amortization',
      'monthly computation',
      'hulugan',
      'hulog',
      'buwanang bayad'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'DISCOUNT',
    label: 'Discount',
    keywords: [
      'discount',
      'discounted',
      'less',
      'bawas',
      'promo discount',
      'rebate'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'BAYAD_ONLINE',
    label: 'Online Payment (Bayad Online)',
    keywords: [
      'bayad online',
      'bayad sa online',
      'online payment',
      'online bayad',
      'internet payment'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'ORCR',
    label: 'OR/CR',
    keywords: [
      'orcr',
      'or/cr',
      'or cr',
      'official receipt',
      'certificate of registration',
      'rehistro',
      'rehistrado',
      'registration'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'PLATE',
    label: 'Plate',
    keywords: [
      'plate',
      'plaka',
      'license plate',
      'plate number',
      'temporary plate'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'ACCIDENT',
    label: 'Accident',
    keywords: [
      'accident',
      'aksidente',
      'crash',
      'bangga',
      'nasira',
      'damage claim'
    ],
    department: 'SERVICE',
    priority: 'HIGH',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
  {
    key: 'ORCR_PLATE_DOCUMENTS',
    label: 'ORCR / Plate / Documents',
    keywords: [
      'orcr plate documents',
      'documents',
      'papers',
      'papeles',
      'release papers',
      'release documents'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallbackTemplateKey: FALLBACK_TEMPLATE_KEY,
  },
];

for (const topic of seed) {
  Object.freeze(topic.keywords);
  Object.freeze(topic);
}

/** Frozen fallback so the escalation guard never goes blind when the admin API is down. */
export const DEGRADED_ESCALATION_TOPICS: EscalationTopic[] = Object.freeze(seed) as EscalationTopic[];
