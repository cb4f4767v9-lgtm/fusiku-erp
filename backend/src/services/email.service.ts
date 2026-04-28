import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const emailService = {
  async send(options: { to: string; subject: string; text?: string; html?: string }) {
    if (!process.env.SMTP_USER) {
      logger.warn({ subject: options.subject }, '[email] SMTP not configured — message skipped');
      return { messageId: 'skipped' };
    }
    return transporter.sendMail({
      from: process.env.SMTP_FROM || 'Fusiku <noreply@fusiku.com>',
      ...options
    });
  },

  async sendLowStockAlert(to: string, message: string) {
    return this.send({
      to,
      subject: '[FUSIKU] Low Stock Alert',
      text: message,
      html: `<p>${message}</p><p>Think Smart. Play Cool.</p>`
    });
  },

  async sendRepairComplete(to: string, imei: string, cost: number) {
    return this.send({
      to,
      subject: '[FUSIKU] Repair Completed',
      text: `Repair completed for IMEI ${imei}. Cost: $${cost}`,
      html: `<p>Repair completed for IMEI <strong>${imei}</strong></p><p>Cost: $${cost.toFixed(2)}</p>`
    });
  },

  async sendPurchaseOrder(to: string, purchaseId: string, amount: number) {
    return this.send({
      to,
      subject: '[FUSIKU] New Purchase Order',
      text: `New purchase order #${purchaseId.slice(-8)}. Total: $${amount}`,
      html: `<p>New purchase order <strong>#${purchaseId.slice(-8)}</strong></p><p>Total: $${amount.toFixed(2)}</p>`
    });
  },

  async sendSaleReceipt(to: string, saleId: string, amount: number) {
    return this.send({
      to,
      subject: '[FUSIKU] Sale Receipt',
      text: `Thank you for your purchase. Receipt #${saleId.slice(-8)}. Total: $${amount}`,
      html: `<p>Thank you for your purchase.</p><p>Receipt <strong>#${saleId.slice(-8)}</strong></p><p>Total: $${amount.toFixed(2)}</p>`
    });
  },

  async sendPasswordReset(to: string, resetLink: string, userName?: string) {
    return this.send({
      to,
      subject: '[FUSIKU] Reset Your Password',
      text: `Hi ${userName || 'there'}, click to reset your password: ${resetLink}`,
      html: `<p>Hi ${userName || 'there'},</p><p>Click the link below to reset your password:</p><p><a href="${resetLink}" style="color:#3b82f6">${resetLink}</a></p><p>Link expires in 1 hour.</p><p>Think Smart. Play Cool.</p>`
    });
  }
};
