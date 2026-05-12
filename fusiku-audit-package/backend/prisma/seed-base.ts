/**
 * FUSIKU ERP - Base Seed (default)
 * Creates: roles, permissions, device grades, phone brands/models, subscription plans
 * Does NOT create: company, admin user (use setup wizard or seed:demo)
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const PHONE_MODELS = [
  { brand: 'Apple', model: 'iPhone 15 Pro Max', storages: ['256GB', '512GB', '1TB'], colors: ['Natural Titanium', 'Blue Titanium'] },
  { brand: 'Apple', model: 'iPhone 15', storages: ['128GB', '256GB'], colors: ['Black', 'Blue', 'Green'] },
  { brand: 'Samsung', model: 'Galaxy S24 Ultra', storages: ['256GB', '512GB'], colors: ['Titanium Gray', 'Titanium Black'] },
  { brand: 'Samsung', model: 'Galaxy A54', storages: ['128GB', '256GB'], colors: ['Awesome Violet', 'Awesome Graphite'] },
  { brand: 'Xiaomi', model: '14', storages: ['256GB', '512GB'], colors: ['Black', 'White'] },
];

const PERMISSIONS = [
  { code: 'create_inventory', name: 'Create Inventory' },
  { code: 'edit_inventory', name: 'Edit Inventory' },
  { code: 'delete_inventory', name: 'Delete Inventory' },
  { code: 'view_inventory', name: 'View Inventory' },
  { code: 'create_purchase', name: 'Create Purchase' },
  { code: 'approve_purchase', name: 'Approve Purchase' },
  { code: 'process_sale', name: 'Process Sale' },
  { code: 'view_reports', name: 'View Reports' },
  { code: 'manage_users', name: 'Manage Users' },
  { code: 'dashboard.view', name: 'View dashboard' },
  { code: 'sales.pos', name: 'Use POS' },
  { code: 'purchases.view', name: 'View purchases' },
  { code: 'purchases.create', name: 'Create purchases' },
  { code: 'suppliers.view', name: 'View suppliers' },
  { code: 'suppliers.create', name: 'Create or edit suppliers' },
  { code: 'inventory.view', name: 'View inventory' },
  { code: 'inventory.create', name: 'Create or adjust inventory' },
  { code: 'inventory.transfers', name: 'Stock transfers' },
  { code: 'inventory.history', name: 'Inventory history' },
  { code: 'operations.repairs', name: 'Repairs' },
  { code: 'operations.refurbish', name: 'Refurbishing' },
  { code: 'operations.phoneDatabase', name: 'Phone database' },
  { code: 'ai.bi', name: 'AI business intelligence' },
  { code: 'ai.assistant', name: 'AI assistant' },
  { code: 'finance.expenses', name: 'Expenses' },
  { code: 'reports.view', name: 'Reports' },
  { code: 'finance.currency', name: 'Currency & FX' },
  { code: 'admin.customers', name: 'Customers' },
  { code: 'branches.manage', name: 'Manage branches' },
  { code: 'masterData.manage', name: 'Master data' },
  { code: 'users.manage', name: 'Users & roles' },
  { code: 'settings.company', name: 'Company settings' },
  { code: 'settings.app', name: 'App settings' },
  { code: 'monitoring.view', name: 'Monitoring' },
  { code: 'logs.activity', name: 'Activity log' },
  { code: 'logs.system', name: 'System logs' },
];

const DEVICE_GRADES = [
  { code: 'A+', name: 'Grade A+', description: 'Like new' },
  { code: 'A', name: 'Grade A', description: 'Excellent' },
  { code: 'B', name: 'Grade B', description: 'Good' },
  { code: 'C', name: 'Grade C', description: 'Fair' },
  { code: 'D', name: 'Grade D', description: 'Poor' }
];

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  for (const g of DEVICE_GRADES) {
    await prisma.deviceGrade.upsert({ where: { code: g.code }, update: {}, create: g });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administrator' }
  });
  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: { name: 'manager', description: 'Branch Manager' }
  });
  const staffRole = await prisma.role.upsert({
    where: { name: 'staff' },
    update: {},
    create: { name: 'staff', description: 'Staff' }
  });
  await prisma.role.upsert({
    where: { name: 'SystemAdmin' },
    update: {},
    create: { name: 'SystemAdmin', description: 'System-level administrator (legacy alias)' }
  });
  await prisma.role.upsert({
    where: { name: 'SYSTEM_ADMIN' },
    update: {},
    create: { name: 'SYSTEM_ADMIN', description: 'Platform super administrator — full cross-tenant access' }
  });

  const permissions = await prisma.permission.findMany();
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id }
    });
  }

  const managerDeny = new Set(['logs.system', 'users.manage']);
  for (const perm of permissions) {
    if (managerDeny.has(perm.code)) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: managerRole.id, permissionId: perm.id },
    });
  }

  const staffAllow = new Set([
    'dashboard.view',
    'sales.pos',
    'purchases.view',
    'purchases.create',
    'create_purchase',
    'suppliers.view',
    'suppliers.create',
    'inventory.view',
    'inventory.create',
    'view_inventory',
    'create_inventory',
    'edit_inventory',
    'inventory.transfers',
    'inventory.history',
    'operations.repairs',
    'operations.refurbish',
    'operations.phoneDatabase',
    'finance.expenses',
    'reports.view',
    'view_reports',
    'finance.currency',
    'ai.bi',
    'ai.assistant',
  ]);
  for (const perm of permissions) {
    if (!staffAllow.has(perm.code)) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: staffRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: staffRole.id, permissionId: perm.id },
    });
  }

  for (const { brand, model, storages, colors } of PHONE_MODELS) {
    let phoneBrand = await prisma.phoneBrand.findUnique({ where: { name: brand } });
    if (!phoneBrand) phoneBrand = await prisma.phoneBrand.create({ data: { name: brand } });

    let phoneModel = await prisma.phoneModel.findFirst({ where: { brandId: phoneBrand.id, name: model } });
    if (!phoneModel) phoneModel = await prisma.phoneModel.create({ data: { brandId: phoneBrand.id, name: model } });

    for (const storage of storages) {
      for (const color of colors) {
        const exists = await prisma.phoneVariant.findFirst({ where: { modelId: phoneModel.id, storage, color } });
        if (!exists) {
          await prisma.phoneVariant.create({ data: { modelId: phoneModel.id, storage, color } });
        }
      }
    }
  }

  const freeFeatures = { multiCurrency: true, aiInsights: true, forexTrading: true, removeBranding: true };
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Free' },
    update: {
      priceMonthly: 0,
      maxUsers: 500,
      maxBranches: 200,
      features: freeFeatures,
      active: true,
      pricingModel: 'unlimited',
      limitsUnlimited: true,
    },
    create: {
      name: 'Free',
      priceMonthly: 0,
      maxUsers: 500,
      maxBranches: 200,
      features: freeFeatures,
      active: true,
      pricingModel: 'unlimited',
      limitsUnlimited: true,
    },
  });

  await prisma.exchangeRate.create({
    data: { currency: 'USD', rate: 1, effectiveFrom: new Date(), effectiveTo: null }
  }).catch(() => {});

  console.log('Base seed completed. Run setup wizard at /setup or npm run seed:demo for demo data.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
