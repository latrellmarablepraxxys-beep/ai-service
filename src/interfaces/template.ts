export interface InstallmentTermLine {
  termMonths: number;
  monthlyAmount: number;
}

export interface InstallmentBlockInput {
  productName: string;
  variantName: string;
  minDownpayment: number;
  terms: InstallmentTermLine[];
  updatedPaymentLess: number | null;
  freebiesQuestion?: string | undefined;
}

export interface CashBlockInput {
  productName: string;
  variantName: string;
  cashPrice: number;
  freebiesQuestion?: string | undefined;
}
