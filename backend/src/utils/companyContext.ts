/**
 * Company context helper - use companyId from request to scope queries.
 * When companyId is present, filter by it. When null (legacy/system admin), no filter.
 */
export function companyWhere(companyId?: string | null): Record<string, string> | undefined {
  if (!companyId) return undefined;
  return { companyId };
}

export function companyWhereOr(companyId?: string | null): Record<string, unknown> | undefined {
  if (!companyId) return undefined;
  return { OR: [{ companyId }, { companyId: null }] };
}
