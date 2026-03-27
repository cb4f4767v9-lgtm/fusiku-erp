/**
 * FUSIKU ERP - Demo Data Seed
 * Run: npm run seed:demo
 * Creates sample company, admin, inventory, repairs, purchases, customers
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  const freePlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Free' } });
  if (!adminRole || !freePlan) {
    console.error('Run base seed first: npx prisma db seed');
    process.exit(1);
  }

  let company = await prisma.company.findFirst({ where: { name: 'FUSIKU Demo' } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'FUSIKU Demo', email: 'admin@fusiku.com', address: '123 Demo Street' }
    });
  }

  let branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: 'Main Branch', companyId: company.id, address: '123 Demo Street' }
    });
  }

  const existingAdmin = await prisma.user.findFirst({ where: { email: 'admin@fusiku.com' } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: 'admin@fusiku.com',
        password: await bcrypt.hash('12345678', 10),
        name: 'Admin',
        roleId: adminRole.id,
        companyId: company.id,
        branchId: branch.id
      }
    });
  }

  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id, currency: 'USD', timezone: 'UTC', invoicePrefix: 'INV' }
  }).catch(() => {});

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      planId: freePlan.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'active'
    }
  }).catch(() => {});

  const sampleImeis = ['354789012345678', '354789012345679', '354789012345680', '861234567890123', '861234567890124'];
  for (let i = 0; i < 5; i++) {
    await prisma.inventory.upsert({
      where: { imei: sampleImeis[i] },
      update: {},
      create: {
        imei: sampleImeis[i],
        brand: 'Apple',
        model: 'iPhone 14',
        storage: '128GB',
        color: 'Blue',
        condition: 'refurbished',
        purchasePrice: 400 + i * 30,
        sellingPrice: 500 + i * 40,
        branchId: branch.id,
        status: 'available'
      }
    }).catch(() => {});
  }

  const supplier = await prisma.supplier.create({
    data: { name: 'Tech Suppliers Inc', contact: 'John', email: 'john@tech.com', companyId: company.id }
  }).catch(() => prisma.supplier.findFirst({ where: { companyId: company!.id } }));

  if (supplier) {
    await prisma.customer.create({
      data: { name: 'Jane Customer', phone: '+1234567890', email: 'jane@example.com', companyId: company.id }
    }).catch(() => {});
  }

  await prisma.systemConfig.upsert({
    where: { key: 'setup_completed' },
    update: { value: 'true' },
    create: { key: 'setup_completed', value: 'true' }
  }).catch(() => {});

  console.log('Demo seed completed. Login: admin@fusiku.com / 12345678');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
