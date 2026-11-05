import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one, q, tx } from '../db.js';
import { wrap, validate, HttpError, signToken, authenticate, COOKIE, logActivity } from '../util.js';
import { sendMail, resetEmail, appUrl } from '../mailer.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT || 40), standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } });
const MAX_FAILS = 5; const LOCK_MIN = 15; const DAY = 24 * 3600 * 1000;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const password = z.string().min(8, 'Password must be at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a number');
const base = {
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,30}$/, '3-30 chars: letters, numbers, _ or .'),
  password,
};
const signupSchema = z.discriminatedUnion('role', [
  z.object({ ...base, role: z.literal('student'), rollNo: z.string().trim().min(2).max(30), department: z.string().trim().min(2).max(60), year: z.coerce.number().int().min(1).max(5).default(1), semester: z.coerce.number().int().min(1).max(10).default(1) }),
  z.object({ ...base, role: z.literal('teacher'), department: z.string().trim().min(2).max(60), designation: z.string().trim().max(60).optional() }),
  z.object({ ...base, role: z.literal('admin'), adminCode: z.string().min(1, 'Admin access code required') }),
]);
// persistent = long-lived cookie ("remember me"); otherwise a browser-session cookie
const setCookie = (res, token, maxAge) => res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', ...(maxAge ? { maxAge } : {}) });

export async function publicUser(u) {
  return one(
    `SELECT u.id,u.name,u.email,u.username,u.role,s.id AS "studentId",t.id AS "teacherId",
            COALESCE(s.department,t.department) AS department, s.roll_no AS "rollNo", s.semester, u.last_login_at AS "lastLogin"
     FROM users u LEFT JOIN students s ON s.user_id=u.id LEFT JOIN teachers t ON t.user_id=u.id WHERE u.id=$1`, [u.id]);
}

r.post('/signup', limiter, validate(signupSchema), wrap(async (req, res) => {
  const b = req.body;
  if (b.role === 'admin') {
    const code = process.env.ADMIN_SIGNUP_CODE;
    if (!code || b.adminCode !== code) throw new HttpError(403, 'Invalid admin access code');
  }
  const hash = await bcrypt.hash(b.password, 12);
  const user = await tx(async (c) => {
    const dup = await c.query('SELECT 1 FROM users WHERE email=$1 OR username=$2', [b.email, b.username]);
    if (dup.rowCount) throw new HttpError(409, 'Email or username already registered');
    const u = (await c.query('INSERT INTO users (name,email,username,password_hash,role,last_login_at) VALUES ($1,$2,$3,$4,$5,now()) RETURNING id,role,token_version', [b.name, b.email, b.username, hash, b.role])).rows[0];
    if (b.role === 'student') {
      const dupRoll = await c.query('SELECT 1 FROM students WHERE roll_no=$1', [b.rollNo]);
      if (dupRoll.rowCount) throw new HttpError(409, 'Roll number already registered');
      await c.query('INSERT INTO students (user_id,roll_no,department,year,semester) VALUES ($1,$2,$3,$4,$5)', [u.id, b.rollNo, b.department, b.year, b.semester]);
    } else if (b.role === 'teacher') {
      await c.query('INSERT INTO teachers (user_id,department,designation) VALUES ($1,$2,$3)', [u.id, b.department, b.designation || 'Assistant Professor']);
    }
    return u;
  });
  setCookie(res, signToken(user, '7d'), 7 * DAY);
  await logActivity(user.id, 'signup', `New ${b.role} account created: ${b.name}`);
  res.status(201).json({ user: await publicUser(user) });
}));

const DUMMY = bcrypt.hashSync('not-a-real-password', 12);
r.post('/login', limiter, validate(z.object({ identifier: z.string().trim().toLowerCase().min(1), password: z.string().min(1).max(200), remember: z.boolean().optional() })), wrap(async (req, res) => {
  const { identifier, password: pw, remember } = req.body;
  const u = await one('SELECT * FROM users WHERE email=$1 OR username=$1', [identifier]);
  if (u?.locked_until && new Date(u.locked_until) > new Date()) {
    const mins = Math.max(1, Math.ceil((new Date(u.locked_until) - Date.now()) / 60000));
    throw new HttpError(429, `Too many failed attempts. This account is locked for ${mins} more minute${mins > 1 ? 's' : ''}. You can also reset your password.`);
  }
  const ok = await bcrypt.compare(pw, u ? u.password_hash : DUMMY);
  if (!u || !ok) {
    if (u) {
      const n = u.failed_attempts + 1;
      if (n >= MAX_FAILS) await q(`UPDATE users SET failed_attempts=0, locked_until=now() + interval '${LOCK_MIN} minutes' WHERE id=$1`, [u.id]);
      else await q('UPDATE users SET failed_attempts=$1 WHERE id=$2', [n, u.id]);
    }
    throw new HttpError(401, 'Invalid credentials');
  }
  if (!u.active) throw new HttpError(403, 'This account has been deactivated. Contact the administrator.');
  await q('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$1', [u.id]);
  setCookie(res, signToken(u, remember ? '30d' : '1d'), remember ? 30 * DAY : undefined);
  await logActivity(u.id, 'login', `${u.name} signed in`);
  res.json({ user: await publicUser(u) });
}));

r.post('/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

r.get('/me', authenticate, wrap(async (req, res) => res.json({ user: await publicUser(req.user) })));

// Sign out everywhere: invalidates every existing session token for this user.
r.post('/logout-all', authenticate, wrap(async (req, res) => {
  await q('UPDATE users SET token_version=token_version+1 WHERE id=$1', [req.user.id]);
  res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true });
}));

r.post('/change-password', authenticate, validate(z.object({ current: z.string().min(1), next: password })), wrap(async (req, res) => {
  const u = await one('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await bcrypt.compare(req.body.current, u.password_hash))) throw new HttpError(400, 'Current password is incorrect');
  const u2 = await one('UPDATE users SET password_hash=$1, token_version=token_version+1 WHERE id=$2 RETURNING *', [await bcrypt.hash(req.body.next, 12), req.user.id]);
  setCookie(res, signToken(u2, '7d'), 7 * DAY); // other devices are signed out; this one stays signed in
  res.json({ ok: true });
}));

// ---- Forgot / reset password ----
r.post('/forgot-password', limiter, validate(z.object({ email: z.string().trim().toLowerCase().email() })), wrap(async (req, res) => {
  const u = await one('SELECT id,name,email,active FROM users WHERE email=$1', [req.body.email]);
  let devResetLink;
  if (u && u.active) {
    const token = crypto.randomBytes(32).toString('hex');
    await q('UPDATE password_resets SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [u.id]);
    await q("INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES ($1,$2, now() + interval '1 hour')", [u.id, sha256(token)]);
    const link = `${appUrl()}/reset-password?token=${token}`;
    const mail = resetEmail(u.name, link);
    let sent = false;
    try { sent = (await sendMail({ to: u.email, ...mail })).sent; } catch (e) { console.error('Reset email failed:', e.message); }
    if (!sent && process.env.NODE_ENV !== 'production') devResetLink = link;
  }
  // Same response whether or not the account exists (prevents account enumeration).
  res.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.', ...(devResetLink ? { devResetLink } : {}) });
}));

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid reset link');
r.get('/reset-password/validate', limiter, wrap(async (req, res) => {
  const t = tokenSchema.safeParse(req.query.token);
  if (!t.success) return res.json({ valid: false });
  const row = await one('SELECT 1 FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()', [sha256(t.data)]);
  res.json({ valid: !!row });
}));

r.post('/reset-password', limiter, validate(z.object({ token: tokenSchema, password })), wrap(async (req, res) => {
  const row = await one('SELECT * FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()', [sha256(req.body.token)]);
  if (!row) throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  const hash = await bcrypt.hash(req.body.password, 12);
  await tx(async (c) => {
    await c.query('UPDATE users SET password_hash=$1, token_version=token_version+1, failed_attempts=0, locked_until=NULL WHERE id=$2', [hash, row.user_id]);
    await c.query('UPDATE password_resets SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [row.user_id]);
  });
  await logActivity(row.user_id, 'password_reset', 'Password was reset');
  res.json({ ok: true });
}));

export default r;
