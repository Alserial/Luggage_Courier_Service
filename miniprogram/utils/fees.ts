export type FeeBreakdown = {
  serviceFee: number;
  platformFee: number;
  total: number;
  currency: 'CNY';
};

export function calculateFeeBreakdown(serviceFee: number): FeeBreakdown {
  const normalizedServiceFee = Math.max(0, Number(serviceFee) || 0);
  const platformFee = Math.ceil(normalizedServiceFee * 0.08);
  return {
    serviceFee: normalizedServiceFee,
    platformFee,
    total: normalizedServiceFee + platformFee,
    currency: 'CNY',
  };
}

export function formatMoney(amount: number, currency = 'CNY'): string {
  return `${currency} ${amount.toFixed(2)}`;
}
