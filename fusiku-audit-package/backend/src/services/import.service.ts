import * as XLSX from 'xlsx';
import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const importService = {
  async importInventory(file: Buffer, branchId: string) {
    const companyId = requireTenantCompanyId();
    const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId } });
    if (!branch) throw new Error('Branch not found');

    const workbook = XLSX.read(file, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any>(sheet);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const imei = String(row.imei || row.IMEI || '').trim();
        if (!imei) continue;

        const exists = await prisma.inventory.findFirst({ where: { imei, companyId } });
        if (exists) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: IMEI ${imei} already exists`);
          continue;
        }

        const purchasePrice = Number(row.purchase_price || row.purchasePrice || 0);
        await prisma.inventory.create({
          data: {
            companyId,
            imei,
            brand: String(row.brand || row.Brand || 'Unknown'),
            model: String(row.model || row.Model || 'Unknown'),
            storage: String(row.storage || row.Storage || ''),
            color: String(row.color || row.Color || ''),
            condition: String(row.condition || row.Condition || 'used'),
            purchasePrice,
            originalCost: purchasePrice,
            originalCurrency: 'USD',
            costUsd: purchasePrice,
            purchaseCurrency: 'USD',
            exchangeRateAtPurchase: 1,
            isLegacyCost: false,
            sellingPrice: Number(row.selling_price || row.sellingPrice || 0),
            branchId,
            status: 'available'
          } as any
        });
        results.success++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    return results;
  },

  async importSuppliers(file: Buffer) {
    const companyId = requireTenantCompanyId();
    const workbook = XLSX.read(file, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any>(sheet);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const name = String(row.name || row.Name || '').trim();
        if (!name) continue;

        const country = String(row.country || row.Country || 'US').trim() || 'US';
        const supplier = await prisma.supplier.create({
          data: {
            companyId,
            name,
            country,
            province: String(row.province || row.Province || '') || undefined,
            city: String(row.city || row.City || '') || undefined,
            address: String(row.address || row.Address || '') || undefined,
            contact: String(row.contact || row.Contact || '') || undefined,
            email: String(row.email || row.Email || '') || undefined,
            phone: String(row.phone || row.Phone || '') || undefined
          }
        });

        const contacts: { contactType: string; value: string }[] = [];
        const phone = String(row.phone || row.Phone || '').trim();
        if (phone) contacts.push({ contactType: 'phone', value: phone });
        const email = String(row.email || row.Email || '').trim();
        if (email) contacts.push({ contactType: 'email', value: email });
        if (contacts.length) {
          await prisma.supplierContact.createMany({
            data: contacts.map((c) => ({ supplierId: supplier.id, ...c }))
          });
        }
        results.success++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    return results;
  },

  async importPurchases(file: Buffer, branchId: string, supplierId: string) {
    const companyId = requireTenantCompanyId();
    const [branch, supplier] = await Promise.all([
      prisma.branch.findFirst({ where: { id: branchId, companyId } }),
      prisma.supplier.findFirst({ where: { id: supplierId, companyId } })
    ]);
    if (!branch) throw new Error('Branch not found');
    if (!supplier) throw new Error('Supplier not found');

    const workbook = XLSX.read(file, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any>(sheet);

    const items = data.map((row: any) => ({
      imei: String(row.imei || row.IMEI || '').trim(),
      brand: String(row.brand || row.Brand || 'Unknown'),
      model: String(row.model || row.Model || 'Unknown'),
      storage: String(row.storage || row.Storage || ''),
      color: String(row.color || row.Color || ''),
      condition: String(row.condition || row.Condition || 'used'),
      price: Number(row.price || row.Price || 0)
    })).filter(i => i.imei);

    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

    const purchase = await prisma.purchase.create({
      data: {
        companyId,
        supplierId,
        branchId,
        totalAmount,
        // Backward-compatible FX audit fields (import assumed USD unless specified elsewhere)
        purchaseCurrency: 'USD',
        exchangeRateAtPurchase: 1,
        status: 'completed',
        purchaseItems: {
          create: items.map(i => ({
            ...i,
            price: i.price,
            quantity: 1
          }))
        }
      } as any,
      include: { purchaseItems: true }
    });

    for (const item of items) {
      await prisma.inventory.create({
        data: {
          companyId,
          imei: item.imei,
          brand: item.brand,
          model: item.model,
          storage: item.storage,
          color: item.color,
          condition: item.condition,
          purchasePrice: item.price,
          originalCost: item.price,
          originalCurrency: 'USD',
          costUsd: item.price,
          purchaseCurrency: 'USD',
          exchangeRateAtPurchase: 1,
          isLegacyCost: false,
          sellingPrice: item.price * 1.2,
          branchId,
          status: 'available'
        } as any
      });
    }

    return { success: items.length, purchase };
  }
};
