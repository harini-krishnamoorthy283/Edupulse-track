import { Router } from 'express';
import { z } from 'zod';
import { rows, one, q, tx } from '../db.js';
import { wrap, validate, idParam, HttpError, requireRole, getScope, scopeClause, assertStudent, resolveStudent, assertSubjectWrite, logActivity, dateStr, GRADE_POINTS, notify } from '../util.js';
import { evaluateStudent, evaluateMany } from '../alerts.js';

const r = Router();
const staff = requireRole('admin', 'teacher');
const refresh = (ids) => evaluateMany([...new Set(ids)]).catch(() => {});

// ================= ATTENDANCE =================
function attFilters(req, sc, p, alias = 'a') {
  const w = [scopeClause(sc, `${alias}.student_id`, p)];
  const { subject_id, from, to, department } = req.query;
  if (req.sid) { p.push(req.sid); w.push(`${alias}.student_id=$${p.length}`); }
  if (subject_id) { p.push(Number(subject_id)); w.push(`${alias}.subject_id=$${p.length}`); }
  if (from) { p.push(from); w.push(`${alias}.date>=$${p.length}`); }
  if (to) { p.push(to); w.push(`${alias}.date<=$${p.length}`); }
  if (department) { p.push(department); w.push(`${alias}.student_id IN (SELECT id FROM students WHERE department=$${p.length})`); }
  return w.join(' AND ');
}
const loadSid = wrap(async (req, _res, next) => { req.sid = await resolveStudent(req, req.query.student_id); next(); });

r.get('/attendance', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req); const p = [];
  const w = attFilters(req, sc, p);
  res.json(await rows(`SELECT a.id,a.student_id,a.subject_id,a.date,a.status,sub.name AS subject,sub.code,u.name AS student,s.roll_no
    FROM attendance a JOIN subjects sub ON sub.id=a.subject_id JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id
    WHERE ${w} ORDER BY a.date DESC, sub.code LIMIT 500`, p));
}));

r.get('/attendance/summary', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req);
  const sql = (extra) => { const p = []; const w = attFilters(req, sc, p); return [w, p]; };
  const [w1, p1] = sql();
  const P = `count(*) AS total, count(*) FILTER (WHERE a.status<>'absent') AS present`;
  const overall = await one(`SELECT ${P} FROM attendance a WHERE ${w1}`, p1);
  const [w2, p2] = sql();
  const subjects = await rows(`SELECT sub.id,sub.name,sub.code,${P} FROM attendance a JOIN subjects sub ON sub.id=a.subject_id WHERE ${w2} GROUP BY sub.id ORDER BY sub.code`, p2);
  const [w3, p3] = sql();
  const monthly = await rows(`SELECT to_char(a.date,'YYYY-MM') AS month,${P} FROM attendance a WHERE ${w3} GROUP BY 1 ORDER BY 1`, p3);
  const [w4, p4] = sql();
  const daily = await rows(`SELECT a.date,${P} FROM attendance a WHERE ${w4} GROUP BY a.date ORDER BY a.date DESC LIMIT 30`, p4);
  const [w5, p5] = sql();
  const byStudent = req.user.role === 'student' || req.sid ? [] : await rows(
    `SELECT s.id,s.roll_no,u.name,s.department,${P} FROM attendance a JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id WHERE ${w5} GROUP BY s.id,u.name ORDER BY (count(*) FILTER (WHERE a.status<>'absent'))::float/count(*) ASC LIMIT 100`, p5);
  const f = (x) => ({ ...x, pct: x.total ? Math.round((1000 * x.present) / x.total) / 10 : null });
  res.json({ overall: f(overall), subjects: subjects.map(f), monthly: monthly.map(f), daily: daily.reverse().map(f), students: byStudent.map(f) });
}));

r.get('/attendance/roster', staff, wrap(async (req, res) => {
  const sub = await assertSubjectWrite(req, Number(req.query.subject_id));
  const sc = await getScope(req); const p = [sub.department, sub.semester, req.query.date || new Date().toISOString().slice(0, 10), sub.id];
  const clause = scopeClause(sc, 's.id', p);
  res.json(await rows(`SELECT s.id AS student_id, s.roll_no, u.name, a.status FROM students s JOIN users u ON u.id=s.user_id
    LEFT JOIN attendance a ON a.student_id=s.id AND a.date=$3 AND a.subject_id=$4
    WHERE s.department=$1 AND s.semester=$2 AND ${clause} ORDER BY s.roll_no`, p));
}));

r.post('/attendance/bulk', staff, validate(z.object({ subject_id: z.number().int(), date: dateStr, records: z.array(z.object({ student_id: z.number().int(), status: z.enum(['present', 'absent', 'late']) })).min(1).max(1000) })), wrap(async (req, res) => {
  const { subject_id, date, records } = req.body;
  await assertSubjectWrite(req, subject_id);
  const sc = await getScope(req);
  if (records.some((x) => !sc.has(x.student_id))) throw new HttpError(403, 'Some students are not assigned to you');
  if (date > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Cannot mark attendance for a future date');
  await tx(async (c) => {
    await c.query(`INSERT INTO attendance (student_id,subject_id,date,status,marked_by)
      SELECT x.sid, $1::int, $2::date, x.st, $3::int FROM unnest($4::int[], $5::text[]) AS x(sid, st)
      ON CONFLICT (student_id,subject_id,date) DO UPDATE SET status=EXCLUDED.status, marked_by=EXCLUDED.marked_by`,
      [subject_id, date, req.user.id, records.map((x) => x.student_id), records.map((x) => x.status)]);
  });
  await logActivity(req.user.id, 'attendance_marked', `Marked attendance for ${records.length} students on ${date}`);
  await refresh(records.map((x) => x.student_id));
  res.json({ ok: true, saved: records.length });
}));

r.put('/attendance/:id', staff, idParam(), validate(z.object({ status: z.enum(['present', 'absent', 'late']) })), wrap(async (req, res) => {
  const a = await one('SELECT * FROM attendance WHERE id=$1', [req.params.id]);
  if (!a) throw new HttpError(404, 'Record not found');
  await assertStudent(req, a.student_id); await assertSubjectWrite(req, a.subject_id);
  await q('UPDATE attendance SET status=$1, marked_by=$2 WHERE id=$3', [req.body.status, req.user.id, a.id]);
  await evaluateStudent(a.student_id);
  res.json({ ok: true });
}));
r.delete('/attendance/:id', staff, idParam(), wrap(async (req, res) => {
  const a = await one('SELECT * FROM attendance WHERE id=$1', [req.params.id]);
  if (!a) throw new HttpError(404, 'Record not found');
  await assertStudent(req, a.student_id); await assertSubjectWrite(req, a.subject_id);
  await q('DELETE FROM attendance WHERE id=$1', [a.id]);
  await evaluateStudent(a.student_id);
  res.json({ ok: true });
}));

// ================= MARKS =================
r.get('/marks', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req); const p = [];
  const w = [scopeClause(sc, 'm.student_id', p)];
  if (req.sid) { p.push(req.sid); w.push(`m.student_id=$${p.length}`); }
  if (req.query.subject_id) { p.push(Number(req.query.subject_id)); w.push(`m.subject_id=$${p.length}`); }
  if (req.query.type) { p.push(req.query.type); w.push(`m.type=$${p.length}`); }
  if (req.query.semester) { p.push(Number(req.query.semester)); w.push(`m.semester=$${p.length}`); }
  res.json(await rows(`SELECT m.*, sub.name AS subject, sub.code, u.name AS student, s.roll_no, round(m.score/m.max_score*100,1) AS pct
    FROM marks m JOIN subjects sub ON sub.id=m.subject_id JOIN students s ON s.id=m.student_id JOIN users u ON u.id=s.user_id
    WHERE ${w.join(' AND ')} ORDER BY m.exam_date DESC, m.id DESC LIMIT 1000`, p));
}));

const markBase = { subject_id: z.number().int(), type: z.enum(['internal', 'assignment', 'semester']), title: z.string().trim().min(1).max(100), max_score: z.number().positive().max(1000), exam_date: dateStr };
const markSchema = z.object({ ...markBase, student_id: z.number().int(), score: z.number().min(0) }).refine((x) => x.score <= x.max_score, { message: 'score cannot exceed max_score', path: ['score'] });

async function semesterOf(studentId) { return (await one('SELECT semester FROM students WHERE id=$1', [studentId]))?.semester; }

r.post('/marks', staff, validate(markSchema), wrap(async (req, res) => {
  const b = req.body;
  await assertStudent(req, b.student_id); await assertSubjectWrite(req, b.subject_id);
  const m = await one('INSERT INTO marks (student_id,subject_id,type,title,score,max_score,exam_date,semester) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [b.student_id, b.subject_id, b.type, b.title, b.score, b.max_score, b.exam_date, await semesterOf(b.student_id)]);
  await logActivity(req.user.id, 'marks_added', `${b.title}: ${b.score}/${b.max_score}`, b.student_id);
  await evaluateStudent(b.student_id);
  res.status(201).json(m);
}));

r.post('/marks/bulk', staff, validate(z.object({ ...markBase, entries: z.array(z.object({ student_id: z.number().int(), score: z.number().min(0) })).min(1).max(500) })), wrap(async (req, res) => {
  const b = req.body;
  await assertSubjectWrite(req, b.subject_id);
  const sc = await getScope(req);
  if (b.entries.some((e) => !sc.has(e.student_id))) throw new HttpError(403, 'Some students are not assigned to you');
  if (b.entries.some((e) => e.score > b.max_score)) throw new HttpError(400, 'A score exceeds max_score');
  await tx(async (c) => {
    await c.query(`INSERT INTO marks (student_id,subject_id,type,title,score,max_score,exam_date,semester)
      SELECT x.sid,$1::int,$2::text,$3::text,x.sc,$4::numeric,$5::date,s.semester FROM unnest($6::int[],$7::numeric[]) AS x(sid,sc) JOIN students s ON s.id=x.sid`,
      [b.subject_id, b.type, b.title, b.max_score, b.exam_date, b.entries.map((e) => e.student_id), b.entries.map((e) => e.score)]);
  });
  await logActivity(req.user.id, 'marks_added', `${b.title}: marks entered for ${b.entries.length} students`);
  await refresh(b.entries.map((e) => e.student_id));
  res.status(201).json({ ok: true, saved: b.entries.length });
}));

r.put('/marks/:id', staff, idParam(), validate(z.object({ title: markBase.title, score: z.number().min(0), max_score: markBase.max_score, exam_date: dateStr, type: markBase.type })), wrap(async (req, res) => {
  const m = await one('SELECT * FROM marks WHERE id=$1', [req.params.id]);
  if (!m) throw new HttpError(404, 'Mark not found');
  await assertStudent(req, m.student_id); await assertSubjectWrite(req, m.subject_id);
  const b = req.body;
  if (b.score > b.max_score) throw new HttpError(400, 'score cannot exceed max_score');
  await q('UPDATE marks SET title=$1,score=$2,max_score=$3,exam_date=$4,type=$5 WHERE id=$6', [b.title, b.score, b.max_score, b.exam_date, b.type, m.id]);
  await evaluateStudent(m.student_id);
  res.json({ ok: true });
}));
r.delete('/marks/:id', staff, idParam(), wrap(async (req, res) => {
  const m = await one('SELECT * FROM marks WHERE id=$1', [req.params.id]);
  if (!m) throw new HttpError(404, 'Mark not found');
  await assertStudent(req, m.student_id); await assertSubjectWrite(req, m.subject_id);
  await q('DELETE FROM marks WHERE id=$1', [m.id]);
  await evaluateStudent(m.student_id);
  res.json({ ok: true });
}));

// ================= ASSIGNMENT TASKS =================
r.get('/tasks', wrap(async (req, res) => {
  const u = req.user;
  if (u.role === 'student') {
    return res.json(await rows(`SELECT t.id,t.title,t.description,t.due_date,sub.name AS subject,sub.code, ts.status, ts.submitted_at,
        CASE WHEN ts.status IN ('submitted','late') THEN 'done' WHEN t.due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END AS state
      FROM tasks t JOIN subjects sub ON sub.id=t.subject_id JOIN students s ON s.id=$1 AND s.department=sub.department AND s.semester=sub.semester
      LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.student_id=s.id ORDER BY t.due_date DESC`, [u.studentId]));
  }
  const p = []; let w = 'TRUE';
  if (u.role === 'teacher') { p.push(u.teacherId); w = 'sub.teacher_id=$1'; }
  res.json(await rows(`SELECT t.id,t.title,t.description,t.due_date,sub.name AS subject,sub.code,sub.id AS subject_id,
      (SELECT count(*) FROM task_submissions ts WHERE ts.task_id=t.id AND ts.status IN ('submitted','late')) AS submitted,
      (SELECT count(*) FROM students s WHERE s.department=sub.department AND s.semester=sub.semester) AS total
    FROM tasks t JOIN subjects sub ON sub.id=t.subject_id WHERE ${w} ORDER BY t.due_date DESC`, p));
}));

r.post('/tasks', staff, validate(z.object({ subject_id: z.number().int(), title: z.string().trim().min(2).max(120), description: z.string().max(500).optional(), due_date: dateStr })), wrap(async (req, res) => {
  const b = req.body; const sub = await assertSubjectWrite(req, b.subject_id);
  const t = await one('INSERT INTO tasks (subject_id,title,description,due_date,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id', [b.subject_id, b.title, b.description || null, b.due_date, req.user.id]);
  await q(`INSERT INTO notifications (user_id,title,message,type,link) SELECT s.user_id,$1::text,$2::text,'reminder','/marks' FROM students s WHERE s.department=$3 AND s.semester=$4`,
    [`New assignment: ${b.title}`, `${sub.name} — due ${b.due_date}`, sub.department, sub.semester]);
  await logActivity(req.user.id, 'task_created', `Assignment "${b.title}" posted for ${sub.code}`);
  res.status(201).json(t);
}));
r.delete('/tasks/:id', staff, idParam(), wrap(async (req, res) => {
  const t = await one('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
  if (!t) throw new HttpError(404, 'Task not found');
  await assertSubjectWrite(req, t.subject_id);
  await q('DELETE FROM tasks WHERE id=$1', [t.id]);
  res.json({ ok: true });
}));
r.post('/tasks/:id/submit', requireRole('student'), idParam(), wrap(async (req, res) => {
  const t = await one(`SELECT t.* FROM tasks t JOIN subjects sub ON sub.id=t.subject_id JOIN students s ON s.id=$2 AND s.department=sub.department AND s.semester=sub.semester WHERE t.id=$1`, [req.params.id, req.user.studentId]);
  if (!t) throw new HttpError(404, 'Task not found');
  const status = t.due_date < new Date().toISOString().slice(0, 10) ? 'late' : 'submitted';
  await q(`INSERT INTO task_submissions (task_id,student_id,status) VALUES ($1,$2,$3) ON CONFLICT (task_id,student_id) DO UPDATE SET status=$3, submitted_at=now()`, [t.id, req.user.studentId, status]);
  await logActivity(req.user.id, 'task_submitted', `Submitted "${t.title}"`, req.user.studentId);
  await evaluateStudent(req.user.studentId);
  res.json({ ok: true, status });
}));

// ================= RESULTS =================
const gpa = (list) => { const c = list.reduce((a, x) => a + x.credits, 0); return c ? Math.round((list.reduce((a, x) => a + GRADE_POINTS[x.grade] * x.credits, 0) / c) * 100) / 100 : null; };

r.get('/results', wrap(async (req, res) => {
  const sc = await getScope(req);
  if (req.user.role === 'student' || req.query.student_id) {
    const sid = await resolveStudent(req, req.query.student_id);
    const list = await rows(`SELECT r.id,r.semester,r.grade,r.subject_id,sub.code,sub.name,sub.credits FROM results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=$1 ORDER BY r.semester, sub.code`, [sid]);
    const sems = [...new Set(list.map((x) => x.semester))].sort((a, b) => a - b).map((n) => {
      const subs = list.filter((x) => x.semester === n).map((x) => ({ ...x, points: GRADE_POINTS[x.grade] }));
      return { semester: n, gpa: gpa(subs), credits: subs.reduce((a, x) => a + x.credits, 0), backlogs: subs.filter((x) => x.grade === 'F').length, subjects: subs };
    });
    return res.json({ student_id: sid, cgpa: gpa(list), semesters: sems });
  }
  const p = []; const w = scopeClause(sc, 's.id', p);
  const all = await rows(`SELECT s.id,s.roll_no,u.name,s.department,s.semester,r.semester AS rsem,r.grade,sub.credits FROM students s JOIN users u ON u.id=s.user_id
    LEFT JOIN results r ON r.student_id=s.id LEFT JOIN subjects sub ON sub.id=r.subject_id WHERE ${w} ORDER BY s.roll_no`, p);
  const map = new Map();
  for (const x of all) {
    if (!map.has(x.id)) map.set(x.id, { id: x.id, roll_no: x.roll_no, name: x.name, department: x.department, semester: x.semester, list: [] });
    if (x.grade) map.get(x.id).list.push({ grade: x.grade, credits: x.credits, semester: x.rsem });
  }
  const students = [...map.values()].map((s) => {
    const last = s.list.length ? Math.max(...s.list.map((x) => x.semester)) : null;
    return { id: s.id, roll_no: s.roll_no, name: s.name, department: s.department, semester: s.semester, cgpa: gpa(s.list), latest_gpa: last ? gpa(s.list.filter((x) => x.semester === last)) : null, backlogs: s.list.filter((x) => x.grade === 'F').length };
  });
  const dist = {}; all.filter((x) => x.grade).forEach((x) => { dist[x.grade] = (dist[x.grade] || 0) + 1; });
  res.json({ students, distribution: Object.entries(dist).map(([grade, count]) => ({ grade, count })) });
}));

r.post('/results', staff, validate(z.object({ student_id: z.number().int(), subject_id: z.number().int(), semester: z.number().int().min(1).max(10), grade: z.enum(['O', 'A+', 'A', 'B+', 'B', 'C', 'F']) })), wrap(async (req, res) => {
  const b = req.body;
  await assertStudent(req, b.student_id); await assertSubjectWrite(req, b.subject_id);
  await q(`INSERT INTO results (student_id,subject_id,semester,grade) VALUES ($1,$2,$3,$4) ON CONFLICT (student_id,subject_id) DO UPDATE SET grade=$4, semester=$3`, [b.student_id, b.subject_id, b.semester, b.grade]);
  await logActivity(req.user.id, 'result_published', `Grade ${b.grade} recorded`, b.student_id);
  const st = await one('SELECT user_id FROM students WHERE id=$1', [b.student_id]);
  await notify(st.user_id, { title: 'Result published', message: `A new grade (${b.grade}) has been recorded for semester ${b.semester}.`, type: 'info', link: '/results' });
  res.status(201).json({ ok: true });
}));
r.delete('/results/:id', staff, idParam(), wrap(async (req, res) => {
  const x = await one('SELECT * FROM results WHERE id=$1', [req.params.id]);
  if (!x) throw new HttpError(404, 'Result not found');
  await assertStudent(req, x.student_id); await assertSubjectWrite(req, x.subject_id);
  await q('DELETE FROM results WHERE id=$1', [x.id]);
  res.json({ ok: true });
}));

// ================= PERFORMANCE =================
const num = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);
r.get('/performance', loadSid, wrap(async (req, res) => {
  const sc = await getScope(req);
  if (req.sid) {
    const sid = req.sid;
    const st = await one('SELECT department,semester FROM students WHERE id=$1', [sid]);
    const bySubject = await rows(`SELECT sub.id,sub.name,sub.code, round(avg(m.score/m.max_score*100),1) AS mine,
        (SELECT round(avg(m2.score/m2.max_score*100),1) FROM marks m2 JOIN students s2 ON s2.id=m2.student_id WHERE m2.subject_id=sub.id AND s2.department=$2 AND s2.semester=$3) AS class_avg
      FROM marks m JOIN subjects sub ON sub.id=m.subject_id WHERE m.student_id=$1 GROUP BY sub.id ORDER BY sub.code`, [sid, st.department, st.semester]);
    const trend = await rows(`SELECT to_char(exam_date,'YYYY-MM') AS month, round(avg(score/max_score*100),1) AS avg FROM marks WHERE student_id=$1 GROUP BY 1 ORDER BY 1`, [sid]);
    const byType = await rows(`SELECT type, round(avg(score/max_score*100),1) AS avg, count(*) AS n FROM marks WHERE student_id=$1 GROUP BY type`, [sid]);
    const att = await one(`SELECT round(100.0*count(*) FILTER (WHERE status<>'absent')/NULLIF(count(*),0),1) AS pct FROM attendance WHERE student_id=$1`, [sid]);
    const avg = await one('SELECT round(avg(score/max_score*100),1) AS avg FROM marks WHERE student_id=$1', [sid]);
    const rank = await one(`WITH a AS (SELECT m.student_id, avg(m.score/m.max_score) av FROM marks m JOIN students s ON s.id=m.student_id WHERE s.department=$2 AND s.semester=$3 GROUP BY 1)
      SELECT (SELECT count(*)+1 FROM a WHERE av > (SELECT av FROM a WHERE student_id=$1)) AS rank, (SELECT count(*) FROM a) AS total`, [sid, st.department, st.semester]);
    const score = avg.avg !== null && att.pct !== null ? num(0.65 * avg.avg + 0.35 * att.pct) : null;
    const strengths = [...bySubject].sort((a, b) => b.mine - a.mine);
    return res.json({ mode: 'student', student_id: sid, bySubject, trend, byType, attendance: att.pct, avgMarks: avg.avg, score, rank: rank.rank, classSize: rank.total, strongest: strengths[0]?.name || null, weakest: strengths.at(-1)?.name || null });
  }
  const p = []; const w = scopeClause(sc, 's.id', p);
  const list = await rows(`SELECT s.id,s.roll_no,u.name,s.department,s.semester,
      (SELECT round(avg(score/max_score*100),1) FROM marks m WHERE m.student_id=s.id) AS avg_marks,
      (SELECT round(100.0*count(*) FILTER (WHERE status<>'absent')/NULLIF(count(*),0),1) FROM attendance a WHERE a.student_id=s.id) AS attendance,
      0 AS recent, 0 AS previous
    FROM students s JOIN users u ON u.id=s.user_id WHERE ${w} ORDER BY s.roll_no`, p);
  const pd = []; const pw = scopeClause(sc, 'm.student_id', pd);
  const perDate = await rows(`SELECT m.student_id, m.exam_date, avg(m.score/m.max_score*100) AS a FROM marks m WHERE ${pw} GROUP BY 1,2 ORDER BY 1,2`, pd);
  const series = {}; perDate.forEach((x) => { (series[x.student_id] ||= []).push(x.a); });
  const avgOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const trendOf = (id) => { const s = series[id] || []; if (s.length < 3) return null; const rec = s.length >= 4 ? avgOf(s.slice(-2)) : s.at(-1); const prev = s.length >= 4 ? avgOf(s.slice(-4, -2)) : avgOf(s.slice(0, -1)); return num(rec - prev); };
  const students = list.map(({ recent, previous, ...x }) => ({ ...x, score: x.avg_marks !== null && x.attendance !== null ? num(0.65 * x.avg_marks + 0.35 * x.attendance) : null, trend: trendOf(x.id) }));
  const bucket = (s) => (s === null ? 'No data' : s >= 75 ? 'Excellent (75+)' : s >= 60 ? 'Good (60-74)' : s >= 45 ? 'Average (45-59)' : 'At risk (<45)');
  const dist = {}; students.forEach((s) => { const b = bucket(s.score); dist[b] = (dist[b] || 0) + 1; });
  const p2 = []; const w2 = scopeClause(sc, 'm.student_id', p2);
  const subjectAvg = await rows(`SELECT sub.code,sub.name, round(avg(m.score/m.max_score*100),1) AS avg FROM marks m JOIN subjects sub ON sub.id=m.subject_id WHERE ${w2} GROUP BY sub.id ORDER BY sub.code`, p2);
  const p3 = []; const w3 = scopeClause(sc, 'm.student_id', p3);
  const trend = await rows(`SELECT to_char(exam_date,'YYYY-MM') AS month, round(avg(score/max_score*100),1) AS avg FROM marks m WHERE ${w3} GROUP BY 1 ORDER BY 1`, p3);
  const p4 = []; const w4 = scopeClause(sc, 'm.student_id', p4);
  const byType = await rows(`SELECT type, round(avg(score/max_score*100),1) AS avg FROM marks m WHERE ${w4} GROUP BY type`, p4);
  res.json({ mode: 'overview', students, distribution: Object.entries(dist).map(([name, value]) => ({ name, value })), subjectAvg, trend, byType });
}));

export default r;
