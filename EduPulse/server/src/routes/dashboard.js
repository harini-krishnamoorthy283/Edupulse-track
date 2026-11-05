import { Router } from 'express';
import { rows, one } from '../db.js';
import { wrap, getScope, scopeClause, GRADE_POINTS } from '../util.js';
import { ruleLabel } from '../alerts.js';

const r = Router();
const n1 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);

r.get('/dashboard', wrap(async (req, res) => {
  const sc = await getScope(req); const u = req.user;
  const P = () => { const p = []; return [p, (c) => scopeClause(sc, c, p)]; };
  let p, c;

  [p, c] = P();
  const totalStudents = (await one(`SELECT count(*) AS n FROM students s WHERE ${c('s.id')}`, p)).n;
  [p, c] = P();
  const att = await one(`SELECT round(100.0*count(*) FILTER (WHERE status<>'absent')/NULLIF(count(*),0),1) AS pct FROM attendance a WHERE ${c('a.student_id')}`, p);
  [p, c] = P();
  const avg = await one(`SELECT round(avg(score/max_score*100),1) AS pct FROM marks m WHERE ${c('m.student_id')}`, p);
  [p, c] = P();
  const resList = await rows(`SELECT r.grade, sub.credits, r.student_id FROM results r JOIN subjects sub ON sub.id=r.subject_id WHERE ${c('r.student_id')}`, p);
  const byStu = {}; resList.forEach((x) => { (byStu[x.student_id] ||= []).push(x); });
  const cg = Object.values(byStu).map((l) => { const cr = l.reduce((a, x) => a + x.credits, 0); return cr ? l.reduce((a, x) => a + GRADE_POINTS[x.grade] * x.credits, 0) / cr : null; }).filter((x) => x !== null);
  const avgCgpa = cg.length ? Math.round((cg.reduce((a, b) => a + b, 0) / cg.length) * 100) / 100 : null;
  const gradeDist = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'].map((g) => ({ grade: g, count: resList.filter((x) => x.grade === g).length }));
  [p, c] = P();
  const fees = await one(`SELECT COALESCE(sum(f.amount),0) AS total,
      COALESCE(sum((SELECT sum(p.amount) FROM fee_payments p WHERE p.fee_id=f.id)),0) AS paid,
      COALESCE(sum(GREATEST(f.amount - COALESCE((SELECT sum(p.amount) FROM fee_payments p WHERE p.fee_id=f.id),0),0)) FILTER (WHERE f.due_date < CURRENT_DATE),0) AS overdue
    FROM fees f WHERE ${c('f.student_id')}`, p);
  [p, c] = P();
  const alertCounts = await one(`SELECT count(*) FILTER (WHERE status<>'resolved') AS open, count(*) FILTER (WHERE status<>'resolved' AND severity IN ('critical','high')) AS urgent FROM alerts al WHERE ${c('al.student_id')}`, p);

  [p, c] = P();
  const attTrend = (await rows(`SELECT to_char(date_trunc('month',a.date),'Mon YY') AS label, to_char(date_trunc('month',a.date),'YYYY-MM') AS k,
      round(100.0*count(*) FILTER (WHERE status<>'absent')/count(*),1) AS pct FROM attendance a WHERE ${c('a.student_id')} GROUP BY 1,2 ORDER BY 2`, p));
  const sp = sc.all ? [] : [sc.ids];
  const cl = (col) => (sc.all ? 'TRUE' : `${col} = ANY($1::int[])`);
  const subjectPerf = await rows(`SELECT sub.code AS name, round(avg(m.score/m.max_score*100),1) AS marks,
      (SELECT round(100.0*count(*) FILTER (WHERE a.status<>'absent')/NULLIF(count(*),0),1) FROM attendance a WHERE a.subject_id=sub.id AND ${cl('a.student_id')}) AS attendance
    FROM marks m JOIN subjects sub ON sub.id=m.subject_id WHERE ${cl('m.student_id')} GROUP BY sub.id ORDER BY sub.code`, sp);
  [p, c] = P();
  const perfTrend = await rows(`SELECT to_char(exam_date,'Mon YY') AS label, to_char(exam_date,'YYYY-MM') AS k, round(avg(score/max_score*100),1) AS avg FROM marks m WHERE ${c('m.student_id')} GROUP BY 1,2 ORDER BY 2`, p);
  [p, c] = P();
  const extra = await rows(`SELECT category AS name, count(*) AS value FROM extracurriculars e WHERE ${c('e.student_id')} GROUP BY 1 ORDER BY 1`, p);
  [p, c] = P();
  const deptCompare = u.role === 'student' ? [] : await rows(`SELECT s.department AS name, round(avg(m.score/m.max_score*100),1) AS marks FROM marks m JOIN students s ON s.id=m.student_id WHERE ${c('m.student_id')} GROUP BY 1 ORDER BY 1`, p);
  [p, c] = P();
  const topAlerts = (await rows(`SELECT al.id,al.rule,al.severity,al.reason,al.student_tip,al.recommended_action,u.name AS student,s.roll_no FROM alerts al JOIN students s ON s.id=al.student_id JOIN users u ON u.id=s.user_id
    WHERE al.status<>'resolved' AND ${c('al.student_id')} ORDER BY CASE al.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, al.updated_at DESC LIMIT 5`, p))
    .map((a) => ({ ...a, rule_label: ruleLabel(a.rule), recommended_action: u.role === 'student' ? undefined : a.recommended_action }));

  let activities;
  if (u.role === 'admin') activities = await rows(`SELECT a.id,a.action,a.detail,a.created_at,us.name AS actor FROM activities a LEFT JOIN users us ON us.id=a.user_id ORDER BY a.created_at DESC LIMIT 8`);
  else if (u.role === 'teacher') { const pp = [u.id, sc.ids]; activities = await rows(`SELECT a.id,a.action,a.detail,a.created_at,us.name AS actor FROM activities a LEFT JOIN users us ON us.id=a.user_id WHERE a.user_id=$1 OR a.student_id = ANY($2::int[]) ORDER BY a.created_at DESC LIMIT 8`, pp); }
  else activities = await rows(`SELECT a.id,a.action,a.detail,a.created_at,us.name AS actor FROM activities a LEFT JOIN users us ON us.id=a.user_id WHERE a.user_id=$1 OR a.student_id=$2 ORDER BY a.created_at DESC LIMIT 8`, [u.id, u.studentId]);
  const notifications = await rows('SELECT id,title,message,type,severity,is_read,created_at,link FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 6', [u.id]);

  let upcoming = [], rank = null;
  if (u.role === 'student') {
    upcoming = await rows(`(SELECT 'task' AS kind, t.title, t.due_date AS date, sub.code AS meta FROM tasks t JOIN subjects sub ON sub.id=t.subject_id JOIN students s ON s.id=$1 AND s.department=sub.department AND s.semester=sub.semester
        LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.student_id=s.id WHERE t.due_date >= CURRENT_DATE AND ts.status IS NULL)
      UNION ALL (SELECT 'fee', f.title, f.due_date, 'Fee' FROM fees f WHERE f.student_id=$1 AND f.due_date >= CURRENT_DATE AND f.amount > COALESCE((SELECT sum(amount) FROM fee_payments WHERE fee_id=f.id),0))
      ORDER BY date LIMIT 6`, [u.studentId]);
    const st = await one('SELECT department,semester FROM students WHERE id=$1', [u.studentId]);
    rank = await one(`WITH a AS (SELECT m.student_id, avg(m.score/m.max_score) av FROM marks m JOIN students s ON s.id=m.student_id WHERE s.department=$2 AND s.semester=$3 GROUP BY 1)
      SELECT (SELECT count(*)+1 FROM a WHERE av > COALESCE((SELECT av FROM a WHERE student_id=$1),0)) AS rank, (SELECT count(*) FROM a) AS total`, [u.studentId, st.department, st.semester]);
  }

  res.json({
    role: u.role,
    kpis: { totalStudents, attendancePct: att.pct, avgMarks: avg.pct, avgCgpa, pendingFees: fees.total - fees.paid, overdueFees: fees.overdue, openAlerts: alertCounts.open, urgentAlerts: alertCounts.urgent, rank },
    feeBreakdown: [{ name: 'Collected', value: fees.paid }, { name: 'Pending', value: Math.max(0, fees.total - fees.paid - fees.overdue) }, { name: 'Overdue', value: fees.overdue }],
    attendanceTrend: attTrend.map(({ k, ...x }) => x), subjectPerformance: subjectPerf, performanceTrend: perfTrend.map(({ k, ...x }) => x),
    gradeDistribution: gradeDist, extracurricular: extra, departmentCompare: deptCompare, topAlerts, activities, notifications, upcoming,
  });
}));

export default r;
