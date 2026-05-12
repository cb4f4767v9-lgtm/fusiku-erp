/**
 * SaaS billing — Prisma `Subscription` is the company subscription row; `SubscriptionPlan` is the catalog.
 */
export enum SubscriptionStatus {
  Trial = 'trial',
  Active = 'active',
  Expired = 'expired',
  Trialing = 'trialing',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Cancelled = 'cancelled',
}

/** Resolved from `Subscription` + `SubscriptionPlan` (see `saasPlan.service`). */
export interface SubscriptionContext {
  companyId: string;
  status: SubscriptionStatus | string;
  planId?: string;
  trialEndsAt?: Date | null;
  startedAt?: Date;
}
/**
 * Result of internal tenant signup (`saasSignupService.provisionTenantWithValidation`).
 * Intended for a future `POST /api/v1/signup` — not exposed in Phase B2.
 */
export interface TenantSignupResultDto {
  companyId: string;
  branchId: string;
  userId: string;
  email: string;
}

/** POST /api/v1/signup response body (after envelope unwrap on clients). */
export interface PublicSignupResponseDto {
  companyId: string;
  userId: string;
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string;
    branchId?: string;
    branch?: string;
  };
}
