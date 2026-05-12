import { prisma } from '../../utils/prisma';

export type ResolvedBranchInstituteCurrencies = {
  operatingCurrency: string;
  feeCurrency: string;
  receiptCurrency: string;
  reportingCurrency: string;
};

/**
 * Company-level ISO fallback when a student has no branch or branch rows lack currency.
 * Uses Settings first, then the tenant's first Currency catalog row — never assumes USD in app logic.
 */
export async function resolveTenantCurrencyFallback(companyId: string): Promise<string> {
  const st = await prisma.companySettings.findFirst({
    where: { companyId },
    select: { currency: true, baseCurrency: true },
  });
  const fromSettings = (st?.currency || st?.baseCurrency || '').trim();
  if (fromSettings) return fromSettings.toUpperCase();

  const first = await prisma.currency.findFirst({
    where: { companyId },
    orderBy: { code: 'asc' },
    select: { code: true },
  });
  const code = first?.code?.trim();
  if (code) return code.toUpperCase();

  throw Object.assign(
    new Error(
      'Configure company currency in Settings (or add a currency) before issuing institute fees.'
    ),
    { statusCode: 400 }
  );
}

/**
 * Resolves the four institute-related ISO codes for a branch.
 * Cascade: fee → operating → tenant; receipt → fee; reporting → operating.
 */
export async function resolveBranchInstituteCurrencies(
  companyId: string,
  branchId: string | null | undefined
): Promise<ResolvedBranchInstituteCurrencies> {
  const tenant = await resolveTenantCurrencyFallback(companyId);

  if (!branchId) {
    return {
      operatingCurrency: tenant,
      feeCurrency: tenant,
      receiptCurrency: tenant,
      reportingCurrency: tenant,
    };
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId },
    select: {
      currency: true,
      instituteFeeCurrency: true,
      instituteReceiptCurrency: true,
      instituteReportingCurrency: true,
    },
  });

  const operating = (branch?.currency?.trim() || tenant).toUpperCase();
  const fee = (branch?.instituteFeeCurrency?.trim() || operating).toUpperCase();
  const receipt = (branch?.instituteReceiptCurrency?.trim() || fee).toUpperCase();
  const reporting = (branch?.instituteReportingCurrency?.trim() || operating).toUpperCase();

  return {
    operatingCurrency: operating,
    feeCurrency: fee,
    receiptCurrency: receipt,
    reportingCurrency: reporting,
  };
}

export async function resolveInstituteFeeCurrency(
  companyId: string,
  studentBranchId: string | null | undefined
): Promise<string> {
  const r = await resolveBranchInstituteCurrencies(companyId, studentBranchId);
  return r.feeCurrency;
}

export async function resolveInstituteReceiptCurrency(
  companyId: string,
  studentBranchId: string | null | undefined
): Promise<string> {
  const r = await resolveBranchInstituteCurrencies(companyId, studentBranchId);
  return r.receiptCurrency;
}

export async function resolveInstituteReportingCurrency(
  companyId: string,
  studentBranchId: string | null | undefined
): Promise<string> {
  const r = await resolveBranchInstituteCurrencies(companyId, studentBranchId);
  return r.reportingCurrency;
}
