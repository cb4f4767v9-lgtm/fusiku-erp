import { roundUsd } from './financialUsd';

/** Profit share in USD for an equity investor; lenders always 0. */
export function profitShareUsd(
  netProfitUsd: number,
  investorType: string,
  sharePercentage: number | null | undefined
): number {
  if (String(investorType).toLowerCase() !== 'investor') return 0;
  const p = sharePercentage == null ? NaN : Number(sharePercentage);
  if (!Number.isFinite(p) || p <= 0) return 0;
  const clamped = Math.min(100, Math.max(0, p));
  return roundUsd(Number(netProfitUsd) * (clamped / 100));
}

/**
 * Investor balance in USD:
 * balanceUsd = depositsUsd - withdrawalsUsd + profitShareUsd
 */
export function investorBalanceUsd(input: {
  depositsUsd: number;
  withdrawalsUsd: number;
  profitShareUsd: number;
}): number {
  const d = Number(input.depositsUsd) || 0;
  const w = Number(input.withdrawalsUsd) || 0;
  const p = Number(input.profitShareUsd) || 0;
  return roundUsd(d - w + p);
}
