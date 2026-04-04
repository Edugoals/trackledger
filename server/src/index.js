import express from 'express';
import cors from 'cors';
import session from 'express-session';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import calendarsRoutes from './routes/calendars.js';
import customersRoutes from './routes/customers.js';
import jobsRoutes from './routes/jobs.js';
import tracksRoutes from './routes/tracks.js';
import tasksRoutes from './routes/tasks.js';
import trackTasksRoutes from './routes/trackTasks.js';
import agreementsRoutes from './routes/agreements.js';
import publicTrackShareRoutes from './routes/publicTrackShare.js';
import { isGoogleOAuthConfigured } from './config/google.js';

const app = express();
const PORT = process.env.PORT || 3000;

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());
app.use(
  session({
    name: 'trackledger.sid',
    secret: process.env.SESSION_SECRET || 'trackledger-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: true,
      secure: isProd,
    },
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/public', publicTrackShareRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/calendars', calendarsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api', trackTasksRoutes); // /api/tracks/:trackId/tasks, /api/track-tasks/:id (before /api/tracks)
app.use('/api/agreements', agreementsRoutes);
app.use('/api/tracks', tracksRoutes);
app.use('/api/tasks', tasksRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!isProd && !isGoogleOAuthConfigured()) {
    console.warn(
      '[dev] Google Calendar OAuth not configured: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (must match Google Cloud redirect URIs exactly).'
    );
  }
});
