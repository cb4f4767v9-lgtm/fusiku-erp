import type { InstituteBatchRow } from '../services/api';
import { instituteDec } from './instituteMoney';

/** Batch tuition before discounts: `feeOverride` else course `defaultFee`. */
export function resolveBatchBaseFee(b: InstituteBatchRow): number {
  if (b.feeOverride != null && String(b.feeOverride).trim() !== '') {
    return instituteDec(b.feeOverride);
  }
  const df = b.course?.defaultFee;
  if (df != null && String(df).trim() !== '') {
    return instituteDec(df);
  }
  return 0;
}

/**
 * Fixed discount overrides percentage. Values are strings from inputs.
 * Returns non-negative payable amount rounded to cents for display; enrollment uses same numeric value.
 */
export function computeTuitionPayable(base: number, discountPercentStr: string, discountFixedStr: string): number {
  const fixedRaw = discountFixedStr.trim().replace(/,/g, '');
  const fixed = Number.parseFloat(fixedRaw);
  if (!Number.isNaN(fixed) && fixed > 0) {
    return Math.max(0, Math.round((base - fixed) * 100) / 100);
  }
  const pctRaw = discountPercentStr.trim().replace(/,/g, '');
  const pct = Number.parseFloat(pctRaw);
  if (!Number.isNaN(pct) && pct > 0) {
    const clamped = Math.min(pct, 100);
    return Math.max(0, Math.round(base * (1 - clamped / 100) * 100) / 100);
  }
  return Math.max(0, Math.round(base * 100) / 100);
}
