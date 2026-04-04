import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth.js';
import { agreementDataToPdfBuffer } from '../services/agreementPdf.js';
import { sendAgreementMail, isMailConfigured } from '../services/agreementMail.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

async function ensureAgreementAccess(req, res, next) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Ongeldig id' });
  const row = await prisma.agreement.findFirst({
    where: { id, userId: req.session.userId },
  });
  if (!row) return res.status(404).json({ error: 'Overeenkomst niet gevonden' });
  req.agreement = row;
  next();
}

router.get('/:id', ensureAgreementAccess, async (req, res) => {
  const a = req.agreement;
  res.json({
    id: a.id,
    trackId: a.trackId,
    version: a.version,
    status: a.status,
    createdAt: a.createdAt,
    sentAt: a.sentAt,
    data: a.data,
  });
});

router.get('/:id/pdf', ensureAgreementAccess, async (req, res) => {
  try {
    const pdf = await agreementDataToPdfBuffer(req.agreement.data);
    const filename = `projectovereenkomst-v${req.agreement.version}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/send', ensureAgreementAccess, async (req, res) => {
  if (!isMailConfigured()) {
    return res.status(503).json({
      error: 'E-mail niet geconfigureerd. Zet SMTP_HOST, MAIL_FROM (en zo nodig SMTP_PORT, SMTP_USER, SMTP_PASS) in de omgeving.',
    });
  }
  const customerEmail = req.agreement.data?.customer?.email?.trim();
  if (!customerEmail) {
    return res.status(400).json({ error: 'Geen klant-e-mailadres in deze snapshot' });
  }
  try {
    const pdf = await agreementDataToPdfBuffer(req.agreement.data);
    const trackName = req.agreement.data?.track?.name || 'track';
    const subject = `Projectovereenkomst: ${trackName} (versie ${req.agreement.version})`;
    const name = req.agreement.data?.customer?.name || 'klant';
    const text = `Beste ${name},\n\nHierbij ontvangt u de projectovereenkomst als PDF-bijlage.\n\nMet vriendelijke groet`;
    await sendAgreementMail({
      to: customerEmail,
      subject,
      text,
      attachments: [
        {
          filename: `projectovereenkomst-v${req.agreement.version}.pdf`,
          content: Buffer.from(pdf),
        },
      ],
    });
    const updated = await prisma.agreement.update({
      where: { id: req.agreement.id },
      data: { status: 'sent', sentAt: new Date() },
    });
    res.json({
      id: updated.id,
      trackId: updated.trackId,
      version: updated.version,
      status: updated.status,
      createdAt: updated.createdAt,
      sentAt: updated.sentAt,
    });
  } catch (e) {
    if (e.code === 'MAIL_NOT_CONFIGURED') {
      return res.status(503).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

export default router;
