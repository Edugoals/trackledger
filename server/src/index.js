import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import calendarsRoutes from './routes/calendars.js';
import customersRoutes from './routes/customers.js';
import jobsRoutes from './routes/jobs.js';
import tracksRoutes from './routes/tracks.js';
import tasksRoutes from './routes/tasks.js';
import trackTasksRoutes from './routes/trackTasks.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'trackledger-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', httpOnly: true },
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/calendars', calendarsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api', trackTasksRoutes); // /api/tracks/:trackId/tasks, /api/track-tasks/:id (before /api/tracks)
app.use('/api/tracks', tracksRoutes);
app.use('/api/tasks', tasksRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
