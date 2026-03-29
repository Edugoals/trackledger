import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/** Single OAuth2 instance: redirect URI must match Google Cloud + token exchange. */
let oauth2Singleton = null;

/**
 * Returns true when Google Calendar connect can be offered (env complete).
 */
export function isGoogleOAuthConfigured() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const uri = process.env.GOOGLE_REDIRECT_URI?.trim();
  return !!(id && secret && uri);
}

/**
 * Public redirect URI (must exactly match an Authorized redirect URI in Google Cloud Console).
 */
export function getOAuthRedirectUri() {
  const uri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!uri) {
    throw new Error('GOOGLE_REDIRECT_URI is not set');
  }
  return uri;
}

/**
 * Lazily builds the OAuth2 client so missing env at import time does not create an invalid client.
 */
export function getOAuth2Client() {
  if (!isGoogleOAuthConfigured()) {
    throw new Error(
      'Google OAuth is not configured: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI'
    );
  }
  if (!oauth2Singleton) {
    oauth2Singleton = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID.trim(),
      process.env.GOOGLE_CLIENT_SECRET.trim(),
      getOAuthRedirectUri()
    );
  }
  return oauth2Singleton;
}

export function getAuthUrl(state) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    ...(state != null && state !== '' ? { state } : {}),
  });
}

export function getCalendarClient(accessToken, refreshToken) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth: client });
}
