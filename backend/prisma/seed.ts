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

  // Create default subscription plan
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Free' },
    update: {},
    create: { name: 'Free', price: 0, maxUsers: 5, maxBranches: 1 }
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

  console.log('Seed completed. Phone models:', PHONE_MODELS.length);
  console.log('Open /setup to configure your company, or run: npm run seed:demo for demo data.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
