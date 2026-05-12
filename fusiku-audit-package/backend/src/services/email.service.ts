import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

/** Gmail / SMTP user — supports Django-style names from .env */
function smtpUser(): string {
  return String(process.env.SMTP_USER || process.env.EMAIL_HOST_USER || '').trim();
}

function smtpPass(): string {
  return String(process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD || '').trim();
}

export function isSmtpConfigured(): boolean {
  return Boolean(smtpUser() && smtpPass());
}

function smtpHost(): string {
  return String(process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
}

function smtpPort(): number {
  const raw = process.env.SMTP_PORT || process.env.EMAIL_PORT || '587';
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 587;
}

/** Port 465 uses implicit TLS (secure: true). Port 587 uses STARTTLS (secure: false). */
function smtpSecure(): boolean {
  if (String(process.env.SMTP_SECURE || '').toLowerCase() === 'true') return true;
  if (String(process.env.SMTP_SECURE || '').toLowerCase() === 'false') return false;
  return smtpPort() === 465;
}

function smtpRequireTls(): boolean {
  const v = String(process.env.EMAIL_USE_TLS ?? process.env.SMTP_REQUIRE_TLS ?? 'true').toLowerCase();
  return v !== 'false' && v !== '0';
}

const smtpDebug = (): boolean => String(process.env.SMTP_DEBUG || '').trim() === '1';

let transporter: nodemailer.Transporter | null | undefined;

function buildSmtpConfig() {
  const host = smtpHost();
  const port = smtpPort();
  const secure = smtpSecure();
  const user = smtpUser();
  const pass = smtpPass();
  return {
    host,
    port,
    secure,
    requireTLS: smtpRequireTls() && !secure,
    auth: { user, pass },
  };
}

function getTransporter(): nodemailer.Transporter | null {
  const user = smtpUser();
  const pass = smtpPass();
  if (!user || !pass) return null;
  if (transporter === undefined) {
    try {
      transporter = nodemailer.createTransport(buildSmtpConfig());
      logger.info(
        { host: smtpHost(), port: smtpPort(), secure: smtpSecure(), requireTLS: smtpRequireTls() && !smtpSecure() },
        '[email] SMTP transporter created'
      );
    } catch (err) {
      logger.error({ err }, '[email] Failed to create SMTP transporter');
      transporter = null;
      return null;
    }
  }
  return transporter;
}

/** From header: explicit SMTP_FROM, otherwise the authenticated mailbox (no fake noreply domain). */
function defaultFrom(): string {
  const explicit = String(process.env.SMTP_FROM || '').trim();
  if (explicit) return explicit;
  const user = smtpUser();
  return user ? `Fusiku <${user}>` : 'Fusiku';
}

export const emailService = {
  /**
   * Sends via Nodemailer when SMTP_USER/SMTP_PASS (or EMAIL_HOST_*) are set.
   * Returns { messageId: 'skipped' } only when credentials are missing (callers that must deliver should check).
   */
  async send(options: { to: string; subject: string; text?: string; html?: string }) {
    if (!isSmtpConfigured()) {
      logger.warn({ subject: options.subject, to: options.to }, '[email] SMTP not configured — message skipped');
      return { messageId: 'skipped' as const };
    }
    const tx = getTransporter();
    if (!tx) {
      logger.warn({ subject: options.subject, to: options.to }, '[email] SMTP transporter unavailable');
      return { messageId: 'skipped' as const };
    }

    logger.info({ to: options.to, subject: options.subject }, '[email] Sending mail');
    if (smtpDebug()) {
      console.log('[email] Sending mail to:', options.to, 'subject:', options.subject);
    }

    try {
      const info = await tx.sendMail({
        from: defaultFrom(),
        ...options,
      });
      logger.info({ to: options.to, messageId: info.messageId }, '[email] Sent successfully');
      if (smtpDebug()) {
        console.log('[email] Email sent successfully', info.messageId);
      }
      return info;
    } catch (err: unknown) {
      logger.error({ err, to: options.to, subject: options.subject }, '[email] sendMail failed');
      console.error('[email] Email failed:', err);
      throw err;
    }
  },

  async sendLowStockAlert(to: string, message: string) {
    return this.send({
      to,
      subject: '[FUSIKU] Low Stock Alert',
      text: message,
      html: `<p>${message}</p><p>Think Smart. Play Cool.</p>`,
    });
  },

  async sendRepairComplete(to: string, imei: string, cost: number) {
    return this.send({
      to,
      subject: '[FUSIKU] Repair Completed',
      text: `Repair completed for IMEI ${imei}. Cost: $${cost}`,
      html: `<p>Repair completed for IMEI <strong>${imei}</strong></p><p>Cost: $${cost.toFixed(2)}</p>`,
    });
  },

  async sendPurchaseOrder(to: string, purchaseId: string, amount: number) {
    return this.send({
      to,
      subject: '[FUSIKU] New Purchase Order',
      text: `New purchase order #${purchaseId.slice(-8)}. Total: $${amount}`,
      html: `<p>New purchase order <strong>#${purchaseId.slice(-8)}</strong></p><p>Total: $${amount.toFixed(2)}</p>`,
    });
  },

  async sendSaleReceipt(to: string, saleId: string, amount: number) {
    return this.send({
      to,
      subject: '[FUSIKU] Sale Receipt',
      text: `Thank you for your purchase. Receipt #${saleId.slice(-8)}. Total: $${amount}`,
      html: `<p>Thank you for your purchase.</p><p>Receipt <strong>#${saleId.slice(-8)}</strong></p><p>Total: $${amount.toFixed(2)}</p>`,
    });
  },

  async sendPasswordReset(to: string, resetLink: string, userName?: string) {
    return this.send({
      to,
      subject: '[FUSIKU] Reset Your Password',
      text: `Hi ${userName || 'there'}, click to reset your password: ${resetLink}`,
      html: `<p>Hi ${userName || 'there'},</p><p>Click the link below to reset your password:</p><p><a href="${resetLink}" style="color:#3b82f6">${resetLink}</a></p><p>Link expires in 1 hour.</p><p>Think Smart. Play Cool.</p>`,
    });
  },
};
