import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getAuthUrl, getOAuth2Client, isGoogleOAuthConfigured } from '../config/google.js';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function publicUserFields(user) {
  const googleConnected = !!(user.googleRefreshToken || user.googleAccessToken);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    selectedCalendarId: user.selectedCalendarId,
    googleConnected,
  };
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'Geldig e-mailadres verplicht' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Wachtwoord moet minimaal 8 tekens zijn' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        name: name?.trim() || null,
        passwordHash,
      },
    });
    req.session.userId = user.id;
    res.status(201).json(publicUserFields(user));
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Dit e-mailadres is al geregistreerd' });
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'E-mail en wachtwoord verplicht' });
  }
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Wachtwoord verplicht' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (!user?.passwordHash) {
      return res.status(401).json({ error: 'Onjuiste inloggegevens' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Onjuiste inloggegevens' });

    req.session.userId = user.id;
    res.json(publicUserFields(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
  });
  if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' });
  res.json(publicUserFields(user));
});

function startGoogleConnect(req, res) {
  if (!isGoogleOAuthConfigured()) {
    console.warn('Google OAuth: missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI');
    return res.redirect(`${clientUrl}?google=error&reason=oauth_not_configured`);
  }
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  req.session.save((err) => {
    if (err) {
      console.error('Session save before Google OAuth:', err);
      return res.status(500).json({ error: 'Sessie kon niet worden opgeslagen' });
    }
    try {
      res.redirect(getAuthUrl(state));
    } catch (e) {
      console.error('Google OAuth authorize URL:', e);
      res.redirect(`${clientUrl}?google=error&reason=oauth_config`);
    }
  });
}

router.get('/google/connect/start', requireAuth, startGoogleConnect);
router.get('/google/connect', requireAuth, startGoogleConnect);

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect(`${clientUrl}?google=error`);

  if (!req.session?.userId) {
    return res.redirect(`${clientUrl}?google=need_login`);
  }
  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${clientUrl}?google=error`);
  }
  delete req.session.oauthState;

  if (!isGoogleOAuthConfigured()) {
    return res.redirect(`${clientUrl}?google=error&reason=oauth_not_configured`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const existingByGoogle = await prisma.user.findFirst({
      where: { googleId: data.id, NOT: { id: req.session.userId } },
    });
    if (existingByGoogle) {
      return res.redirect(`${clientUrl}?google=conflict`);
    }

    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) return res.redirect(`${clientUrl}?google=error`);

    const updateData = {
      googleId: data.id,
      googleConnectedAt: new Date(),
      name: user.name || data.name || null,
    };
    if (tokens.access_token != null) {
      updateData.googleAccessToken = tokens.access_token;
    }
    if (tokens.refresh_token) {
      updateData.googleRefreshToken = tokens.refresh_token;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    res.redirect(`${clientUrl}?google=connected`);
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect(`${clientUrl}?google=error`);
  }
});

export default router;
