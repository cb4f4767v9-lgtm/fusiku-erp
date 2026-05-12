/** Optional `VITE_SALES_EMAIL`, `VITE_SALES_WHATSAPP` (digits only, country code, no +). No backend. */
function readEnv(key: string): string | undefined {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}

export const BILLING_SALES_EMAIL = readEnv('VITE_SALES_EMAIL') ?? 'hello@fusiku.com';

export const BILLING_SALES_WHATSAPP_E164 = readEnv('VITE_SALES_WHATSAPP')?.replace(/\D/g, '') ?? '';

export function getBillingWhatsAppHref(): string | null {
  if (!BILLING_SALES_WHATSAPP_E164) return null;
  return `https://wa.me/${BILLING_SALES_WHATSAPP_E164}`;
}

export function getBillingMailtoProHref(): string {
  const subject = encodeURIComponent('Fusiku ERP — Pro plan inquiry');
  const body = encodeURIComponent(
    'Hello,\n\nWe would like to learn more about Fusiku Pro.\n\nCompany:\n\nThank you.'
  );
  return `mailto:${BILLING_SALES_EMAIL}?subject=${subject}&body=${body}`;
}
