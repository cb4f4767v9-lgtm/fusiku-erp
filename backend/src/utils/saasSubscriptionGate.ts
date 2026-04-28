/**
 * When true, mutating requests require a `Subscription` row for the tenant.
 * Default false keeps legacy / self-hosted DBs writable without a billing row.
 */
export function isSaasRequireSubscriptionForWrites(): boolean {
  const v = String(process.env.SAAS_REQUIRE_SUBSCRIPTION_FOR_WRITES || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
