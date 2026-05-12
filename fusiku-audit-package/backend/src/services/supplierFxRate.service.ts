import { prisma } from '../utils/prisma';

function normalize(code: unknown) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const supplierFxRateService = {
  async listForSupplier(companyId: string, supplierId: string) {
    const sid = String(supplierId || '').trim();
    if (!sid) throw new Error('Invalid supplierId');
    return (prisma as any).supplierFxRate.findMany({
      where: { companyId, supplierId: sid },
      orderBy: [{ currencyCode: 'asc' }, { effectiveAt: 'desc' }],
    });
  },

  async upsert(companyId: string, supplierId: string, currencyCode: string, rate: number) {
    const sid = String(supplierId || '').trim();
    const code = normalize(currencyCode);
    const r = safeNum(rate);
    if (!sid) throw new Error('Invalid supplierId');
    if (!code) throw new Error('Invalid currencyCode');
    if (!(r > 0)) throw new Error('Rate must be a positive number (units per 1 USD)');

    // Ensure supplier belongs to this tenant
    const supplier = await prisma.supplier.findFirst({ where: { id: sid, companyId }, select: { id: true } });
    if (!supplier) throw new Error('Supplier not found');

    return (prisma as any).supplierFxRate.upsert({
      where: { supplierId_currencyCode: { supplierId: sid, currencyCode: code } },
      update: { rate: r, companyId, effectiveAt: new Date() },
      create: { companyId, supplierId: sid, currencyCode: code, rate: r, effectiveAt: new Date() },
    });
  },

  async remove(companyId: string, supplierId: string, currencyCode: string) {
    const sid = String(supplierId || '').trim();
    const code = normalize(currencyCode);
    if (!sid) throw new Error('Invalid supplierId');
    if (!code) throw new Error('Invalid currencyCode');

    // Tenant safety: only delete if it belongs to companyId
    const row = await (prisma as any).supplierFxRate.findFirst({
      where: { companyId, supplierId: sid, currencyCode: code },
      select: { supplierId: true, currencyCode: true },
    });
    if (!row) return { ok: true };

    await (prisma as any).supplierFxRate.delete({
      where: { supplierId_currencyCode: { supplierId: sid, currencyCode: code } },
    });
    return { ok: true };
  },
};

