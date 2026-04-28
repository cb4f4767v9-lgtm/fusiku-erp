#!/usr/bin/env node
/**
 * Create/Upsert a SUPER_ADMIN user for an existing tenant.
 *
 * Run:
 *   npm run create-admin
 *
 * Optional env overrides:
 *   COMPANY_ID=...
 *   ROLE_NAME=admin
 *   EMAIL=admin@fusiku.com
 *   PASSWORD=123456
 *   NAME=Admin
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL?.trim() || 'admin@fusiku.com';
  const password = process.env.PASSWORD || '123456';
  const name = process.env.NAME?.trim() || 'Admin';
  const roleName = process.env.ROLE_NAME?.trim() || 'admin';

  const companyIdFromEnv = process.env.COMPANY_ID?.trim();
  const company = companyIdFromEnv
    ? await prisma.company.findUnique({ where: { id: companyIdFromEnv } })
    : await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!company) {
    throw new Error(
      'No Company found. Set COMPANY_ID to an existing company id, or create a company first.'
    );
  }

  const role =
    (await prisma.role.findUnique({ where: { name: roleName } })) ||
    (await prisma.role.findUnique({ where: { name: 'SystemAdmin' } })) ||
    (await prisma.role.findFirst({ orderBy: { createdAt: 'asc' } }));

  if (!role) {
    throw new Error('No Role found. Run base seed first: npm run db:seed');
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email } },
    update: {
      name,
      password: hashed,
      roleId: role.id,
      branchRole: 'SUPER_ADMIN',
      branchId: null,
      isActive: true,
    },
    create: {
      companyId: company.id,
      email,
      password: hashed,
      name,
      roleId: role.id,
      branchRole: 'SUPER_ADMIN',
      branchId: null,
      isActive: true,
    },
    select: { id: true, email: true, name: true, companyId: true, roleId: true, branchRole: true },
  });

  console.log('Admin user upserted:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

