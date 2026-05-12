/**
 * Public SaaS signup (POST /api/v1/signup) is opt-in so existing deployments stay closed until configured.
 */
export function isPublicSignupEndpointEnabled(): boolean {
  // Production deployments should stay opt-in.
  // For local dev/test environments, default to enabled so the signup flow can be exercised.
  const raw = process.env.ENABLE_PUBLIC_SIGNUP;
  if (raw == null || String(raw).trim() === '') {
    return String(process.env.NODE_ENV || 'development') !== 'production';
  }
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
