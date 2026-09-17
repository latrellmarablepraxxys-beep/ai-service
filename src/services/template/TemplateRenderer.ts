import type {
  CashBlockInput,
  InstallmentBlockInput,
} from '../../interfaces/template.js';
import { AppError } from '../../utils/errors.js';

const DEFAULT_FREEBIES_QUESTION = 'Gusto niyo po bang malaman ang mga kasamang freebies?';

const TOKEN_PATTERN = /\{\{([A-Za-z0-9_]+)\}\}/g;

const MONTHS_PER_YEAR = 12;

export const renderTemplate = (
  content: string,
  variables: Record<string, string>,
): string => {
  const rendered = content.replace(
    TOKEN_PATTERN,
    (match, name: string): string => variables[name] ?? match,
  );
  const missing: string[] = [];
  for (const match of rendered.matchAll(TOKEN_PATTERN)) {
    const name = match[1];
    if (name !== undefined && !missing.includes(name)) missing.push(name);
  }
  if (missing.length > 0) {
    throw new AppError(
      'TEMPLATE_RENDER_ERROR',
      502,
      `Missing template variables: ${missing.join(', ')}`,
    );
  }
  return rendered;
};

export const formatPeso = (amount: number): string => {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError('TEMPLATE_RENDER_ERROR', 502, `Invalid peso amount: ${amount}`);
  }
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
};

const toYearLabel = (termMonths: number): string => {
  const years = termMonths / MONTHS_PER_YEAR;
  return `${years} ${years === 1 ? 'Year' : 'Years'}`;
};

export const renderInstallmentBlock = (input: InstallmentBlockInput): string => {
  if (input.terms.length === 0) {
    throw new AppError('TEMPLATE_RENDER_ERROR', 502, 'Cannot quote installments without terms');
  }
  const lines = [...input.terms]
    .sort((left, right) => left.termMonths - right.termMonths)
    .map(
      (term) => `✅ ${toYearLabel(term.termMonths)}: ${formatPeso(term.monthlyAmount)} per month`,
    );
  const header = [
    `🏍 ${input.productName} ${input.variantName}`,
    `💵 Minimum Downpayment: ${formatPeso(input.minDownpayment)}`,
    '📅 Installment Terms:',
    ...lines,
  ];
  if (input.updatedPaymentLess !== null) {
    header.push(`🎁 Less ${formatPeso(input.updatedPaymentLess)} monthly for updated payment.`);
  }
  header.push(input.freebiesQuestion ?? DEFAULT_FREEBIES_QUESTION);
  return header.join('\n');
};

export const renderCashBlock = (input: CashBlockInput): string =>
  [
    `🏍 ${input.productName} ${input.variantName}`,
    `💰 Cash Price: ${formatPeso(input.cashPrice)}`,
    input.freebiesQuestion ?? DEFAULT_FREEBIES_QUESTION,
  ].join('\n');

export const renderFreebiesList = (items: string[]): string => {
  if (items.length === 0) {
    throw new AppError('TEMPLATE_RENDER_ERROR', 502, 'Cannot render an empty freebies list');
  }
  return items.join('\n');
};

export const spliceTemplate = (
  message: string,
  block: string,
  marker = '{{template}}',
): string => {
  if (!message.includes(marker)) return `${message}\n\n${block}`;
  return message.replace(marker, block);
};
