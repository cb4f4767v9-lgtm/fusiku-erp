/**
 * Phase B2 — Validated tenant signup (internal only; no HTTP route in this phase).
 * Wraps `saasOnboardingService.provisionNewTenant` for future signup / worker integration.
 */
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import { isValidEmailStrict, assertPublicSignupPasswordStrength } from '../utils/validation';
import { saasOnboardingService, type ProvisionNewTenantInput } from './saasOnboarding.service';
import type { TenantBusinessType } from './tenantStarterPack.service';

export type InternalTenantSignupInput = Omit<ProvisionNewTenantInput, 'adminEmail' | 'adminPassword'> & {
  adminEmail: string;
  adminPassword: string;
  businessType?: TenantBusinessType | string;
};

export type TenantSignupResult = Awaited<ReturnType<typeof saasOnboardingService.provisionNewTenant>>;

export const saasSignupService = {
  /**
   * Validates company name, globally unique admin email, password strength, then provisions tenant.
   */
  async provisionTenantWithValidation(input: InternalTenantSignupInput): Promise<TenantSignupResult> {
    const companyName = String(input.companyName || '').trim();
    if (!companyName) throw new Error('Company name is required');
    if (companyName.length < 2) throw new Error('Company name is too short');
    if (companyName.length > 120) throw new Error('Company name is too long');

    const email = String(input.adminEmail || '').trim().toLowerCase();
    if (!isValidEmailStrict(email)) throw new Error('Invalid email format');

    assertPublicSignupPasswordStrength(input.adminPassword);

    const emailTaken = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (emailTaken) throw new Error('Email is already in use');

    return saasOnboardingService.provisionNewTenant({
      companyName,
      adminEmail: email,
      adminPassword: input.adminPassword,
      adminName: input.adminName,
      branchName: input.branchName,
      currency: input.currency,
      businessType: input.businessType,
    });
  },
};
