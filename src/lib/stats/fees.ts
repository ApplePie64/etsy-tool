/**
 * Etsy fee & profit calculator. Defaults are Etsy's published US rates;
 * processing fees differ by country, so every rate is editable.
 */
export interface FeeRates {
  listingFee: number;
  transactionRate: number;
  processingRate: number;
  processingFixed: number;
  /** 0 when the order didn't come from an offsite ad; 0.15 or 0.12 otherwise. */
  offsiteAdsRate: number;
  offsiteAdsCap: number;
}

export const US_FEES: FeeRates = {
  listingFee: 0.2,
  transactionRate: 0.065,
  processingRate: 0.03,
  processingFixed: 0.25,
  offsiteAdsRate: 0,
  offsiteAdsCap: 100,
};

export interface ProfitInput {
  price: number;
  shippingCharged: number;
  itemCost: number;
  shippingCost: number;
  labourMinutes: number;
  hourlyRate: number;
}

export interface ProfitResult {
  revenue: number;
  fees: { label: string; amount: number }[];
  totalFees: number;
  costs: number;
  labour: number;
  profit: number;
  /** Profit after labour, as a share of what the buyer paid. */
  margin: number;
  /** Profit before labour — the cash left from each order. */
  cashProfit: number;
  /** Ad return needed to break even on cash profit (ad revenue ÷ ad spend). */
  breakEvenRoas: number | null;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function calcProfit(input: ProfitInput, rates: FeeRates = US_FEES): ProfitResult {
  const revenue = Math.max(0, input.price) + Math.max(0, input.shippingCharged);
  const transaction = revenue * rates.transactionRate;
  const processing = revenue > 0 ? revenue * rates.processingRate + rates.processingFixed : 0;
  const offsite = Math.min(revenue * rates.offsiteAdsRate, rates.offsiteAdsCap);
  const fees = [
    { label: "Listing fee", amount: r2(rates.listingFee) },
    { label: `Transaction fee (${(rates.transactionRate * 100).toFixed(1)}%)`, amount: r2(transaction) },
    { label: `Payment processing (${(rates.processingRate * 100).toFixed(1)}% + $${rates.processingFixed.toFixed(2)})`, amount: r2(processing) },
  ];
  if (rates.offsiteAdsRate > 0) fees.push({ label: `Offsite Ads (${Math.round(rates.offsiteAdsRate * 100)}%)`, amount: r2(offsite) });
  const totalFees = fees.reduce((s, f) => s + f.amount, 0);
  const costs = Math.max(0, input.itemCost) + Math.max(0, input.shippingCost);
  const labour = (Math.max(0, input.labourMinutes) / 60) * Math.max(0, input.hourlyRate);
  const cashProfit = revenue - totalFees - costs;
  const profit = cashProfit - labour;
  const cashMargin = revenue > 0 ? cashProfit / revenue : 0;
  return {
    revenue: r2(revenue),
    fees,
    totalFees: r2(totalFees),
    costs: r2(costs),
    labour: r2(labour),
    profit: r2(profit),
    margin: revenue > 0 ? profit / revenue : 0,
    cashProfit: r2(cashProfit),
    breakEvenRoas: cashMargin > 0 ? 1 / cashMargin : null,
  };
}

/** Lowest item price (in cents) that reaches `targetMargin` after labour. */
export function priceForMargin(input: ProfitInput, targetMargin: number, rates: FeeRates = US_FEES): number | null {
  if (targetMargin >= 1 - rates.transactionRate - rates.processingRate - rates.offsiteAdsRate) return null;
  let lo = 0;
  let hi = 100000;
  const ok = (p: number) => calcProfit({ ...input, price: p }, rates).margin >= targetMargin;
  if (!ok(hi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 100) / 100;
}
