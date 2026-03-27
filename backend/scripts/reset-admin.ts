#!/usr/bin/env node
/**
 * FUSIKU ERP - Admin Password Reset
 * Run: npm run reset-admin (from backend directory)
 * Usage: npm run reset-admin -- admin@example.com newpassword
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: npm run reset-admin -- <email> <new-password>');
    console.error('Example: npm run reset-admin -- admin@fusiku.com mynewpass123');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    include: { role: true }
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed }
  });

  console.log(`Password reset for ${email} (${user.role?.name || 'user'})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
