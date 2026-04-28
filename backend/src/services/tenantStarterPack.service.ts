import type { Prisma } from '@prisma/client';

export type TenantBusinessType = 'mobile_shop' | 'repair_shop' | 'trading';

const MASTER_CATEGORIES = ['Phones', 'Accessories', 'Parts', 'Tools'] as const;

type PackLine = { sku: string; name: string; category: string; quantity: number; unitCost: number };

function linesForType(type: TenantBusinessType): PackLine[] {
  if (type === 'repair_shop') {
    return [
      { sku: 'PART-SCREEN-001', name: 'Generic OLED Screen Kit', category: 'part', quantity: 0, unitCost: 0 },
      { sku: 'PART-BATT-001', name: 'Replacement Battery (Standard)', category: 'part', quantity: 0, unitCost: 0 },
      { sku: 'TOOL-SCREW-001', name: 'Precision Screwdriver Set', category: 'tool', quantity: 0, unitCost: 0 },
      { sku: 'ACC-USB-001', name: 'USB-C Cable 1m', category: 'accessory', quantity: 5, unitCost: 2 },
    ];
  }
  if (type === 'trading') {
    return [
      { sku: 'TRD-BOX-001', name: 'Shipping Box (device)', category: 'accessory', quantity: 20, unitCost: 0.5 },
      { sku: 'TRD-LBL-001', name: 'Barcode / QC label roll', category: 'accessory', quantity: 1, unitCost: 0 },
    ];
  }
  // mobile_shop (default)
  return [
    { sku: 'ACC-SCREEN-001', name: 'Tempered Glass (universal)', category: 'accessory', quantity: 10, unitCost: 1 },
    { sku: 'ACC-CASE-001', name: 'Silicone Case (generic)', category: 'accessory', quantity: 5, unitCost: 2 },
    { sku: 'ACC-USB-002', name: 'USB-C Charging Cable', category: 'accessory', quantity: 10, unitCost: 1.5 },
  ];
}

/**
 * Idempotent-ish starter data for a new tenant: global master categories + branch-scoped sample parts.
 */
export async function applyTenantStarterPack(
  tx: Prisma.TransactionClient,
  input: { companyId: string; branchId: string; businessType: TenantBusinessType }
): Promise<void> {
  for (const name of MASTER_CATEGORIES) {
    await tx.masterCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const lines = linesForType(input.businessType);
  for (const line of lines) {
    const existing = await tx.inventoryPart.findFirst({
      where: { branchId: input.branchId, sku: line.sku },
      select: { id: true },
    });
    if (existing) continue;
    await tx.inventoryPart.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        sku: line.sku,
        name: line.name,
        category: line.category,
        quantity: line.quantity,
        unitCost: line.unitCost,
        unit: 'pcs',
        isActive: true,
      },
    });
  }
}

export function parseBusinessType(raw: unknown): TenantBusinessType {
  const s = String(raw || 'mobile_shop')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'repair_shop' || s === 'repair') return 'repair_shop';
  if (s === 'trading' || s === 'trade' || s === 'wholesale') return 'trading';
  return 'mobile_shop';
}
