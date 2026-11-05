import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { pool, migrate, one } from './db.js';
import { authenticate, HttpError } from './util.js';
import { evaluateAll } from './alerts.js';
import authRoutes from './routes/auth.js';
import people from './routes/people.js';
import academics from './routes/academics.js';
import campus from './routes/campus.js';
import dashboard from './routes/dashboard.js';
import reports from './routes/reports.js';
import { eventsHandler, liveBroadcast, emitAll } from './events.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], scriptSrc: ["'self'"], connectSrc: ["'self'"], fontSrc: ["'self'", 'data:'], frameAncestors: ["'none'"] } } }));
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  // CSRF defence in depth: cookies are SameSite=Lax; state-changing calls must also carry a custom header.
  app.use('/api', (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('x-requested-with') !== 'edupulse') return next(new HttpError(403, 'Missing CSRF header'));
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'EduPulse' }));
  app.use('/api/auth', authRoutes);
  app.get('/api/events', authenticate, eventsHandler);
  app.use('/api', authenticate, liveBroadcast, dashboard, reports, people, academics, campus);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (err.code === '23505') return res.status(409).json({ error: 'A record with these details already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });
  return app;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
    console.error('JWT_SECRET must be set (24+ chars) in production'); process.exit(1);
  }
  await migrate();
  const { n } = await one('SELECT count(*) AS n FROM users');
  if (n === 0 && process.env.AUTO_SEED !== 'false') {
    console.log('Empty database: seeding demo data...');
    const { seed } = await import('./seed.js');
    await seed();
  }
  const port = Number(process.env.PORT || 4000);
  createApp().listen(port, () => console.log(`EduPulse API running on http://localhost:${port}`));
  const scan = () => evaluateAll().then(() => emitAll('*', { path: 'scan' })).catch((e) => console.error('alert scan failed', e.message));
  setTimeout(scan, 5000);
  setInterval(scan, 30 * 60 * 1000);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
export { pool };
