import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { one, rows, q } from './db.js';

export const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';
export const COOKIE = 'ep_token';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const validate = (schema, src = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[src]);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    return next(new HttpError(400, msg));
  }
  req[src] = r.data;
  next();
};

export const idParam = (name = 'id') => (req, _res, next) => {
  const v = Number(req.params[name]);
  if (!Number.isInteger(v) || v <= 0) return next(new HttpError(400, 'Invalid id'));
  req.params[name] = v;
  next();
};

export function signToken(user, expiresIn = '7d') {
  return jwt.sign({ id: user.id, role: user.role, v: user.token_version || 0 }, JWT_SECRET(), { expiresIn });
}

export const authenticate = wrap(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET()); } catch { throw new HttpError(401, 'Session expired. Please log in again.'); }
  const u = await one(
    `SELECT u.id,u.name,u.email,u.username,u.role,u.active,u.token_version,s.id AS student_id,t.id AS teacher_id
     FROM users u LEFT JOIN students s ON s.user_id=u.id LEFT JOIN teachers t ON t.user_id=u.id WHERE u.id=$1`,
    [payload.id]
  );
  if (!u || !u.active) throw new HttpError(401, 'Account unavailable');
  if ((payload.v || 0) !== u.token_version) throw new HttpError(401, 'Session expired. Please log in again.');
  req.user = { id: u.id, name: u.name, email: u.email, username: u.username, role: u.role, studentId: u.student_id, teacherId: u.teacher_id };
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have permission to perform this action'));

// Scope = which students the caller may see. admin: all, teacher: assigned, student: self.
export async function getScope(req) {
  if (req._scope) return req._scope;
  const u = req.user;
  let sc;
  if (u.role === 'admin') sc = { all: true, ids: null };
  else if (u.role === 'teacher') {
    const r = await rows('SELECT student_id FROM teacher_students WHERE teacher_id=$1', [u.teacherId]);
    sc = { all: false, ids: r.map((x) => x.student_id) };
  } else sc = { all: false, ids: u.studentId ? [u.studentId] : [] };
  sc.has = (id) => sc.all || sc.ids.includes(id);
  req._scope = sc;
  return sc;
}
export function scopeClause(sc, col, params) {
  if (sc.all) return 'TRUE';
  params.push(sc.ids);
  return `${col} = ANY($${params.length}::int[])`;
}
export async function assertStudent(req, studentId) {
  const sc = await getScope(req);
  if (!sc.has(studentId)) throw new HttpError(403, 'You can only access your own / assigned students');
  return sc;
}
// Resolve optional ?student_id= for the caller; students always resolve to themselves.
export async function resolveStudent(req, raw) {
  if (req.user.role === 'student') return req.user.studentId;
  if (raw === undefined || raw === null || raw === '') return null;
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid student_id');
  await assertStudent(req, id);
  return id;
}
// Teachers may only write for subjects they teach; admin any.
export async function assertSubjectWrite(req, subjectId) {
  const s = await one('SELECT * FROM subjects WHERE id=$1', [subjectId]);
  if (!s) throw new HttpError(404, 'Subject not found');
  if (req.user.role === 'teacher' && s.teacher_id !== req.user.teacherId)
    throw new HttpError(403, 'You can only manage subjects assigned to you');
  return s;
}

export async function logActivity(userId, action, detail, studentId = null) {
  try { await q('INSERT INTO activities (user_id,student_id,action,detail) VALUES ($1,$2,$3,$4)', [userId, studentId, action, detail]); } catch { /* non-fatal */ }
}
export async function notify(userId, { title, message, type = 'info', severity = null, link = null }) {
  await q('INSERT INTO notifications (user_id,title,message,type,severity,link) VALUES ($1,$2,$3,$4,$5,$6)', [userId, title, message, type, severity, link]);
}

export const GRADE_POINTS = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, F: 0 };
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const today = () => new Date().toISOString().slice(0, 10);
