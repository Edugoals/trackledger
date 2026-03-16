import { Router } from 'express';
import { oauth2Client, getAuthUrl } from '../config/google.js';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const router = Router();
const prisma = new PrismaClient();

router.get('/google', (req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}?auth=error`);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    let user = await prisma.user.findFirst({
      where: { googleId: data.id },
    });

    if (!user) {
      user = await prisma.user.upsert({
        where: { email: data.email },
        create: {
          email: data.email,
          name: data.name,
          googleId: data.id,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
        },
        update: {
          name: data.name,
          googleId: data.id,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
        },
      });
    }

    req.session.userId = user.id;
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}?auth=error`);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, email: true, name: true, selectedCalendarId: true },
  });
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  res.json(user);
});

export default router;
