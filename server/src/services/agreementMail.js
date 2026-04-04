import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass != null ? { user, pass } : undefined,
  });
}

export function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.text
 * @param {{ filename: string, content: Buffer }[]} opts.attachments
 */
export async function sendAgreementMail({ to, subject, text, attachments }) {
  if (!isMailConfigured()) {
    const err = new Error('E-mail is niet geconfigureerd (SMTP_HOST, MAIL_FROM)');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }
  const transport = getTransport();
  if (!transport) {
    const err = new Error('E-mail transport ontbreekt');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }
  const from = process.env.MAIL_FROM;
  await transport.sendMail({
    from,
    to,
    subject,
    text,
    attachments,
  });
}
