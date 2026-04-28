import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const PHONE_MODELS = [
  // Apple
  { brand: 'Apple', model: 'iPhone 15 Pro Max', storages: ['256GB', '512GB', '1TB'], colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'] },
  { brand: 'Apple', model: 'iPhone 15 Pro', storages: ['128GB', '256GB', '512GB'], colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'] },
  { brand: 'Apple', model: 'iPhone 15', storages: ['128GB', '256GB', '512GB'], colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'] },
  { brand: 'Apple', model: 'iPhone 14 Pro Max', storages: ['128GB', '256GB', '512GB', '1TB'], colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'] },
  { brand: 'Apple', model: 'iPhone 14', storages: ['128GB', '256GB', '512GB'], colors: ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'] },
  { brand: 'Apple', model: 'iPhone 13', storages: ['128GB', '256GB', '512GB'], colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red', 'Green'] },
  // Samsung
  { brand: 'Samsung', model: 'Galaxy S24 Ultra', storages: ['256GB', '512GB', '1TB'], colors: ['Titanium Gray', 'Titanium Black', 'Titanium Violet', 'Titanium Yellow'] },
  { brand: 'Samsung', model: 'Galaxy S24+', storages: ['256GB', '512GB'], colors: ['Onyx Black', 'Marble Gray', 'Cobalt Violet', 'Amber Yellow'] },
  { brand: 'Samsung', model: 'Galaxy S24', storages: ['128GB', '256GB'], colors: ['Onyx Black', 'Marble Gray', 'Cobalt Violet', 'Amber Yellow'] },
  { brand: 'Samsung', model: 'Galaxy A54', storages: ['128GB', '256GB'], colors: ['Awesome Violet', 'Awesome Graphite', 'Awesome Lime'] },
  { brand: 'Samsung', model: 'Galaxy Z Fold 5', storages: ['256GB', '512GB', '1TB'], colors: ['Icy Blue', 'Phantom Black', 'Cream'] },
  // Xiaomi
  { brand: 'Xiaomi', model: '14 Ultra', storages: ['256GB', '512GB'], colors: ['Black', 'White', 'Dragon Crystal'] },
  { brand: 'Xiaomi', model: '14', storages: ['256GB', '512GB'], colors: ['Black', 'White', 'Jade Green'] },
  { brand: 'Xiaomi', model: '13T Pro', storages: ['256GB', '512GB'], colors: ['Meadow Green', 'Alpine Blue', 'Black'] },
  { brand: 'Xiaomi', model: 'Redmi Note 13 Pro', storages: ['128GB', '256GB'], colors: ['Midnight Black', 'Aurora Purple', 'Ocean Blue'] },
  // Redmi
  { brand: 'Redmi', model: 'Note 13 Pro+', storages: ['256GB', '512GB'], colors: ['Midnight Black', 'Aurora Purple', 'Ocean Blue'] },
  { brand: 'Redmi', model: 'Note 12 Pro', storages: ['128GB', '256GB'], colors: ['Onyx Gray', 'Polar White', 'Star Blue'] },
  { brand: 'Redmi', model: '13C', storages: ['64GB', '128GB'], colors: ['Midnight Black', 'Navy Blue', 'Clover Green'] },
  // Realme
  { brand: 'Realme', model: 'GT 5 Pro', storages: ['256GB', '512GB'], colors: ['Aurora', 'Starry Night'] },
  { brand: 'Realme', model: '12 Pro+', storages: ['256GB', '512GB'], colors: ['Submarine Blue', 'Navigator Beige'] },
  { brand: 'Realme', model: 'C67', storages: ['128GB', '256GB'], colors: ['Dark Green', 'Dark Purple'] },
  // OnePlus
  { brand: 'OnePlus', model: '12', storages: ['256GB', '512GB'], colors: ['Silky Black', 'Flowy Emerald'] },
  { brand: 'OnePlus', model: 'Open', storages: ['256GB', '512GB'], colors: ['Emerald Dusk', 'Voyager Black'] },
  { brand: 'OnePlus', model: 'Nord 3', storages: ['128GB', '256GB'], colors: ['Misty Green', 'Tempest Gray'] }
];

const PERMISSIONS = [
  // Legacy codes (kept for backward compatibility with older roles / integrations)
  { code: 'create_inventory', name: 'Create Inventory' },
  { code: 'edit_inventory', name: 'Edit Inventory' },
  { code: 'delete_inventory', name: 'Delete Inventory' },
  { code: 'view_inventory', name: 'View Inventory' },
  { code: 'create_purchase', name: 'Create Purchase' },
  { code: 'approve_purchase', name: 'Approve Purchase' },
  { code: 'process_sale', name: 'Process Sale' },
  { code: 'view_reports', name: 'View Reports' },
  { code: 'manage_users', name: 'Manage Users' },
  { code: 'manage_currency', name: 'Manage Currency (Head Office)' },
  { code: 'manage_investors', name: 'Manage Investors & Capital' },
  // Canonical module keys (UI + middleware)
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
  // Create permissions
  const permissions: { id: string; code: string }[] = [];
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p
    });
    permissions.push(perm);
  }

  // Create device grades
  for (const g of DEVICE_GRADES) {
    await prisma.deviceGrade.upsert({
      where: { code: g.code },
      update: {},
      create: g
    });
  }

  // Create roles
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
  const systemAdminRole = await prisma.role.upsert({
    where: { name: 'SystemAdmin' },
    update: {},
    create: { name: 'SystemAdmin', description: 'System-level administrator' }
  });

  // Assign all permissions to admin
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id }
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id }
    });
  }

  const managerCodes = new Set(
    permissions.map((p) => p.code).filter((c) => !['logs.system', 'users.manage'].includes(c))
  );
  for (const perm of permissions) {
    if (!managerCodes.has(perm.code)) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: managerRole.id, permissionId: perm.id },
    });
  }

  const staffCodes = new Set([
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
    if (!staffCodes.has(perm.code)) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: staffRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: staffRole.id, permissionId: perm.id },
    });
  }

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: systemAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: systemAdminRole.id, permissionId: perm.id },
    });
  }

  // Phase 8: Default seed creates base data only. Use /setup wizard or npm run seed:demo for company/admin.
  // Create phone database (PhoneBrand, PhoneModel, PhoneVariant)
  const brandMap: Record<string, string> = {};
  for (const { brand, model, storages, colors } of PHONE_MODELS) {
    let phoneBrand = await prisma.phoneBrand.findUnique({ where: { name: brand } });
    if (!phoneBrand) {
      phoneBrand = await prisma.phoneBrand.create({ data: { name: brand } });
    }
    brandMap[brand] = phoneBrand.id;

    let phoneModel = await prisma.phoneModel.findFirst({
      where: { brandId: phoneBrand.id, name: model }
    });
    if (!phoneModel) {
      phoneModel = await prisma.phoneModel.create({
        data: { brandId: phoneBrand.id, name: model }
      });
    }

    for (const storage of storages) {
      for (const color of colors) {
        const exists = await prisma.phoneVariant.findFirst({
          where: { modelId: phoneModel.id, storage, color }
        });
        if (!exists) {
          await prisma.phoneVariant.create({
            data: { modelId: phoneModel.id, storage, color }
          });
        }
      }
    }
  }

  const freeFeatures = {
    multiCurrency: true,
    aiInsights: true,
    forexTrading: true,
    removeBranding: true,
  };
  const starterFeatures = {
    multiCurrency: true,
    aiInsights: false,
    forexTrading: false,
    removeBranding: false,
  };
  const businessFeatures = {
    multiCurrency: true,
    aiInsights: true,
    forexTrading: true,
    removeBranding: false,
  };
  const enterpriseFeatures = {
    multiCurrency: true,
    aiInsights: true,
    forexTrading: true,
    removeBranding: true,
  };

  // SaaS Phase 4 — catalog + internal unlimited tier for setup / legacy tenants
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
      pricePerBranchMonthly: null,
      modulePrices: { aiInsights: 0, forexTrading: 0 },
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
      modulePrices: { aiInsights: 0, forexTrading: 0 },
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { name: 'Starter' },
    update: {
      priceMonthly: 29,
      maxUsers: 5,
      maxBranches: 2,
      features: starterFeatures,
      active: true,
      pricingModel: 'flat',
      limitsUnlimited: false,
      pricePerBranchMonthly: null,
      modulePrices: { aiInsights: 15, forexTrading: 10 },
    },
    create: {
      name: 'Starter',
      priceMonthly: 29,
      maxUsers: 5,
      maxBranches: 2,
      features: starterFeatures,
      active: true,
      pricingModel: 'flat',
      limitsUnlimited: false,
      modulePrices: { aiInsights: 15, forexTrading: 10 },
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { name: 'Business' },
    update: {
      priceMonthly: 39,
      maxUsers: 25,
      maxBranches: 10,
      features: businessFeatures,
      active: true,
      pricingModel: 'per_module',
      limitsUnlimited: false,
      pricePerBranchMonthly: null,
      modulePrices: { aiInsights: 25, forexTrading: 15 },
    },
    create: {
      name: 'Business',
      priceMonthly: 39,
      maxUsers: 25,
      maxBranches: 10,
      features: businessFeatures,
      active: true,
      pricingModel: 'per_module',
      limitsUnlimited: false,
      pricePerBranchMonthly: null,
      modulePrices: { aiInsights: 25, forexTrading: 15 },
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    update: {
      priceMonthly: 199,
      maxUsers: 500,
      maxBranches: 200,
      features: enterpriseFeatures,
      active: true,
      pricingModel: 'unlimited',
      limitsUnlimited: true,
      pricePerBranchMonthly: null,
      modulePrices: { aiInsights: 0, forexTrading: 0 },
    },
    create: {
      name: 'Enterprise',
      priceMonthly: 199,
      maxUsers: 500,
      maxBranches: 200,
      features: enterpriseFeatures,
      active: true,
      pricingModel: 'unlimited',
      limitsUnlimited: true,
      pricePerBranchMonthly: null,
      modulePrices: { aiInsights: 0, forexTrading: 0 },
    },
  });

  // Create exchange rate
  await prisma.exchangeRate.create({
    data: {
      currency: 'USD',
      rate: 1,
      effectiveFrom: new Date(),
      effectiveTo: null
    }
  }).catch(() => {});

  // Seed a baseline company + centralized currency table baseline.
  // Note: Currency rows are per-company (tenant). Setup wizard or seed:demo may create additional companies.
  let company = await prisma.company.findFirst({ where: { name: 'Default Company' } });
  if (!company) {
    company = await prisma.company.findFirst({ where: { name: 'Workspace' } });
  }
  if (!company) {
    company = await prisma.company.create({ data: { name: 'Workspace' } });
  } else if (company.name === 'Default Company') {
    company = await prisma.company.update({ where: { id: company.id }, data: { name: 'Workspace' } });
  }

  const baseline = [
    { code: 'USD', baseRate: 1, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 1 },
    { code: 'CNY', baseRate: 7.2, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 7.2 },
    { code: 'PKR', baseRate: 280, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 280 },
    { code: 'AED', baseRate: 3.67, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 3.67 },
    { code: 'EUR', baseRate: 0.92, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 0.92 },
    { code: 'GBP', baseRate: 0.79, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 0.79 },
    { code: 'SAR', baseRate: 3.75, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 3.75 },
    { code: 'HKD', baseRate: 7.82, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 7.82 },
    { code: 'INR', baseRate: 83, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 83 },
    { code: 'TRY', baseRate: 32, marginPercent: 0, isAuto: true, manualRate: null, finalRate: 32 },
  ] as const;

  for (const row of baseline) {
    await prisma.currency.upsert({
      where: { companyId_code: { companyId: company.id, code: row.code } },
      update: {},
      create: {
        companyId: company.id,
        code: row.code,
        baseRate: row.baseRate,
        marginPercent: row.marginPercent,
        isAuto: row.isAuto,
        manualRate: row.manualRate === null ? undefined : row.manualRate,
        finalRate: row.finalRate,
        lastUpdatedAt: new Date(),
      }
    });
  }

  console.log('Seed completed. Phone models:', PHONE_MODELS.length);
  console.log('Open /setup to configure your company, or run: npm run seed:demo for demo data.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
