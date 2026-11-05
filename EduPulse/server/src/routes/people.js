import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rows, one, q, tx } from '../db.js';
import { wrap, validate, idParam, HttpError, requireRole, getScope, scopeClause, assertStudent, logActivity } from '../util.js';
import { evaluateStudent } from '../alerts.js';

const r = Router();
const admin = requireRole('admin');
const pw = z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/);

const STUDENT_LIST = `
SELECT s.id, s.user_id, s.roll_no, s.department, s.year, s.semester, s.section, u.name, u.email, u.username, u.active,
 (SELECT round(100.0*count(*) FILTER (WHERE status<>'absent')/NULLIF(count(*),0),1) FROM attendance a WHERE a.student_id=s.id) AS attendance_pct,
 (SELECT round(avg(score/max_score*100),1) FROM marks m WHERE m.student_id=s.id) AS avg_marks,
 COALESCE((SELECT sum(amount) FROM fees f WHERE f.student_id=s.id),0) - COALESCE((SELECT sum(p.amount) FROM fee_payments p JOIN fees f ON f.id=p.fee_id WHERE f.student_id=s.id),0) AS pending_fees,
 (SELECT count(*) FROM alerts al WHERE al.student_id=s.id AND al.status<>'resolved') AS open_alerts
FROM students s JOIN users u ON u.id=s.user_id`;

r.get('/students', requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const sc = await getScope(req);
  const p = [];
  const w = [scopeClause(sc, 's.id', p)];
  const { q: term, department, semester } = req.query;
  if (term) { p.push(`%${String(term).toLowerCase()}%`); w.push(`(lower(u.name) LIKE $${p.length} OR lower(s.roll_no) LIKE $${p.length})`); }
  if (department) { p.push(department); w.push(`s.department=$${p.length}`); }
  if (semester) { p.push(Number(semester)); w.push(`s.semester=$${p.length}`); }
  res.json(await rows(`${STUDENT_LIST} WHERE ${w.join(' AND ')} ORDER BY s.roll_no`, p));
}));

r.get('/students/me', requireRole('student'), wrap(async (req, res) => res.redirect(307, `/api/students/${req.user.studentId}`)));

r.get('/students/:id', idParam(), wrap(async (req, res) => {
  await assertStudent(req, req.params.id);
  const s = await one(`${STUDENT_LIST} WHERE s.id=$1`, [req.params.id]);
  if (!s) throw new HttpError(404, 'Student not found');
  const full = await one('SELECT phone,address,dob,guardian_name,guardian_phone FROM students WHERE id=$1', [req.params.id]);
  const teachers = await rows('SELECT t.id, u.name, t.department, t.designation FROM teacher_students ts JOIN teachers t ON t.id=ts.teacher_id JOIN users u ON u.id=t.user_id WHERE ts.student_id=$1', [req.params.id]);
  const cg = await rows('SELECT r.grade, sub.credits FROM results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=$1', [req.params.id]);
  const GP = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, F: 0 };
  const cr = cg.reduce((a, x) => a + x.credits, 0);
  const cgpa = cr ? Math.round((cg.reduce((a, x) => a + GP[x.grade] * x.credits, 0) / cr) * 100) / 100 : null;
  res.json({ ...s, ...full, teachers, cgpa });
}));

const studentFields = {
  name: z.string().trim().min(2).max(80), department: z.string().trim().min(2).max(60),
  year: z.coerce.number().int().min(1).max(5), semester: z.coerce.number().int().min(1).max(10),
  section: z.string().trim().max(5).optional(), roll_no: z.string().trim().min(2).max(30),
  email: z.string().trim().toLowerCase().email(), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,30}$/),
  phone: z.string().trim().max(20).nullish(), address: z.string().trim().max(300).nullish(), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal('')),
  guardian_name: z.string().trim().max(80).nullish(), guardian_phone: z.string().trim().max(20).nullish(),
};

r.post('/students', admin, validate(z.object({ ...studentFields, password: pw })), wrap(async (req, res) => {
  const b = req.body;
  const id = await tx(async (c) => {
    const dup = await c.query('SELECT 1 FROM users WHERE email=$1 OR username=$2', [b.email, b.username]);
    if (dup.rowCount) throw new HttpError(409, 'Email or username already registered');
    const u = (await c.query("INSERT INTO users (name,email,username,password_hash,role) VALUES ($1,$2,$3,$4,'student') RETURNING id", [b.name, b.email, b.username, await bcrypt.hash(b.password, 12)])).rows[0];
    return (await c.query('INSERT INTO students (user_id,roll_no,department,year,semester,section,phone,address,dob,guardian_name,guardian_phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
      [u.id, b.roll_no, b.department, b.year, b.semester, b.section || 'A', b.phone || null, b.address || null, b.dob || null, b.guardian_name || null, b.guardian_phone || null])).rows[0].id;
  });
  await logActivity(req.user.id, 'student_created', `Added student ${b.name} (${b.roll_no})`, id);
  res.status(201).json({ id });
}));

r.put('/students/:id', idParam(), wrap(async (req, res) => {
  const id = req.params.id;
  const s = await one('SELECT * FROM students WHERE id=$1', [id]);
  if (!s) throw new HttpError(404, 'Student not found');
  if (req.user.role === 'teacher') throw new HttpError(403, 'Teachers have read-only access to student profiles');
  if (req.user.role === 'student') {
    if (req.user.studentId !== id) throw new HttpError(403, 'You can only edit your own profile');
    const b = z.object({ phone: studentFields.phone, address: studentFields.address, dob: studentFields.dob, guardian_name: studentFields.guardian_name, guardian_phone: studentFields.guardian_phone }).parse(req.body);
    await q('UPDATE students SET phone=$1,address=$2,dob=$3,guardian_name=$4,guardian_phone=$5 WHERE id=$6', [b.phone || null, b.address || null, b.dob || null, b.guardian_name || null, b.guardian_phone || null, id]);
    return res.json({ ok: true });
  }
  const b = z.object(studentFields).partial().parse(req.body);
  await tx(async (c) => {
    const m = { ...s, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) };
    await c.query('UPDATE students SET roll_no=$1,department=$2,year=$3,semester=$4,section=$5,phone=$6,address=$7,dob=$8,guardian_name=$9,guardian_phone=$10 WHERE id=$11',
      [m.roll_no, m.department, m.year, m.semester, m.section, m.phone || null, m.address || null, m.dob || null, m.guardian_name || null, m.guardian_phone || null, id]);
    if (b.name || b.email || b.username) {
      const u = (await c.query('SELECT * FROM users WHERE id=$1', [s.user_id])).rows[0];
      await c.query('UPDATE users SET name=$1,email=$2,username=$3 WHERE id=$4', [b.name || u.name, b.email || u.email, b.username || u.username, s.user_id]);
    }
  });
  await evaluateStudent(id);
  res.json({ ok: true });
}));

r.delete('/students/:id', admin, idParam(), wrap(async (req, res) => {
  const s = await one('SELECT user_id FROM students WHERE id=$1', [req.params.id]);
  if (!s) throw new HttpError(404, 'Student not found');
  await q('DELETE FROM users WHERE id=$1', [s.user_id]);
  res.json({ ok: true });
}));

// ---- Teachers ----
r.get('/teachers', wrap(async (req, res) => {
  let sql = `SELECT t.id, t.user_id, u.name, u.email, u.username, u.active, t.department, t.designation, t.phone,
    (SELECT count(*) FROM teacher_students ts WHERE ts.teacher_id=t.id) AS student_count,
    (SELECT count(*) FROM subjects s WHERE s.teacher_id=t.id) AS subject_count
    FROM teachers t JOIN users u ON u.id=t.user_id`;
  const p = [];
  if (req.user.role === 'student') {
    p.push(req.user.studentId);
    sql += ` WHERE t.id IN (SELECT teacher_id FROM teacher_students WHERE student_id=$1)
             OR t.id IN (SELECT sub.teacher_id FROM subjects sub JOIN students st ON st.department=sub.department AND st.semester=sub.semester WHERE st.id=$1)`;
  } else if (req.user.role === 'teacher') {
    sql += ' WHERE t.id=$1'; p.push(req.user.teacherId);
  }
  res.json(await rows(sql + ' ORDER BY u.name', p));
}));

r.post('/teachers', admin, validate(z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,30}$/),
  password: pw, department: z.string().trim().min(2), designation: z.string().trim().max(60).optional(), phone: z.string().trim().max(20).optional(),
})), wrap(async (req, res) => {
  const b = req.body;
  const id = await tx(async (c) => {
    const dup = await c.query('SELECT 1 FROM users WHERE email=$1 OR username=$2', [b.email, b.username]);
    if (dup.rowCount) throw new HttpError(409, 'Email or username already registered');
    const u = (await c.query("INSERT INTO users (name,email,username,password_hash,role) VALUES ($1,$2,$3,$4,'teacher') RETURNING id", [b.name, b.email, b.username, await bcrypt.hash(b.password, 12)])).rows[0];
    return (await c.query('INSERT INTO teachers (user_id,department,designation,phone) VALUES ($1,$2,$3,$4) RETURNING id', [u.id, b.department, b.designation || 'Assistant Professor', b.phone || null])).rows[0].id;
  });
  await logActivity(req.user.id, 'teacher_created', `Added teacher ${b.name}`);
  res.status(201).json({ id });
}));

r.put('/teachers/:id', admin, idParam(), validate(z.object({ name: z.string().trim().min(2).max(80).optional(), department: z.string().trim().min(2).optional(), designation: z.string().trim().max(60).optional(), phone: z.string().trim().max(20).nullish() })), wrap(async (req, res) => {
  const t = await one('SELECT * FROM teachers WHERE id=$1', [req.params.id]);
  if (!t) throw new HttpError(404, 'Teacher not found');
  const b = req.body;
  await q('UPDATE teachers SET department=$1,designation=$2,phone=$3 WHERE id=$4', [b.department || t.department, b.designation || t.designation, b.phone ?? t.phone, t.id]);
  if (b.name) await q('UPDATE users SET name=$1 WHERE id=$2', [b.name, t.user_id]);
  res.json({ ok: true });
}));

r.delete('/teachers/:id', admin, idParam(), wrap(async (req, res) => {
  const t = await one('SELECT user_id FROM teachers WHERE id=$1', [req.params.id]);
  if (!t) throw new HttpError(404, 'Teacher not found');
  await q('DELETE FROM users WHERE id=$1', [t.user_id]);
  res.json({ ok: true });
}));

// Teacher <-> student assignment (admin)
r.get('/teachers/:id/students', admin, idParam(), wrap(async (req, res) =>
  res.json((await rows('SELECT student_id FROM teacher_students WHERE teacher_id=$1', [req.params.id])).map((x) => x.student_id))));

r.put('/teachers/:id/students', admin, idParam(), validate(z.object({ studentIds: z.array(z.number().int()).max(5000) })), wrap(async (req, res) => {
  const t = await one('SELECT id FROM teachers WHERE id=$1', [req.params.id]);
  if (!t) throw new HttpError(404, 'Teacher not found');
  await tx(async (c) => {
    await c.query('DELETE FROM teacher_students WHERE teacher_id=$1', [t.id]);
    if (req.body.studentIds.length)
      await c.query('INSERT INTO teacher_students (teacher_id,student_id) SELECT $1, s.id FROM students s WHERE s.id = ANY($2::int[])', [t.id, req.body.studentIds]);
  });
  await logActivity(req.user.id, 'assignment', `Updated student assignments for teacher #${t.id}`);
  res.json({ ok: true });
}));

// ---- Users admin ----
r.get('/admin/users', admin, wrap(async (_req, res) =>
  res.json(await rows('SELECT id,name,email,username,role,active,created_at FROM users ORDER BY created_at DESC'))));

r.patch('/admin/users/:id', admin, idParam(), validate(z.object({ active: z.boolean().optional(), password: pw.optional() })), wrap(async (req, res) => {
  if (req.params.id === req.user.id && req.body.active === false) throw new HttpError(400, 'You cannot deactivate your own account');
  const u = await one('SELECT id FROM users WHERE id=$1', [req.params.id]);
  if (!u) throw new HttpError(404, 'User not found');
  if (req.body.active !== undefined) await q('UPDATE users SET active=$1 WHERE id=$2', [req.body.active, u.id]);
  if (req.body.password) await q('UPDATE users SET password_hash=$1, token_version=token_version+1, failed_attempts=0, locked_until=NULL WHERE id=$2', [await bcrypt.hash(req.body.password, 12), u.id]);
  res.json({ ok: true });
}));

r.delete('/admin/users/:id', admin, idParam(), wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
  await q('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---- Subjects ----
r.get('/subjects', wrap(async (req, res) => {
  const p = [], w = [];
  if (req.user.role === 'student') {
    const s = await one('SELECT department,semester FROM students WHERE id=$1', [req.user.studentId]);
    p.push(s.department, s.semester); w.push(`s.department=$1 AND s.semester=$2`);
  } else if (req.user.role === 'teacher' && req.query.mine) { p.push(req.user.teacherId); w.push(`s.teacher_id=$1`); }
  if (req.query.department) { p.push(req.query.department); w.push(`s.department=$${p.length}`); }
  if (req.query.semester) { p.push(Number(req.query.semester)); w.push(`s.semester=$${p.length}`); }
  res.json(await rows(`SELECT s.*, u.name AS teacher_name FROM subjects s LEFT JOIN teachers t ON t.id=s.teacher_id LEFT JOIN users u ON u.id=t.user_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY s.department, s.semester, s.code`, p));
}));

const subjectSchema = z.object({ code: z.string().trim().min(2).max(20), name: z.string().trim().min(2).max(100), department: z.string().trim().min(2), semester: z.coerce.number().int().min(1).max(10), credits: z.coerce.number().int().min(1).max(10).default(3), teacher_id: z.coerce.number().int().nullish() });
r.post('/subjects', admin, validate(subjectSchema), wrap(async (req, res) => {
  const b = req.body;
  const s = await one('INSERT INTO subjects (code,name,department,semester,credits,teacher_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [b.code.toUpperCase(), b.name, b.department, b.semester, b.credits, b.teacher_id || null]);
  res.status(201).json(s);
}));
r.put('/subjects/:id', admin, idParam(), validate(subjectSchema), wrap(async (req, res) => {
  const b = req.body;
  await q('UPDATE subjects SET code=$1,name=$2,department=$3,semester=$4,credits=$5,teacher_id=$6 WHERE id=$7', [b.code.toUpperCase(), b.name, b.department, b.semester, b.credits, b.teacher_id || null, req.params.id]);
  res.json({ ok: true });
}));
r.delete('/subjects/:id', admin, idParam(), wrap(async (req, res) => { await q('DELETE FROM subjects WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

r.get('/meta', wrap(async (_req, res) => {
  res.json({ departments: (await rows('SELECT DISTINCT department FROM (SELECT department FROM students UNION SELECT department FROM subjects UNION SELECT department FROM teachers) d ORDER BY 1')).map((x) => x.department) });
}));

export default r;
