'use strict';

const nodemailer = require('nodemailer');

/** @type {{ transporter: import('nodemailer').Transporter; fromUser: string } | null} */
let pool = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPool() {
  const fromUser = String(process.env.EMAIL_USER || '').trim();
  const pass = String(process.env.EMAIL_PASS || '').trim();

  if (!fromUser || !pass) {
    throw new Error('Missing EMAIL_USER or EMAIL_PASS environment variables.');
  }

  if (!pool) {
    pool = {
      transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: fromUser,
          pass,
        },
      }),
      fromUser,
    };
  }

  return pool;
}

/**
 * Sends a one-time passcode to the recipient via Gmail SMTP (Nodemailer).
 * Requires `EMAIL_USER` and `EMAIL_PASS` (Gmail app password recommended when 2FA is on).
 *
 * @param {string} email Recipient address
 * @param {string} otp One-time code to deliver
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
async function sendOTP(email, otp) {
  const to = String(email || '').trim();
  const code = String(otp ?? '').trim();

  if (!to) {
    throw new Error('Recipient email is required.');
  }
  if (!code) {
    throw new Error('OTP is required.');
  }

  const { transporter, fromUser } = getPool();
  const safe = escapeHtml(code);

  return transporter.sendMail({
    from: `"Verification" <${fromUser}>`,
    to,
    subject: 'Your OTP Code',
    text: `Your OTP code: ${code}\n\nIf you did not request this code, you can ignore this email.`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#111827;background:#f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
    <tr><td>
      <p style="margin:0 0 12px;font-size:16px;">Use this one-time code to continue:</p>
      <p style="margin:16px 0;font-size:28px;font-weight:700;letter-spacing:0.12em;">${safe}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">If you did not request this code, you can ignore this email.</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

module.exports = { sendOTP };
