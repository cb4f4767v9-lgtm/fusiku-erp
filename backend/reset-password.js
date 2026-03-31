const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function reset() {
  const hash = await bcrypt.hash('admin123', 10);

  await prisma.user.updateMany({
    where: { email: 'admin@fusiku.com' },
    data: { password: hash },
  });

  console.log("✅ Password set to admin123");
  await prisma.$disconnect();
}

reset();