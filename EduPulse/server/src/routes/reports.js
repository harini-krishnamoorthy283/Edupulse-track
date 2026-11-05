import { Router } from 'express';
import { rows, one } from '../db.js';
import { wrap, HttpError, requireRole, getScope, scopeClause, resolveStudent, GRADE_POINTS } from '../util.js';

const r = Router();
const staff = requireRole('admin', 'teacher');
const r1 = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 10) / 10);
const gpa = (list) => { const c = list.reduce((a, x) => a + x.credits, 0); return c ? Math.round((list.reduce((a, x) => a + GRADE_POINTS[x.grade] * x.credits, 0) / c) * 100) / 100 : null; };

// Student report card (students: own; staff: ?student_id=)
r.get('/reports/student-card', wrap(async (req, res) => {
  const sid = await resolveStudent(req, req.query.student_id);
  if (!sid) throw new HttpError(400, 'student_id is required');
  const st = await one(`SELECT s.id,s.roll_no,s.department,s.year,s.semester,s.section,u.name,u.email FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [sid]);
  const subjects = await rows(`SELECT sub.id,sub.code,sub.name,sub.credits,
      round(avg(m.score/m.max_score*100) FILTER (WHERE m.type='internal'),1) AS internal,
      round(avg(m.score/m.max_score*100) FILTER (WHERE m.type='assignment'),1) AS assignment,
      round(avg(m.score/m.max_score*100) FILTER (WHERE m.type='semester'),1) AS semester,
      round(avg(m.score/m.max_score*100),1) AS overall,
      (SELECT round(100.0*count(*) FILTER (WHERE a.status<>'absent')/NULLIF(count(*),0),1) FROM attendance a WHERE a.student_id=$1 AND a.subject_id=sub.id) AS attendance
    FROM marks m JOIN subjects sub ON sub.id=m.subject_id WHERE m.student_id=$1 GROUP BY sub.id ORDER BY sub.code`, [sid]);
  const att = await one(`SELECT round(100.0*count(*) FILTER (WHERE status<>'absent')/NULLIF(count(*),0),1) AS pct, count(*) AS total FROM attendance WHERE student_id=$1`, [sid]);
  const res_ = await rows(`SELECT r.semester,r.grade,sub.credits FROM results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id=$1`, [sid]);
  const semesters = [...new Set(res_.map((x) => x.semester))].sort((a, b) => a - b).map((n) => ({ semester: n, gpa: gpa(res_.filter((x) => x.semester === n)) }));
  const fees = await one(`SELECT COALESCE(sum(f.amount),0) AS total, COALESCE(sum((SELECT sum(p.amount) FROM fee_payments p WHERE p.fee_id=f.id)),0) AS paid FROM fees f WHERE f.student_id=$1`, [sid]);
  const alerts = await rows(`SELECT rule,severity,reason,student_tip FROM alerts WHERE student_id=$1 AND status<>'resolved' ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`, [sid]);
  const rank = await one(`WITH a AS (SELECT m.student_id, avg(m.score/m.max_score) av FROM marks m JOIN students s ON s.id=m.student_id WHERE s.department=$2 AND s.semester=$3 GROUP BY 1)
    SELECT (SELECT count(*)+1 FROM a WHERE av > COALESCE((SELECT av FROM a WHERE student_id=$1),0)) AS rank, (SELECT count(*) FROM a) AS total`, [sid, st.department, st.semester]);
  const all = subjects.filter((x) => x.overall !== null);
  res.json({ student: st, generated_at: new Date().toISOString(), subjects, attendance: { pct: att.pct, total: att.total }, overall: all.length ? r1(all.reduce((a, b) => a + b.overall, 0) / all.length) : null,
    cgpa: gpa(res_), semesters, fees: { total: fees.total, paid: fees.paid, pending: fees.total - fees.paid }, alerts, rank: rank.rank, classSize: rank.total });
}));

// Class-wide summary matrix (staff, scoped)
r.get('/reports/class-summary', staff, wrap(async (req, res) => {
  const sc = await getScope(req); const p = []; const w = [scopeClause(sc, 's.id', p)];
  if (req.query.department) { p.push(req.query.department); w.push(`s.department=$${p.length}`); }
  if (req.query.semester) { p.push(Number(req.query.semester)); w.push(`s.semester=$${p.length}`); }
  const students = await rows(`SELECT s.id,s.roll_no,u.name,s.department,s.semester,
      (SELECT round(100.0*count(*) FILTER (WHERE status<>'absent')/NULLIF(count(*),0),1) FROM attendance a WHERE a.student_id=s.id) AS attendance,
      COALESCE((SELECT sum(amount) FROM fees f WHERE f.student_id=s.id),0) - COALESCE((SELECT sum(p.amount) FROM fee_payments p JOIN fees f ON f.id=p.fee_id WHERE f.student_id=s.id),0) AS pending_fees,
      (SELECT count(*) FROM alerts al WHERE al.student_id=s.id AND al.status<>'resolved') AS alerts
    FROM students s JOIN users u ON u.id=s.user_id WHERE ${w.join(' AND ')} ORDER BY s.roll_no`, p);
  const ids = students.map((s) => s.id);
  const marks = ids.length ? await rows(`SELECT m.student_id, sub.code, round(avg(m.score/m.max_score*100),1) AS pct FROM marks m JOIN subjects sub ON sub.id=m.subject_id WHERE m.student_id = ANY($1::int[]) GROUP BY 1,2`, [ids]) : [];
  const grades = ids.length ? await rows(`SELECT r.student_id, r.grade, sub.credits FROM results r JOIN subjects sub ON sub.id=r.subject_id WHERE r.student_id = ANY($1::int[])`, [ids]) : [];
  const codes = [...new Set(marks.map((m) => m.code))].sort();
  const out = students.map((s) => {
    const mine = marks.filter((m) => m.student_id === s.id); const subj = Object.fromEntries(mine.map((m) => [m.code, m.pct]));
    return { ...s, subjects: subj, overall: mine.length ? r1(mine.reduce((a, b) => a + b.pct, 0) / mine.length) : null, cgpa: gpa(grades.filter((g) => g.student_id === s.id)) };
  });
  [...out].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1)).forEach((s, i) => { out.find((x) => x.id === s.id).rank = s.overall === null ? null : i + 1; });
  res.json({ subjects: codes, students: out });
}));

// Subject marksheet / gradebook (staff, scoped)
r.get('/reports/marksheet', staff, wrap(async (req, res) => {
  const subject = await one('SELECT id,code,name,department,semester,teacher_id FROM subjects WHERE id=$1', [Number(req.query.subject_id)]);
  if (!subject) throw new HttpError(404, 'Subject not found');
  const sc = await getScope(req); const p = [subject.department, subject.semester]; const clause = scopeClause(sc, 's.id', p);
  const students = await rows(`SELECT s.id AS student_id,s.roll_no,u.name FROM students s JOIN users u ON u.id=s.user_id WHERE s.department=$1 AND s.semester=$2 AND ${clause} ORDER BY s.roll_no`, p);
  const marks = await rows(`SELECT id,student_id,type,title,score,max_score,exam_date FROM marks WHERE subject_id=$1`, [subject.id]);
  const colMap = new Map();
  marks.forEach((m) => { const key = `${m.type}|${m.title}|${m.max_score}|${m.exam_date}`; if (!colMap.has(key)) colMap.set(key, { key, type: m.type, title: m.title, max_score: m.max_score, exam_date: m.exam_date }); });
  const columns = [...colMap.values()].sort((a, b) => (a.exam_date < b.exam_date ? -1 : a.exam_date > b.exam_date ? 1 : a.title.localeCompare(b.title)));
  const idSet = new Set(students.map((s) => s.student_id));
  const rowsOut = students.map((s) => {
    const cells = {}; let tot = 0, max = 0;
    marks.filter((m) => m.student_id === s.student_id && idSet.has(m.student_id)).forEach((m) => { cells[`${m.type}|${m.title}|${m.max_score}|${m.exam_date}`] = { id: m.id, score: m.score }; tot += m.score; max += m.max_score; });
    return { ...s, cells, total: tot, max, percent: max ? r1((100 * tot) / max) : null };
  });
  const pc = rowsOut.filter((x) => x.percent !== null).map((x) => x.percent);
  res.json({ subject, canEdit: req.user.role === 'admin' || subject.teacher_id === req.user.teacherId, columns, rows: rowsOut,
    stats: { average: pc.length ? r1(pc.reduce((a, b) => a + b, 0) / pc.length) : null, highest: pc.length ? Math.max(...pc) : null, lowest: pc.length ? Math.min(...pc) : null, passRate: pc.length ? r1((100 * pc.filter((x) => x >= 40).length) / pc.length) : null } });
}));

export default r;
