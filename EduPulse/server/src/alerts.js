import { q, rows, one } from './db.js';
import { notify } from './util.js';

const RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const pct = (n, d) => (d ? (100 * n) / d : null);
const r1 = (n) => Math.round(n * 10) / 10;

async function metrics(s) {
  const att = await rows(
    `SELECT sub.name, count(*) AS total, count(*) FILTER (WHERE a.status<>'absent') AS present
     FROM attendance a JOIN subjects sub ON sub.id=a.subject_id WHERE a.student_id=$1 GROUP BY sub.name`, [s.id]);
  const days = await rows(
    `SELECT date, bool_and(status='absent') AS all_absent FROM attendance WHERE student_id=$1 GROUP BY date ORDER BY date DESC`, [s.id]);
  const marks = await rows(
    `SELECT sub.name, (m.score/m.max_score*100) AS p, m.exam_date FROM marks m JOIN subjects sub ON sub.id=m.subject_id
     WHERE m.student_id=$1 ORDER BY m.exam_date, m.id`, [s.id]);
  const tasks = await one(
    `SELECT count(*) AS overdue FROM tasks t JOIN subjects sub ON sub.id=t.subject_id
     LEFT JOIN task_submissions ts ON ts.task_id=t.id AND ts.student_id=$1
     WHERE sub.department=$2 AND sub.semester=$3 AND t.due_date < CURRENT_DATE
       AND (ts.status IS NULL OR ts.status='pending')`, [s.id, s.department, s.semester]);
  const fees = await rows(
    `SELECT f.title, f.amount - COALESCE(sum(p.amount),0) AS rem, (CURRENT_DATE - f.due_date) AS days
     FROM fees f LEFT JOIN fee_payments p ON p.fee_id=f.id WHERE f.student_id=$1 AND f.due_date < CURRENT_DATE
     GROUP BY f.id HAVING f.amount - COALESCE(sum(p.amount),0) > 0`, [s.id]);
  return { att, days, marks, overdueTasks: tasks.overdue, fees };
}

function evaluate(m) {
  const out = {};
  // 1. Attendance below 75%
  const tot = m.att.reduce((a, x) => a + x.total, 0);
  const pres = m.att.reduce((a, x) => a + x.present, 0);
  const overall = pct(pres, tot);
  if (tot >= 5 && overall < 75) {
    const low = m.att.filter((x) => pct(x.present, x.total) < 75).map((x) => `${x.name} (${r1(pct(x.present, x.total))}%)`);
    out.attendance = {
      severity: overall < 60 ? 'critical' : overall < 70 ? 'high' : 'medium',
      reason: `Overall attendance is ${r1(overall)}%, below the 75% requirement.${low.length ? ' Low subjects: ' + low.slice(0, 4).join(', ') + '.' : ''}`,
      recommended_action: 'Meet the student, understand the cause of absences and set an attendance recovery plan; inform the guardian if below 65%.',
      student_tip: `Your attendance is ${r1(overall)}%. Attend every upcoming class and review missed topics under Missed Courses to get back above 75%.`,
    };
  }
  // 2. Low marks
  if (m.marks.length >= 3) {
    const avg = m.marks.reduce((a, x) => a + x.p, 0) / m.marks.length;
    const bySub = {};
    m.marks.forEach((x) => { (bySub[x.name] ||= []).push(x.p); });
    const weak = Object.entries(bySub).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]).filter(([, v]) => v < 40);
    if (avg < 50 || weak.length) {
      out.marks = {
        severity: avg < 35 ? 'critical' : avg < 45 || weak.length >= 2 ? 'high' : 'medium',
        reason: `Average score is ${r1(avg)}%.${weak.length ? ' Below 40% in: ' + weak.map(([k, v]) => `${k} (${r1(v)}%)`).join(', ') + '.' : ''}`,
        recommended_action: 'Arrange remedial classes or peer tutoring for weak subjects and review internal assessment answers with the student.',
        student_tip: `Your average is ${r1(avg)}%. Focus on ${weak.length ? weak.map(([k]) => k).join(', ') : 'your weakest subjects'}: revise notes, solve past questions and ask your teacher for doubt sessions.`,
      };
    }
  }
  // 3. Continuous absence
  let streak = 0;
  for (const d of m.days) { if (d.all_absent) streak++; else break; }
  if (streak >= 3) {
    out.absence = {
      severity: streak >= 7 ? 'critical' : streak >= 5 ? 'high' : 'medium',
      reason: `Absent for ${streak} consecutive class days (since ${m.days[streak - 1].date}).`,
      recommended_action: 'Contact the student and guardian immediately to check for health or personal issues; offer catch-up support.',
      student_tip: `You have been absent for ${streak} days in a row. Please contact your teacher, and use Missed Courses to catch up on notes and recordings.`,
    };
  }
  // 4. Performance decline (average per exam date, recent vs earlier)
  const byDate = new Map();
  m.marks.forEach((x) => { const k = String(x.exam_date); (byDate.get(k) || byDate.set(k, []).get(k)).push(x.p); });
  const series = [...byDate.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([, v]) => v.reduce((a, b) => a + b, 0) / v.length);
  if (series.length >= 3) {
    const avgOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const recent = series.length >= 4 ? avgOf(series.slice(-2)) : series.at(-1);
    const prev = series.length >= 4 ? avgOf(series.slice(-4, -2)) : avgOf(series.slice(0, -1));
    const drop = prev - recent;
    if (drop >= 10) {
      out.performance = {
        severity: drop >= 30 ? 'critical' : drop >= 20 ? 'high' : 'medium',
        reason: `Recent assessments average ${r1(recent)}% vs ${r1(prev)}% earlier, a decline of ${r1(drop)} points.`,
        recommended_action: 'Hold a one-to-one review to find causes (workload, health, motivation) and agree on a short improvement target.',
        student_tip: `Your recent scores dropped by about ${Math.round(drop)} points. Revisit the topics you found hard, plan a weekly study schedule and ask for help early.`,
      };
    }
  }
  // 5. Incomplete assignments
  if (m.overdueTasks >= 2) {
    out.assignments = {
      severity: m.overdueTasks >= 6 ? 'critical' : m.overdueTasks >= 4 ? 'high' : 'medium',
      reason: `${m.overdueTasks} assignments are past their due date without submission.`,
      recommended_action: 'Set a firm submission deadline, identify blockers and track completion weekly.',
      student_tip: `You have ${m.overdueTasks} overdue assignments. Submit them as soon as possible and talk to your teacher about extensions.`,
    };
  }
  // 6. Fees overdue
  if (m.fees.length) {
    const total = m.fees.reduce((a, x) => a + x.rem, 0);
    const days = Math.max(...m.fees.map((x) => x.days));
    out.fees = {
      severity: days > 60 ? 'critical' : days > 30 ? 'high' : 'medium',
      reason: `₹${Math.round(total).toLocaleString('en-IN')} overdue across ${m.fees.length} fee item(s); oldest is ${days} days past due.`,
      recommended_action: 'Refer to the accounts office; discuss instalments or scholarship options with the guardian.',
      student_tip: `Fees of ₹${Math.round(total).toLocaleString('en-IN')} are overdue. Pay from the Fees page or contact the accounts office to arrange instalments.`,
    };
  }
  return out;
}

const RULE_LABEL = { attendance: 'Low attendance', marks: 'Low marks', absence: 'Continuous absence', performance: 'Performance decline', assignments: 'Incomplete assignments', fees: 'Overdue fees' };
export const RULES = Object.keys(RULE_LABEL);
export const ruleLabel = (r) => RULE_LABEL[r] || r;

async function recipients(studentId) {
  const t = await rows('SELECT t.user_id FROM teacher_students ts JOIN teachers t ON t.id=ts.teacher_id WHERE ts.student_id=$1', [studentId]);
  if (t.length) return t.map((x) => x.user_id);
  return (await rows("SELECT id AS user_id FROM users WHERE role='admin' AND active")).map((x) => x.user_id);
}

export async function evaluateStudent(studentId) {
  const s = await one('SELECT s.*, u.name FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=$1', [studentId]);
  if (!s) return { created: 0, resolved: 0 };
  const result = evaluate(await metrics(s));
  let created = 0, resolved = 0;
  for (const rule of RULES) {
    const r = result[rule];
    const open = await one("SELECT * FROM alerts WHERE student_id=$1 AND rule=$2 AND status<>'resolved'", [studentId, rule]);
    if (!r) {
      if (open) { await q("UPDATE alerts SET status='resolved', resolved_at=now(), updated_at=now() WHERE id=$1", [open.id]); resolved++; }
      continue;
    }
    if (open) {
      await q('UPDATE alerts SET severity=$1, reason=$2, recommended_action=$3, student_tip=$4, updated_at=now() WHERE id=$5',
        [r.severity, r.reason, r.recommended_action, r.student_tip, open.id]);
      if (RANK[r.severity] > RANK[open.severity]) {
        for (const uid of await recipients(studentId))
          await notify(uid, { title: `Alert escalated: ${s.name}`, message: `${ruleLabel(rule)} is now ${r.severity}. ${r.reason}`, type: 'alert', severity: r.severity, link: '/early-warning' });
      }
      continue;
    }
    // Do not re-raise an alert a staff member manually resolved in the last 7 days unless it got worse.
    const prev = await one(
      "SELECT severity FROM alerts WHERE student_id=$1 AND rule=$2 AND status='resolved' AND resolved_by IS NOT NULL AND resolved_at > now() - interval '7 days' ORDER BY resolved_at DESC LIMIT 1",
      [studentId, rule]);
    if (prev && RANK[r.severity] <= RANK[prev.severity]) continue;
    await q('INSERT INTO alerts (student_id,rule,severity,reason,recommended_action,student_tip) VALUES ($1,$2,$3,$4,$5,$6)',
      [studentId, rule, r.severity, r.reason, r.recommended_action, r.student_tip]);
    created++;
    for (const uid of await recipients(studentId))
      await notify(uid, { title: `${ruleLabel(rule)}: ${s.name} (${s.roll_no})`, message: `${r.reason} Action: ${r.recommended_action}`, type: 'alert', severity: r.severity, link: '/early-warning' });
    await notify(s.user_id, { title: `Heads up: ${ruleLabel(rule)}`, message: r.student_tip, type: 'alert', severity: r.severity, link: '/dashboard' });
  }
  return { created, resolved };
}

export async function evaluateMany(ids) {
  let created = 0, resolved = 0;
  for (const id of ids) { const r = await evaluateStudent(id); created += r.created; resolved += r.resolved; }
  return { created, resolved, students: ids.length };
}
export async function evaluateAll() {
  const ids = (await rows('SELECT id FROM students')).map((x) => x.id);
  return evaluateMany(ids);
}
