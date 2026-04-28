/**
 * Phase B1 — SaaS tenant provisioning (internal only).
 * Not mounted on any public route. Call from trusted workers / future signup pipeline only.
 */
import bcrypt from 'bcrypt';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import { assertValidSetupPassword, isBcryptHash, isValidEmailStrict } from '../utils/validation';
import { saasPlanService } from './saasPlan.service';
import { applyTenantStarterPack, parseBusinessType, type TenantBusinessType } from './tenantStarterPack.service';

export type ProvisionNewTenantInput = {
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
  branchName?: string;
  currency?: string;
  /** SaaS Phase 4 — drives starter SKUs and defaults */
  businessType?: TenantBusinessType | string;
};

function invoicePrefixForBusinessType(t: TenantBusinessType): string {
  if (t === 'repair_shop') return 'REP';
  if (t === 'trading') return 'TRD';
  return 'INV';
}

export const saasOnboardingService = {
  /**
   * Creates a new company, default branch, first admin user, settings, trial subscription (Starter when seeded),
   * starter categories/products, and plan-driven defaults.
   * Does not modify global `setup_completed` (unlike first-time /setup wizard).
   */
  async provisionNewTenant(input: ProvisionNewTenantInput) {
    const companyName = String(input.companyName || '').trim();
    const branchName = String(input.branchName || '').trim() || 'Main Branch';
    const currency = String(input.currency || 'USD').trim() || 'USD';
    const email = String(input.adminEmail || '').trim().toLowerCase();
    const adminName = String(input.adminName || 'Admin').trim() || 'Admin';
    const businessType = parseBusinessType(input.businessType);

    if (!companyName) throw new Error('Company name is required');
    if (!isValidEmailStrict(email)) throw new Error('Invalid email format');
    assertValidSetupPassword(input.adminPassword);

    const hashedPassword = bcrypt.hashSync(input.adminPassword, 10);
    if (!isBcryptHash(hashedPassword)) throw new Error('Password hashing failed');

    return prisma.$transaction(async (tx) => {
      const adminRole = await tx.role.findUnique({ where: { name: 'admin' } });
      if (!adminRole) throw new Error('Admin role not found. Run database seed first.');

      const planId = await saasPlanService.resolveDefaultSignupPlanId(tx);

      const company = await tx.company.create({
        data: {
          name: companyName,
          email,
          isActive: true,
          businessType,
        },
      });

      const branch = await tx.branch.create({
        data: {
          name: branchName,
          companyId: company.id,
          isActive: true,
        },
      });

      await tx.companySettings.create({
        data: {
          companyId: company.id,
          currency,
          timezone: 'UTC',
          invoicePrefix: invoicePrefixForBusinessType(businessType),
        },
      });

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      await tx.subscription.create({
        data: {
          companyId: company.id,
          planId,
          startDate: now,
          endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          status: 'trial',
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: adminName,
          roleId: adminRole.id,
          companyId: company.id,
          branchId: branch.id,
          isActive: true,
        },
      });

      await applyTenantStarterPack(tx, {
        companyId: company.id,
        branchId: branch.id,
        businessType,
      });

      return {
        companyId: company.id,
        branchId: branch.id,
        userId: user.id,
        email: user.email,
      };
    });
  },
};
