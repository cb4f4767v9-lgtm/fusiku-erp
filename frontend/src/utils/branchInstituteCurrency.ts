/** Matches branch payloads from `/branches` (institute overrides optional). */
export type BranchInstituteCurrencyShape = {
  currency?: string | null;
  instituteFeeCurrency?: string | null;
  instituteReceiptCurrency?: string | null;
  instituteReportingCurrency?: string | null;
};

/** Display tuition / fee ISO code for this campus row (fee override → operating). */
export function resolveBranchInstituteFeeCurrencyDisplay(b: BranchInstituteCurrencyShape | null | undefined): string {
  const fee = b?.instituteFeeCurrency?.trim();
  if (fee) return fee.toUpperCase();
  const op = b?.currency?.trim();
  if (op) return op.toUpperCase();
  return '';
}
