/**
 * Public SaaS signup (POST /api/v1/signup) is opt-in so existing deployments stay closed until configured.
 */
export function isPublicSignupEndpointEnabled(): boolean {
  const v = String(process.env.ENABLE_PUBLIC_SIGNUP || 'false').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
