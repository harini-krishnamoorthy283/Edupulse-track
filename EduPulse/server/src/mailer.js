import nodemailer from 'nodemailer';

export const appUrl = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

// Sends through SMTP when SMTP_HOST is configured; otherwise logs the email (development fallback).
export async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[mail – SMTP not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { sent: false };
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
  return { sent: true };
}

export const resetEmail = (name, link) => ({
  subject: 'Reset your EduPulse password',
  text: `Hi ${name},\n\nWe received a request to reset your EduPulse password. Open this link within 1 hour:\n${link}\n\nIf you did not ask for this, you can ignore this email.\n`,
  html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px"><h2 style="color:#0e2148;margin:0 0 8px">Reset your password</h2><p style="color:#475569">Hi ${name}, we received a request to reset your EduPulse password. This link is valid for 1 hour.</p><p style="margin:24px 0"><a href="${link}" style="background:#152c5c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Choose a new password</a></p><p style="color:#94a3b8;font-size:12px">If you did not request this, you can safely ignore this email.</p></div>`,
});
