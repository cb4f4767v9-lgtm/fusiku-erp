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
  { code: 'manage_users', name: 'Manage Users' }
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
  await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: { name: 'manager', description: 'Branch Manager' }
  });
  await prisma.role.upsert({
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

  await prisma.subscriptionPlan.upsert({
    where: { name: 'Free' },
    update: {},
    create: { name: 'Free', price: 0, maxUsers: 5, maxBranches: 1 }
  });

  await prisma.exchangeRate.create({
    data: { currency: 'USD', rate: 1, effectiveFrom: new Date(), effectiveTo: null }
  }).catch(() => {});

  console.log('Base seed completed. Run setup wizard at /setup or npm run seed:demo for demo data.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
