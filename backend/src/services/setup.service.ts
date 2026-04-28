/**
 * Fusiku - Setup Service
 * First-time installation wizard — transactional, validated, single source of truth for "setup complete".
 */
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import bcrypt from 'bcrypt';
import { assertValidSetupPassword, isBcryptHash, isValidEmailStrict } from '../utils/validation';
import { describeDatabaseUrl, getActiveDatabaseUrl } from '../utils/databaseUrl';

export const setupService = {
  /**
   * Setup is complete iff at least one active user can log in:
   * valid email + bcrypt password hash.
   */
  async hasValidAdminUser(): Promise<boolean> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { email: true, password: true },
    });
    for (const u of users) {
      if (!isValidEmailStrict(u.email)) continue;
      if (!u.password || !isBcryptHash(u.password)) continue;
      return true;
    }
    return false;
  },

  async isSetupComplete(): Promise<boolean> {
    return this.hasValidAdminUser();
  },

  async getSetupStatus() {
    const userCount = await prisma.user.count();
    const setupComplete = await this.hasValidAdminUser();
    const needsRepair = userCount > 0 && !setupComplete;
    const dbUrl = getActiveDatabaseUrl();
    const { kind, safeLog } = describeDatabaseUrl(dbUrl);

    const usersWithBlankCompany = await prisma.user.count({
      where: { isActive: true, companyId: '' },
    });

    return {
      setupComplete,
      userCount,
      needsRepair,
      repairReason: needsRepair
        ? 'Users exist but no account has a valid password hash. Database may be in an inconsistent state.'
        : null,
      tenantIntegrity: {
        activeUsersWithBlankCompanyId: usersWithBlankCompany,
      },
      database: {
        kind,
        activeUrl: safeLog,
      },
    };
  },

  async completeSetup(data: {
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    branchName: string;
    currency: string;
  }) {
    if (await this.hasValidAdminUser()) {
      throw new Error('Setup already completed');
    }

    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      throw new Error(
        'Cannot run first-time setup: user records already exist but no account has a valid password hash. Run `npm run reset-admin` or restore the database; do not create a second organization.'
      );
    }

    const companyName = String(data.companyName || '').trim();
    const branchName = String(data.branchName || '').trim() || 'Main Branch';
    const currency = String(data.currency || 'USD').trim() || 'USD';
    const email = String(data.adminEmail || '').trim().toLowerCase();

    if (!companyName) throw new Error('Company name is required');
    if (!isValidEmailStrict(email)) throw new Error('Invalid email format');
    assertValidSetupPassword(data.adminPassword);

    const hashedPassword = bcrypt.hashSync(data.adminPassword, 10);
    if (!isBcryptHash(hashedPassword)) {
      throw new Error('Password hashing failed');
    }

    return prisma.$transaction(async (tx) => {
      const adminRole = await tx.role.findUnique({ where: { name: 'admin' } });
      if (!adminRole) throw new Error('Admin role not found. Run database seed first.');

      const freePlan = await tx.subscriptionPlan.findFirst({ where: { name: 'Free' } });
      if (!freePlan) throw new Error('Subscription plan not found. Run database seed first.');

      const company = await tx.company.create({
        data: {
          name: companyName,
          email,
          isActive: true,
        },
      });

      const branch = await tx.branch.create({
        data: {
          name: branchName,
          companyId: company.id,
          isActive: true,
        },
      });

      await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: 'Admin',
          roleId: adminRole.id,
          companyId: company.id,
          branchId: branch.id,
          isActive: true,
        },
      });

      // Prisma client may be behind schema during development; keep this write tolerant.
      await (tx.companySettings as any).create({
        data: {
          companyId: company.id,
          baseCurrency: currency,
          currency, // legacy alias
          timezone: 'UTC',
          invoicePrefix: 'INV',
        } as any,
      } as any);

      await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: freePlan.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'active',
          trialEndsAt: null,
        },
      });

      await tx.systemConfig.upsert({
        where: { key: 'setup_completed' },
        update: { value: 'true' },
        create: { key: 'setup_completed', value: 'true' },
      });

      return { company, branch, message: 'Setup completed successfully' };
    });
  },
};
