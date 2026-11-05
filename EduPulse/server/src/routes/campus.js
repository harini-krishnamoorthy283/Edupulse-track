import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { rows, one, q, tx } from '../db.js';
import { wrap, validate, idParam, HttpError, requireRole, getScope, scopeClause, assertStudent, resolveStudent, assertSubjectWrite, logActivity, notify, dateStr } from '../util.js';
import { evaluateStudent, evaluateMany, ruleLabel } from '../alerts.js';

const r = Router();
const staff = requireRole('admin', 'teacher');
const admin = requireRole('admin');
const loadSid = wrap(async (req, _res, next) => { req.sid = await resolveStudent(req, req.query.student_id); next(); });

// ================= FEES =================
const FEE_SQL = `SELECT f.id,f.student_id,f.title,f.category,f.amount,f.due_date,u.name AS student,s.roll_no,
  COALESCE((SELECT sum(p.amount) FROM fee_payments p WHERE p.fee_id=f.id),0) AS paid FROM fees f
  JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id`;
const feeState = (f) => { const pending = Math.max(0, f.amount - f.paid); const overdue = pending > 0 && f.due_date < new Date().toISOString().slice(0, 10); return { ...f, pending, status: pending === 0 ? 'paid' : overdue ? 'overdue' : f.paid > 0 ? 'partial' : 'pending' }; };

r.get('/fees', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req); const p = []; const w = [scopeClause(sc, 'f.student_id', p)];
  if (req.sid) { p.push(req.sid); w.push(`f.student_id=$${p.length}`); }
  if (req.query.category) { p.push(req.query.category); w.push(`f.category=$${p.length}`); }
  const fees = (await rows(`${FEE_SQL} WHERE ${w.join(' AND ')} ORDER BY f.due_date DESC, f.id DESC LIMIT 1000`, p)).map(feeState);
  const status = req.query.status; 
  const list = status ? fees.filter((f) => f.status === status) : fees;
  const sum = (a, k) => a.reduce((x, f) => x + f[k], 0);
  const byCat = {}; fees.forEach((f) => { byCat[f.category] ||= { category: f.category, paid: 0, pending: 0 }; byCat[f.category].paid += f.paid; byCat[f.category].pending += f.pending; });
  res.json({ fees: list, totals: { total: sum(fees, 'amount'), paid: sum(fees, 'paid'), pending: sum(fees, 'pending'), overdue: sum(fees.filter((f) => f.status === 'overdue'), 'pending') }, byCategory: Object.values(byCat) });
}));

r.get('/fees/payments', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req); const p = []; const w = [scopeClause(sc, 'f.student_id', p)];
  if (req.sid) { p.push(req.sid); w.push(`f.student_id=$${p.length}`); }
  res.json(await rows(`SELECT p.id,p.amount,p.paid_on,p.method,p.receipt_no,f.title,f.category,u.name AS student,s.roll_no FROM fee_payments p JOIN fees f ON f.id=p.fee_id
    JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id WHERE ${w.join(' AND ')} ORDER BY p.paid_on DESC, p.id DESC LIMIT 500`, p));
}));

r.post('/fees', admin, validate(z.object({
  student_id: z.number().int().optional(), department: z.string().optional(), semester: z.number().int().optional(), all: z.boolean().optional(),
  title: z.string().trim().min(2).max(120), category: z.enum(['tuition', 'exam', 'hostel', 'transport', 'library', 'other']), amount: z.number().positive().max(10000000), due_date: dateStr,
})), wrap(async (req, res) => {
  const b = req.body; let ids = [];
  if (b.student_id) ids = [b.student_id];
  else if (b.all || b.department) {
    const p = []; const w = [];
    if (b.department) { p.push(b.department); w.push(`department=$${p.length}`); }
    if (b.semester) { p.push(b.semester); w.push(`semester=$${p.length}`); }
    ids = (await rows(`SELECT id FROM students ${w.length ? 'WHERE ' + w.join(' AND ') : ''}`, p)).map((x) => x.id);
  } else throw new HttpError(400, 'Provide student_id, department or all=true');
  if (!ids.length) throw new HttpError(400, 'No matching students');
  await q(`INSERT INTO fees (student_id,title,category,amount,due_date) SELECT x,$1::text,$2::text,$3::numeric,$4::date FROM unnest($5::int[]) x`, [b.title, b.category, b.amount, b.due_date, ids]);
  await q(`INSERT INTO notifications (user_id,title,message,type,link) SELECT s.user_id,$1::text,$2::text,'reminder','/fees' FROM students s WHERE s.id = ANY($3::int[])`,
    [`New fee: ${b.title}`, `₹${b.amount.toLocaleString('en-IN')} due by ${b.due_date}.`, ids]);
  await logActivity(req.user.id, 'fee_created', `Fee "${b.title}" added for ${ids.length} student(s)`);
  const scan = evaluateMany(ids).catch(() => {});
  if (ids.length <= 200) await scan;
  res.status(201).json({ ok: true, created: ids.length });
}));

r.put('/fees/:id', admin, idParam(), validate(z.object({ title: z.string().trim().min(2), category: z.enum(['tuition', 'exam', 'hostel', 'transport', 'library', 'other']), amount: z.number().positive(), due_date: dateStr })), wrap(async (req, res) => {
  const f = await one('SELECT student_id FROM fees WHERE id=$1', [req.params.id]);
  if (!f) throw new HttpError(404, 'Fee not found');
  const b = req.body;
  await q('UPDATE fees SET title=$1,category=$2,amount=$3,due_date=$4 WHERE id=$5', [b.title, b.category, b.amount, b.due_date, req.params.id]);
  await evaluateStudent(f.student_id);
  res.json({ ok: true });
}));
r.delete('/fees/:id', admin, idParam(), wrap(async (req, res) => {
  const f = await one('SELECT student_id FROM fees WHERE id=$1', [req.params.id]);
  if (!f) throw new HttpError(404, 'Fee not found');
  await q('DELETE FROM fees WHERE id=$1', [req.params.id]);
  await evaluateStudent(f.student_id);
  res.json({ ok: true });
}));

r.post('/fees/:id/payments', requireRole('admin', 'student'), idParam(), validate(z.object({ amount: z.number().positive(), method: z.enum(['upi', 'card', 'netbanking', 'cash', 'cheque']) })), wrap(async (req, res) => {
  const f = (await rows(`${FEE_SQL} WHERE f.id=$1`, [req.params.id])).map(feeState)[0];
  if (!f) throw new HttpError(404, 'Fee not found');
  if (req.user.role === 'student' && f.student_id !== req.user.studentId) throw new HttpError(403, 'You can only pay your own fees');
  if (req.user.role === 'student' && ['cash', 'cheque'].includes(req.body.method)) throw new HttpError(400, 'Choose an online payment method');
  if (req.body.amount > f.pending + 0.001) throw new HttpError(400, `Amount exceeds pending balance (₹${f.pending})`);
  const receipt = `EDP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const pay = await one('INSERT INTO fee_payments (fee_id,amount,method,receipt_no,recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *', [f.id, req.body.amount, req.body.method, receipt, req.user.id]);
  const st = await one('SELECT user_id FROM students WHERE id=$1', [f.student_id]);
  await notify(st.user_id, { title: 'Payment received', message: `₹${req.body.amount.toLocaleString('en-IN')} received for ${f.title}. Receipt ${receipt}.`, type: 'info', link: '/fees' });
  await logActivity(req.user.id, 'fee_paid', `₹${req.body.amount} paid for ${f.title}`, f.student_id);
  await evaluateStudent(f.student_id);
  res.status(201).json(pay);
}));

// ================= EXTRACURRICULAR =================
const exSchema = z.object({ student_id: z.number().int().optional(), category: z.enum(['sports', 'event', 'competition', 'achievement']), title: z.string().trim().min(2).max(120), description: z.string().max(500).nullish(), level: z.enum(['college', 'inter-college', 'state', 'national', 'international']).default('college'), result: z.string().max(80).nullish(), event_date: dateStr });
r.get('/extracurricular', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req); const p = []; const w = [scopeClause(sc, 'e.student_id', p)];
  if (req.sid) { p.push(req.sid); w.push(`e.student_id=$${p.length}`); }
  if (req.query.category) { p.push(req.query.category); w.push(`e.category=$${p.length}`); }
  res.json(await rows(`SELECT e.*,u.name AS student,s.roll_no FROM extracurriculars e JOIN students s ON s.id=e.student_id JOIN users u ON u.id=s.user_id WHERE ${w.join(' AND ')} ORDER BY e.event_date DESC LIMIT 500`, p));
}));
r.post('/extracurricular', validate(exSchema), wrap(async (req, res) => {
  const b = req.body; const sid = req.user.role === 'student' ? req.user.studentId : b.student_id;
  if (!sid) throw new HttpError(400, 'student_id is required');
  await assertStudent(req, sid);
  const x = await one('INSERT INTO extracurriculars (student_id,category,title,description,level,result,event_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [sid, b.category, b.title, b.description || null, b.level, b.result || null, b.event_date, req.user.id]);
  await logActivity(req.user.id, 'extracurricular', `Added ${b.category}: ${b.title}`, sid);
  res.status(201).json(x);
}));
r.put('/extracurricular/:id', idParam(), validate(exSchema), wrap(async (req, res) => {
  const e = await one('SELECT * FROM extracurriculars WHERE id=$1', [req.params.id]);
  if (!e) throw new HttpError(404, 'Entry not found');
  await assertStudent(req, e.student_id);
  const b = req.body;
  await q('UPDATE extracurriculars SET category=$1,title=$2,description=$3,level=$4,result=$5,event_date=$6 WHERE id=$7', [b.category, b.title, b.description || null, b.level, b.result || null, b.event_date, e.id]);
  res.json({ ok: true });
}));
r.delete('/extracurricular/:id', idParam(), wrap(async (req, res) => {
  const e = await one('SELECT * FROM extracurriculars WHERE id=$1', [req.params.id]);
  if (!e) throw new HttpError(404, 'Entry not found');
  await assertStudent(req, e.student_id);
  await q('DELETE FROM extracurriculars WHERE id=$1', [e.id]);
  res.json({ ok: true });
}));

// ================= FEEDBACK =================
r.get('/feedback/targets', wrap(async (req, res) => {
  const u = req.user;
  if (u.role === 'student') return res.json(await rows(`SELECT DISTINCT u.id, u.name, 'teacher' AS role FROM teachers t JOIN users u ON u.id=t.user_id
    WHERE t.id IN (SELECT teacher_id FROM teacher_students WHERE student_id=$1) OR t.id IN (SELECT sub.teacher_id FROM subjects sub JOIN students s ON s.department=sub.department AND s.semester=sub.semester WHERE s.id=$1) ORDER BY u.name`, [u.studentId]));
  if (u.role === 'teacher') return res.json(await rows(`SELECT u.id, u.name || ' (' || s.roll_no || ')' AS name, 'student' AS role FROM teacher_students ts JOIN students s ON s.id=ts.student_id JOIN users u ON u.id=s.user_id WHERE ts.teacher_id=$1 ORDER BY s.roll_no`, [u.teacherId]));
  res.json(await rows(`SELECT id, name || ' (' || role || ')' AS name, role FROM users WHERE role<>'admin' AND active ORDER BY name LIMIT 500`));
}));

r.get('/feedback', wrap(async (req, res) => {
  const u = req.user; const p = []; let w = 'TRUE';
  if (u.role !== 'admin') { p.push(u.id); w = '(f.author_id=$1 OR f.target_id=$1)'; }
  const list = await rows(`SELECT f.id,f.kind,f.rating,f.anonymous,f.message,f.created_at,f.author_id,f.target_id,a.name AS author_name,a.role AS author_role,t.name AS target_name,t.role AS target_role
    FROM feedback f JOIN users a ON a.id=f.author_id JOIN users t ON t.id=f.target_id WHERE ${w} ORDER BY f.created_at DESC LIMIT 300`, p);
  res.json(list.map((f) => (f.anonymous && u.role !== 'admin' && f.author_id !== u.id ? { ...f, author_name: 'Anonymous', author_id: null } : f)));
}));

r.get('/feedback/summary', wrap(async (req, res) => {
  const u = req.user; const p = []; let w = "t.role='teacher' AND f.rating IS NOT NULL";
  if (u.role === 'teacher') { p.push(u.id); w += ' AND f.target_id=$1'; } else if (u.role === 'student') { p.push(u.id); w += ' AND f.author_id=$1'; }
  const byTeacher = await rows(`SELECT t.id,t.name,round(avg(f.rating),2) AS avg,count(*) AS n FROM feedback f JOIN users t ON t.id=f.target_id WHERE ${w} GROUP BY t.id,t.name ORDER BY avg DESC`, p);
  const dist = await rows(`SELECT f.rating, count(*) AS n FROM feedback f JOIN users t ON t.id=f.target_id WHERE ${w} GROUP BY f.rating ORDER BY f.rating`, p);
  res.json({ byTeacher, distribution: [1, 2, 3, 4, 5].map((k) => ({ rating: k, count: dist.find((d) => d.rating === k)?.n || 0 })) });
}));

r.post('/feedback', validate(z.object({ target_id: z.number().int(), rating: z.number().int().min(1).max(5).optional(), anonymous: z.boolean().optional(), message: z.string().trim().min(3).max(1000) })), wrap(async (req, res) => {
  const b = req.body; const u = req.user;
  const t = await one('SELECT id,role,name FROM users WHERE id=$1 AND active', [b.target_id]);
  if (!t || t.id === u.id) throw new HttpError(400, 'Invalid recipient');
  let kind = 'general';
  if (u.role === 'student') {
    if (t.role !== 'teacher') throw new HttpError(403, 'Students can only give feedback to teachers');
    const ok = await one(`SELECT 1 FROM teachers x WHERE x.user_id=$2 AND (x.id IN (SELECT teacher_id FROM teacher_students WHERE student_id=$1) OR x.id IN (SELECT sub.teacher_id FROM subjects sub JOIN students s ON s.department=sub.department AND s.semester=sub.semester WHERE s.id=$1))`, [u.studentId, t.id]);
    if (!ok) throw new HttpError(403, 'You can only give feedback to your own teachers');
    if (!b.rating) throw new HttpError(400, 'Please provide a rating');
    kind = 'student_to_teacher';
  } else if (u.role === 'teacher') {
    if (t.role !== 'student') throw new HttpError(403, 'Teachers can only give feedback to students');
    const sid = (await one('SELECT id FROM students WHERE user_id=$1', [t.id])).id;
    await assertStudent(req, sid);
    kind = 'teacher_to_student';
  }
  const f = await one('INSERT INTO feedback (author_id,target_id,kind,rating,anonymous,message) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [u.id, t.id, kind, b.rating || null, !!b.anonymous && u.role === 'student', b.message]);
  await notify(t.id, { title: 'New feedback received', message: b.anonymous && u.role === 'student' ? 'You received anonymous feedback.' : `${u.name} sent you feedback.`, type: 'info', link: '/feedback' });
  res.status(201).json(f);
}));
r.delete('/feedback/:id', idParam(), wrap(async (req, res) => {
  const f = await one('SELECT author_id FROM feedback WHERE id=$1', [req.params.id]);
  if (!f) throw new HttpError(404, 'Feedback not found');
  if (req.user.role !== 'admin' && f.author_id !== req.user.id) throw new HttpError(403, 'You can only delete your own feedback');
  await q('DELETE FROM feedback WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ================= LESSONS / MISSED COURSES =================
r.get('/lessons', wrap(async (req, res) => {
  const u = req.user; const p = []; const w = [];
  if (u.role === 'student') { p.push(u.studentId); w.push(`sub.department=(SELECT department FROM students WHERE id=$1) AND sub.semester=(SELECT semester FROM students WHERE id=$1)`); }
  else if (u.role === 'teacher') { p.push(u.teacherId); w.push('sub.teacher_id=$1'); }
  if (req.query.subject_id) { p.push(Number(req.query.subject_id)); w.push(`l.subject_id=$${p.length}`); }
  const sidP = u.role === 'student' ? u.studentId : null;
  p.push(sidP);
  const sidIdx = p.length;
  res.json(await rows(`SELECT l.*, sub.name AS subject, sub.code,
      (EXISTS (SELECT 1 FROM attendance a WHERE a.student_id=$${sidIdx}::int AND a.subject_id=l.subject_id AND a.date=l.lesson_date AND a.status='absent')) AS missed,
      (EXISTS (SELECT 1 FROM lesson_progress lp WHERE lp.student_id=$${sidIdx}::int AND lp.lesson_id=l.id)) AS reviewed
    FROM lessons l JOIN subjects sub ON sub.id=l.subject_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY l.lesson_date DESC, l.id DESC LIMIT 400`, p));
}));

r.get('/lessons/missed', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req);
  if (req.sid) {
    return res.json(await rows(`SELECT l.id,l.subject_id,l.lesson_date,l.topic,l.notes,l.video_url,l.resource_url,sub.name AS subject,sub.code,
        EXISTS (SELECT 1 FROM lesson_progress lp WHERE lp.student_id=$1 AND lp.lesson_id=l.id) AS reviewed
      FROM lessons l JOIN subjects sub ON sub.id=l.subject_id JOIN attendance a ON a.subject_id=l.subject_id AND a.date=l.lesson_date AND a.student_id=$1 AND a.status='absent'
      ORDER BY l.lesson_date DESC`, [req.sid]));
  }
  const p = []; const w = scopeClause(sc, 's.id', p);
  res.json(await rows(`SELECT s.id AS student_id,s.roll_no,u.name,count(l.id) AS missed,
      count(l.id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM lesson_progress lp WHERE lp.student_id=s.id AND lp.lesson_id=l.id)) AS pending
    FROM students s JOIN users u ON u.id=s.user_id JOIN attendance a ON a.student_id=s.id AND a.status='absent'
    JOIN lessons l ON l.subject_id=a.subject_id AND l.lesson_date=a.date WHERE ${w} GROUP BY s.id,u.name ORDER BY pending DESC LIMIT 100`, p));
}));

const lessonSchema = z.object({ subject_id: z.number().int(), lesson_date: dateStr, topic: z.string().trim().min(2).max(160), notes: z.string().max(4000).nullish(), video_url: z.string().url().max(500).nullish().or(z.literal('')), resource_url: z.string().url().max(500).nullish().or(z.literal('')) });
r.post('/lessons', staff, validate(lessonSchema), wrap(async (req, res) => {
  const b = req.body; const sub = await assertSubjectWrite(req, b.subject_id);
  const l = await one('INSERT INTO lessons (subject_id,lesson_date,topic,notes,video_url,resource_url,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [b.subject_id, b.lesson_date, b.topic, b.notes || null, b.video_url || null, b.resource_url || null, req.user.id]);
  await q(`INSERT INTO notifications (user_id,title,message,type,link) SELECT s.user_id,$1::text,$2::text,'info','/missed-courses' FROM students s JOIN attendance a ON a.student_id=s.id AND a.subject_id=$3 AND a.date=$4 AND a.status='absent'`,
    [`Missed lesson material: ${b.topic}`, `Notes/resources for ${sub.name} are now available.`, b.subject_id, b.lesson_date]);
  await logActivity(req.user.id, 'lesson_added', `Lesson "${b.topic}" added to ${sub.code}`);
  res.status(201).json(l);
}));
r.put('/lessons/:id', staff, idParam(), validate(lessonSchema), wrap(async (req, res) => {
  const l = await one('SELECT * FROM lessons WHERE id=$1', [req.params.id]);
  if (!l) throw new HttpError(404, 'Lesson not found');
  await assertSubjectWrite(req, l.subject_id); await assertSubjectWrite(req, req.body.subject_id);
  const b = req.body;
  await q('UPDATE lessons SET subject_id=$1,lesson_date=$2,topic=$3,notes=$4,video_url=$5,resource_url=$6 WHERE id=$7', [b.subject_id, b.lesson_date, b.topic, b.notes || null, b.video_url || null, b.resource_url || null, l.id]);
  res.json({ ok: true });
}));
r.delete('/lessons/:id', staff, idParam(), wrap(async (req, res) => {
  const l = await one('SELECT * FROM lessons WHERE id=$1', [req.params.id]);
  if (!l) throw new HttpError(404, 'Lesson not found');
  await assertSubjectWrite(req, l.subject_id);
  await q('DELETE FROM lessons WHERE id=$1', [l.id]);
  res.json({ ok: true });
}));
r.post('/lessons/:id/review', requireRole('student'), idParam(), validate(z.object({ reviewed: z.boolean() })), wrap(async (req, res) => {
  if (req.body.reviewed) await q('INSERT INTO lesson_progress (student_id,lesson_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.studentId, req.params.id]);
  else await q('DELETE FROM lesson_progress WHERE student_id=$1 AND lesson_id=$2', [req.user.studentId, req.params.id]);
  res.json({ ok: true });
}));

// ================= NOTIFICATIONS =================
r.get('/notifications', wrap(async (req, res) => {
  const p = [req.user.id]; const w = ['user_id=$1'];
  if (req.query.type) { p.push(req.query.type); w.push(`type=$${p.length}`); }
  if (req.query.unread === '1') w.push('is_read=false');
  const list = await rows(`SELECT * FROM notifications WHERE ${w.join(' AND ')} ORDER BY created_at DESC LIMIT 150`, p);
  const unread = (await one('SELECT count(*) AS n FROM notifications WHERE user_id=$1 AND is_read=false', [req.user.id])).n;
  res.json({ items: list, unread });
}));
r.put('/notifications/read-all', wrap(async (req, res) => { await q('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id]); res.json({ ok: true }); }));
r.put('/notifications/:id/read', idParam(), wrap(async (req, res) => { await q('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); res.json({ ok: true }); }));
r.delete('/notifications/:id', idParam(), wrap(async (req, res) => { await q('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); res.json({ ok: true }); }));

r.post('/notifications/announce', staff, validate(z.object({
  title: z.string().trim().min(2).max(120), message: z.string().trim().min(2).max(1000), type: z.enum(['announcement', 'reminder']).default('announcement'),
  audience: z.enum(['all', 'students', 'teachers', 'department', 'my_students']), department: z.string().optional(),
})), wrap(async (req, res) => {
  const b = req.body; const u = req.user; let sql, p;
  if (u.role === 'teacher' && b.audience !== 'my_students') throw new HttpError(403, 'Teachers can only announce to their assigned students');
  if (b.audience === 'my_students') {
    if (u.role !== 'teacher') { sql = "SELECT id FROM users WHERE role='student' AND active"; p = []; }
    else { sql = 'SELECT s.user_id AS id FROM teacher_students ts JOIN students s ON s.id=ts.student_id WHERE ts.teacher_id=$1'; p = [u.teacherId]; }
  } else if (b.audience === 'all') { sql = 'SELECT id FROM users WHERE active AND id<>$1'; p = [u.id]; }
  else if (b.audience === 'students') { sql = "SELECT id FROM users WHERE role='student' AND active"; p = []; }
  else if (b.audience === 'teachers') { sql = "SELECT id FROM users WHERE role='teacher' AND active"; p = []; }
  else { if (!b.department) throw new HttpError(400, 'Department required'); sql = `SELECT user_id AS id FROM students WHERE department=$1 UNION SELECT user_id FROM teachers WHERE department=$1`; p = [b.department]; }
  const ids = (await rows(sql, p)).map((x) => x.id);
  if (!ids.length) throw new HttpError(400, 'No recipients for that audience');
  await q(`INSERT INTO notifications (user_id,title,message,type,link) SELECT x,$1::text,$2::text,$3::text,'/notifications' FROM unnest($4::int[]) x`, [b.title, `${b.message}\n— ${u.name}`, b.type, ids]);
  await logActivity(u.id, 'announcement', `Sent "${b.title}" to ${ids.length} users`);
  res.status(201).json({ ok: true, recipients: ids.length });
}));

// ================= ALERTS =================
r.get('/alerts', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req); const p = []; const w = [scopeClause(sc, 'al.student_id', p)];
  if (req.sid) { p.push(req.sid); w.push(`al.student_id=$${p.length}`); }
  const st = req.query.status || 'active';
  if (st === 'active') w.push("al.status<>'resolved'"); else if (st !== 'all') { p.push(st); w.push(`al.status=$${p.length}`); }
  if (req.query.severity) { p.push(req.query.severity); w.push(`al.severity=$${p.length}`); }
  if (req.query.rule) { p.push(req.query.rule); w.push(`al.rule=$${p.length}`); }
  const items = await rows(`SELECT al.*,u.name AS student,s.roll_no,s.department,s.semester,s.year FROM alerts al JOIN students s ON s.id=al.student_id JOIN users u ON u.id=s.user_id
    WHERE ${w.join(' AND ')} ORDER BY CASE al.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, al.updated_at DESC LIMIT 300`, p);
  const out = items.map((a) => ({ ...a, rule_label: ruleLabel(a.rule) }));
  const bySeverity = ['critical', 'high', 'medium', 'low'].map((s) => ({ severity: s, count: out.filter((a) => a.severity === s && a.status !== 'resolved').length }));
  const byRule = [...new Set(out.map((a) => a.rule))].map((rule) => ({ rule, label: ruleLabel(rule), count: out.filter((a) => a.rule === rule && a.status !== 'resolved').length }));
  res.json({ items: req.user.role === 'student' ? out.map(({ recommended_action, ...a }) => a) : out, bySeverity, byRule });
}));

r.post('/alerts/run', staff, wrap(async (req, res) => {
  const sc = await getScope(req);
  const ids = sc.all ? (await rows('SELECT id FROM students')).map((x) => x.id) : sc.ids;
  const result = await evaluateMany(ids);
  res.json(result);
}));

r.put('/alerts/:id', staff, idParam(), validate(z.object({ status: z.enum(['open', 'acknowledged', 'resolved']) })), wrap(async (req, res) => {
  const a = await one('SELECT * FROM alerts WHERE id=$1', [req.params.id]);
  if (!a) throw new HttpError(404, 'Alert not found');
  await assertStudent(req, a.student_id);
  const s = req.body.status;
  await q(`UPDATE alerts SET status=$1, updated_at=now(), resolved_at=CASE WHEN $1='resolved' THEN now() ELSE NULL END, resolved_by=CASE WHEN $1='resolved' THEN $2::int ELSE NULL END WHERE id=$3`, [s, req.user.id, a.id]);
  await logActivity(req.user.id, 'alert_' + s, `${ruleLabel(a.rule)} alert marked ${s}`, a.student_id);
  res.json({ ok: true });
}));

r.post('/alerts/:id/remind', staff, idParam(), validate(z.object({ message: z.string().trim().max(500).optional() })), wrap(async (req, res) => {
  const a = await one('SELECT al.*, s.user_id FROM alerts al JOIN students s ON s.id=al.student_id WHERE al.id=$1', [req.params.id]);
  if (!a) throw new HttpError(404, 'Alert not found');
  await assertStudent(req, a.student_id);
  await notify(a.user_id, { title: `Reminder: ${ruleLabel(a.rule)}`, message: `${req.body.message ? req.body.message + ' — ' : ''}${a.student_tip}`, type: 'reminder', severity: a.severity, link: '/dashboard' });
  await logActivity(req.user.id, 'reminder_sent', `Reminder sent for ${ruleLabel(a.rule)}`, a.student_id);
  res.json({ ok: true });
}));

export default r;
