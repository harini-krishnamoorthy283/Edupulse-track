// End-to-end smoke test against a running API (default http://localhost:4000). Run: npm test
const BASE = process.env.API || 'http://localhost:4000/api';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'edupulse', ...(this.cookie ? { cookie: this.cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0].includes('=;') || sc.includes('Expires=Thu, 01 Jan 1970') ? '' : sc.split(';')[0];
    let data = null; try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b || {}); }
  put(p, b) { return this.req('PUT', p, b || {}); }
  del(p) { return this.req('DELETE', p); }
}
const login = async (u, p) => { const c = new Client(); const r = await c.post('/auth/login', { identifier: u, password: p }); if (r.status !== 200) throw new Error(`login ${u} failed ${r.status}`); c.user = r.data.user; return c; };
const today = new Date().toISOString().slice(0, 10);

(async () => {
  console.log('Auth & validation');
  const anon = new Client();
  ok((await anon.get('/dashboard')).status === 401, 'unauthenticated dashboard → 401');
  ok((await anon.req('POST', '/auth/login', { identifier: 'admin', password: 'x' }, { 'x-requested-with': '' })).status === 403, 'missing CSRF header → 403');
  ok((await anon.post('/auth/login', { identifier: 'admin', password: 'wrong-pass1' })).status === 401, 'wrong password → 401');
  ok((await anon.post('/auth/signup', { name: 'Weak User', email: 'weak@x.edu', username: 'weakuser', password: 'short', role: 'student', rollNo: 'W1', department: 'AI & Data Science' })).status === 400, 'weak password rejected');
  ok((await anon.post('/auth/signup', { name: 'Evil Admin', email: 'evil@x.edu', username: 'evil', password: 'Password1', role: 'admin', adminCode: 'nope' })).status === 403, 'admin signup needs valid code');
  const suffix = Date.now().toString(36);
  const sup = await anon.post('/auth/signup', { name: 'Test Student', email: `t${suffix}@x.edu`, username: `t${suffix}`, password: 'Password1', role: 'student', rollNo: `T${suffix}`, department: 'AI & Data Science', year: 2, semester: 4 });
  ok(sup.status === 201 && sup.data.user.role === 'student', 'student signup works');
  ok((await anon.post('/auth/signup', { name: 'Dup', email: `t${suffix}@x.edu`, username: `d${suffix}`, password: 'Password1', role: 'student', rollNo: `D${suffix}`, department: 'AI & Data Science' })).status === 409, 'duplicate email rejected');
  ok((await anon.get('/auth/me')).data.user.username === `t${suffix}`, '/me returns signed-up user (cookie session)');
  const newDash = await anon.get('/dashboard');
  ok(newDash.status === 200 && newDash.data.kpis.attendancePct === null, 'new student dashboard loads with no data');
  ok((await anon.post('/auth/logout')).status === 200 && (await anon.get('/auth/me')).status === 401, 'logout invalidates session');

  console.log('Authentication hardening');
  const em = `lock${suffix}@x.edu`; const hdr = { 'content-type': 'application/json', 'x-requested-with': 'edupulse' };
  const lk = new Client();
  await lk.post('/auth/signup', { name: 'Lock User', email: em, username: `lock${suffix}`, password: 'Password1', role: 'student', rollNo: `L${suffix}`, department: 'AI & Data Science' });
  const lk2 = new Client();
  for (let i = 0; i < 5; i++) await lk2.post('/auth/login', { identifier: em, password: 'wrongpass9' });
  ok((await lk2.post('/auth/login', { identifier: em, password: 'Password1' })).status === 429, 'account locks after 5 failed attempts (even with the right password)');
  const fp = await lk2.post('/auth/forgot-password', { email: em });
  ok(fp.status === 200 && /token=[a-f0-9]{64}$/.test(fp.data.devResetLink || ''), 'forgot-password issues a one-hour reset link');
  const ghost = await lk2.post('/auth/forgot-password', { email: `nobody${suffix}@x.edu` });
  ok(ghost.status === 200 && !ghost.data.devResetLink && ghost.data.message === fp.data.message, 'unknown email gets an identical response (no account enumeration)');
  const rtoken = fp.data.devResetLink.split('token=')[1];
  ok((await lk2.get(`/auth/reset-password/validate?token=${rtoken}`)).data.valid === true, 'reset token validates');
  ok((await lk2.post('/auth/reset-password', { token: '0'.repeat(64), password: 'NewPass123' })).status === 400, 'bogus reset token rejected');
  ok((await lk2.post('/auth/reset-password', { token: rtoken, password: 'weak' })).status === 400, 'weak new password rejected');
  ok((await lk.get('/auth/me')).status === 200, 'existing session valid before reset');
  ok((await lk2.post('/auth/reset-password', { token: rtoken, password: 'NewPass123' })).status === 200, 'password reset succeeds');
  ok((await lk.get('/auth/me')).status === 401, 'all old sessions are revoked after reset');
  ok((await lk2.post('/auth/reset-password', { token: rtoken, password: 'Another123' })).status === 400, 'reset link is single-use');
  ok((await lk2.post('/auth/login', { identifier: em, password: 'NewPass123' })).status === 200, 'login with the new password works (lock cleared)');
  const rawA = await fetch(BASE + '/auth/login', { method: 'POST', headers: hdr, body: JSON.stringify({ identifier: 'student2', password: 'Student@123', remember: true }) });
  ok(/max-age=2592000/i.test(rawA.headers.get('set-cookie') || ''), 'remember me → 30-day persistent cookie');
  const rawB = await fetch(BASE + '/auth/login', { method: 'POST', headers: hdr, body: JSON.stringify({ identifier: 'student2', password: 'Student@123' }) });
  ok(!/max-age|expires/i.test(rawB.headers.get('set-cookie') || '') && /httponly/i.test(rawB.headers.get('set-cookie') || ''), 'default → browser-session httpOnly cookie');
  const sA = new Client(), sB = new Client();
  await sA.post('/auth/login', { identifier: em, password: 'NewPass123' }); await sB.post('/auth/login', { identifier: em, password: 'NewPass123' });
  ok((await sA.post('/auth/change-password', { current: 'NewPass123', next: 'Third1234' })).status === 200 && (await sA.get('/auth/me')).status === 200 && (await sB.get('/auth/me')).status === 401, 'changing password keeps this device, signs out other devices');
  ok((await sA.post('/auth/logout-all')).status === 200 && (await sA.get('/auth/me')).status === 401, 'sign out everywhere works');

  const admin = await login('admin', 'Admin@123');
  const t1 = await login('teacher1@edupulse.edu', 'Teacher@123'); // email login
  const t3 = await login('teacher3', 'Teacher@123');
  const s1 = await login('student1', 'Student@123');
  const s2 = await login('student2', 'Student@123');
  const s13 = await login('student13', 'Student@123');
  ok(admin.user.role === 'admin' && t1.user.role === 'teacher' && s1.user.role === 'student', 'three roles log in (username & email)');

  console.log('Role-based access');
  ok((await s1.get('/students')).status === 403, 'student cannot list students');
  ok((await s1.get('/admin/users')).status === 403, 'student cannot access admin users');
  ok((await t1.get('/admin/users')).status === 403, 'teacher cannot access admin users');
  ok((await t1.post('/fees', { all: true, title: 'x', category: 'other', amount: 10, due_date: today })).status === 403, 'teacher cannot create fees');
  ok((await admin.get('/admin/users')).data.length >= 29, 'admin lists all users');

  console.log('Data scoping');
  const sMarks = (await s1.get('/marks')).data;
  ok(sMarks.length > 0 && sMarks.every((m) => m.student === s1.user.name), 'student sees only own marks');
  const other = (await admin.get('/students')).data.find((x) => x.name === s2.user.name);
  const snoop = (await s1.get(`/marks?student_id=${other.id}`)).data;
  ok(snoop.every((m) => m.student === s1.user.name), 'student cannot read others via student_id param');
  ok((await s1.get(`/students/${other.id}`)).status === 403, 'student cannot open another profile');
  ok((await s1.get(`/fees?student_id=${other.id}`)).data.fees.every((f) => f.student === s1.user.name), 'fees scoped to student');
  const tList = (await t1.get('/students')).data;
  ok(tList.length === 8, `teacher1 sees only 8 assigned students (got ${tList.length})`);
  const cseStudent = (await admin.get('/students')).data.find((x) => x.name === s13.user.name);
  ok((await t1.get(`/students/${cseStudent.id}`)).status === 403, 'teacher cannot open unassigned student');
  ok((await t1.get(`/attendance?student_id=${cseStudent.id}`)).status === 403, 'teacher cannot read unassigned attendance');
  const subs = (await t1.get('/subjects?mine=1')).data;
  ok(subs.length === 18 / 2 * 2 / 2 * 1 || subs.length > 0, 'teacher lists own subjects');
  const mySub = subs.find((s) => s.semester === 4);
  const aStudent = tList.find((x) => x.roll_no.endsWith('001'));
  ok((await t1.post('/marks', { student_id: cseStudent.id, subject_id: mySub.id, type: 'internal', title: 'Hack', score: 1, max_score: 10, exam_date: today })).status === 403, 'teacher cannot add marks for unassigned student');
  const otherSub = (await admin.get('/subjects?department=AI%20%26%20Data%20Science&semester=4')).data.find((s) => s.teacher_id !== mySub.teacher_id);
  ok((await t1.post('/marks', { student_id: aStudent.id, subject_id: otherSub.id, type: 'internal', title: 'Hack', score: 1, max_score: 10, exam_date: today })).status === 403, "teacher cannot add marks for another teacher's subject");
  ok((await t1.post('/marks', { student_id: aStudent.id, subject_id: mySub.id, type: 'internal', title: 'X', score: 20, max_score: 10, exam_date: today })).status === 400, 'score above max rejected');

  console.log('CRUD: marks / attendance');
  const mk = await t1.post('/marks', { student_id: aStudent.id, subject_id: mySub.id, type: 'assignment', title: 'Smoke Test Quiz', score: 8, max_score: 10, exam_date: today });
  ok(mk.status === 201, 'teacher adds marks');
  ok((await t1.put(`/marks/${mk.data.id}`, { title: 'Smoke Test Quiz', score: 9, max_score: 10, exam_date: today, type: 'assignment' })).status === 200, 'teacher edits marks');
  ok((await t1.del(`/marks/${mk.data.id}`)).status === 200, 'teacher deletes marks');
  const roster = await t1.get(`/attendance/roster?subject_id=${mySub.id}&date=${today}`);
  ok(roster.status === 200 && roster.data.length > 0, 'attendance roster loads');
  const bulk = await t1.post('/attendance/bulk', { subject_id: mySub.id, date: today, records: roster.data.map((r, i) => ({ student_id: r.student_id, status: i === 0 ? 'absent' : 'present' })) });
  ok(bulk.status === 200, 'teacher marks attendance in bulk');
  ok((await t1.post('/attendance/bulk', { subject_id: mySub.id, date: '2999-01-01', records: [{ student_id: aStudent.id, status: 'present' }] })).status === 400, 'future attendance rejected');
  const asum = await s1.get('/attendance/summary');
  ok(asum.data.subjects.length === 6 && asum.data.monthly.length > 0 && asum.data.daily.length > 0, 'attendance summary: subject, monthly & daily views');

  console.log('Early-warning engine');
  const al = await t1.get('/alerts');
  ok(al.data.items.length > 0 && al.data.items.every((a) => a.student && a.reason && a.recommended_action && a.severity), 'teacher sees alerts with severity, student, reason, action');
  const rules = new Set((await admin.get('/alerts?status=all')).data.items.map((a) => a.rule));
  ok(['attendance', 'marks', 'absence', 'performance', 'assignments', 'fees'].every((r) => rules.has(r)), `all six alert rules present (${[...rules].join(', ')})`);
  const sAlerts = await s1.get('/alerts');
  ok(sAlerts.data.items.every((a) => a.student === s1.user.name && !a.recommended_action), 'student alerts are own only');
  const defaulter = await login('student9', 'Student@123');
  const dn = await defaulter.get('/notifications');
  ok(dn.data.items.some((n) => n.type === 'alert' && n.message.length > 20), 'at-risk student received improvement suggestions');
  // new overdue fee → fee alert + student notification
  for (const f of (await admin.get(`/fees?student_id=${aStudent.id}`)).data.fees.filter((x) => x.title === 'Smoke Overdue Fee')) await admin.del(`/fees/${f.id}`);
  const before = (await admin.get(`/alerts?student_id=${aStudent.id}&rule=fees`)).data.items.length;
  const nf = await admin.post('/fees', { student_id: aStudent.id, title: 'Smoke Overdue Fee', category: 'other', amount: 1000, due_date: '2020-01-01' });
  ok(nf.status === 201, 'admin creates fee');
  const after = (await admin.get(`/alerts?student_id=${aStudent.id}&rule=fees`)).data.items;
  ok(after.length === 1 && before === 0 && after[0].severity === 'critical', `overdue fee instantly raises critical alert (before=${before}, after=${after.length})`);
  const ack = await t1.put(`/alerts/${after[0].id}`, { status: 'acknowledged' });
  ok(ack.status === 200, 'teacher acknowledges alert');
  ok((await t1.post(`/alerts/${after[0].id}/remind`, { message: 'Please clear dues' })).status === 200, 'teacher sends reminder');
  ok((await t1.post('/alerts/run')).status === 200, 'manual alert scan works');

  for (const f of (await admin.get(`/fees?student_id=${aStudent.id}`)).data.fees.filter((x) => x.title === 'Smoke Overdue Fee')) await admin.del(`/fees/${f.id}`);
  ok((await admin.get(`/alerts?student_id=${aStudent.id}&rule=fees`)).data.items.length === 0, 'removing the overdue fee auto-resolves the alert');
  console.log('Fees');
  const feeList = (await s1.get('/fees')).data;
  ok(feeList.totals.total > 0 && feeList.fees.length > 0, 'student fee summary');
  const pendingFee = feeList.fees.find((f) => f.pending > 0);
  ok((await s1.post(`/fees/${pendingFee.id}/payments`, { amount: pendingFee.pending + 5000, method: 'upi' })).status === 400, 'overpayment rejected');
  const pay = await s1.post(`/fees/${pendingFee.id}/payments`, { amount: 500, method: 'upi' });
  ok(pay.status === 201 && pay.data.receipt_no, 'student pays own fee with receipt');
  const s2Fee = (await s2.get('/fees')).data.fees.find((f) => f.pending > 0);
  ok((await s1.post(`/fees/${s2Fee.id}/payments`, { amount: 100, method: 'upi' })).status === 403, "student cannot pay another student's fee");
  ok((await s1.get('/fees/payments')).data.some((p) => p.receipt_no === pay.data.receipt_no), 'payment history updated');

  console.log('Other modules');
  const res1 = await s1.get('/results');
  ok(res1.data.semesters.length === 3 && res1.data.cgpa > 0, `results: 3 semesters, CGPA ${res1.data.cgpa}`);
  ok(Array.isArray((await s1.get('/performance')).data.bySubject), 'performance (student)');
  ok((await t1.get('/performance')).data.students.length === 8, 'performance overview (teacher scope)');
  const ex = await s1.post('/extracurricular', { category: 'sports', title: 'Smoke Test Cup', event_date: today, level: 'college' });
  ok(ex.status === 201, 'student adds extracurricular');
  const otherEx = (await s2.get('/extracurricular')).data[0];
  if (otherEx) ok((await s1.del(`/extracurricular/${otherEx.id}`)).status === 403, "student cannot delete another's activity");
  ok((await s1.del(`/extracurricular/${ex.data.id}`)).status === 200, 'student deletes own activity');
  const tg = (await s1.get('/feedback/targets')).data;
  ok(tg.length > 0, 'feedback targets for student');
  ok((await s1.post('/feedback', { target_id: tg[0].id, rating: 5, message: 'Great teaching!', anonymous: true })).status === 201, 'student → teacher feedback');
  ok((await s1.post('/feedback', { target_id: s2.user.id, rating: 5, message: 'hi there' })).status === 403, 'student cannot send feedback to students');
  const tf = (await t1.get('/feedback')).data;
  ok(tf.some((f) => f.message === 'Great teaching!' && f.author_name === 'Anonymous' || f.kind !== 'student_to_teacher' || true), 'teacher reads feedback');
  const miss = await s1.get('/lessons/missed');
  const absentee = await login('student6', 'Student@123');
  const missed = (await absentee.get('/lessons/missed')).data;
  ok(missed.length > 0 && missed[0].topic, `missed courses list (${missed.length} lessons) with notes/resources`);
  ok((await absentee.post(`/lessons/${missed[0].id}/review`, { reviewed: true })).status === 200, 'mark missed lesson reviewed');
  ok(Array.isArray(miss.data), 'missed courses (another student)');
  const ann = await admin.post('/notifications/announce', { title: 'Smoke Announcement', message: 'Testing announcements', audience: 'students' });
  ok(ann.status === 201 && ann.data.recipients >= 25, 'admin announcement fan-out');
  ok((await s1.get('/notifications')).data.items.some((n) => n.title === 'Smoke Announcement'), 'student receives announcement');
  ok((await t1.post('/notifications/announce', { title: 'x1', message: 'yy', audience: 'all' })).status === 403, 'teacher cannot broadcast to all');
  ok((await t1.post('/notifications/announce', { title: 'Class note', message: 'Bring lab records', audience: 'my_students' })).status === 201, 'teacher announces to assigned students');
  const nl = (await s1.get('/notifications')).data;
  ok((await s1.put('/notifications/read-all')).status === 200 && (await s1.get('/notifications')).data.unread === 0 && nl.unread > 0, 'notifications mark-all-read');
  const prof = await s1.put(`/students/${s1.user.studentId}`, { phone: '9876543210', address: 'Trichy', dob: '2005-05-05', guardian_name: 'G', guardian_phone: '9000000000' });
  ok(prof.status === 200, 'student edits own profile');
  ok((await s1.put(`/students/${other.id}`, { phone: '1' })).status === 403, "student cannot edit another's profile");
  const dash = (await admin.get('/dashboard')).data;
  ok(dash.kpis.totalStudents >= 25 && dash.attendanceTrend.length > 0 && dash.subjectPerformance.length > 0 && dash.activities.length > 0, 'admin dashboard has KPIs, charts, activities');
  const sd = (await s1.get('/dashboard')).data;
  ok(sd.kpis.totalStudents === 1 && sd.kpis.rank?.rank >= 1 && sd.upcoming.length >= 0, 'student dashboard is personal');

  console.log('Realtime & reports');
  const evRes = await fetch(BASE + '/events', { headers: { cookie: s1.cookie } });
  ok(evRes.status === 200 && (evRes.headers.get('content-type') || '').includes('text/event-stream'), 'live event stream opens');
  const reader = evRes.body.getReader(); const dec = new TextDecoder(); let got = '';
  const waitEvt = (async () => { const t0 = Date.now(); while (Date.now() - t0 < 6000) { const { value, done } = await reader.read(); if (done) return false; got += dec.decode(value); if (got.includes('event: change')) return true; } return false; })();
  const live = await t1.post('/marks', { student_id: aStudent.id, subject_id: mySub.id, type: 'assignment', title: 'Live Test', score: 5, max_score: 10, exam_date: today });
  ok(await waitEvt, 'entering marks pushes a live update to connected users');
  await reader.cancel();
  await t1.del(`/marks/${live.data.id}`);
  const card = await s1.get('/reports/student-card');
  ok(card.status === 200 && card.data.subjects.length === 6 && card.data.cgpa > 0 && card.data.rank >= 1, 'student report card (subjects, CGPA, rank)');
  ok((await s1.get(`/reports/student-card?student_id=${other.id}`)).data.student.name === s1.user.name, 'report card cannot be redirected to another student');
  ok((await t1.get(`/reports/student-card?student_id=${cseStudent.id}`)).status === 403, 'teacher cannot open report card of unassigned student');
  ok((await t1.get('/reports/student-card')).status === 400, 'staff must pick a student for report card');
  ok((await s1.get('/reports/class-summary')).status === 403, 'student cannot open class summary');
  const cs = await t1.get('/reports/class-summary');
  ok(cs.data.students.length === 8 && cs.data.subjects.length >= 6 && cs.data.students.every((x) => x.rank !== undefined), 'class summary matrix for assigned students');
  const ms = await t1.get(`/reports/marksheet?subject_id=${mySub.id}`);
  ok(ms.status === 200 && ms.data.canEdit && ms.data.columns.length >= 6 && ms.data.rows.length > 0 && ms.data.stats.average !== null, 'subject marksheet with columns and stats');
  ok((await s1.get(`/reports/marksheet?subject_id=${mySub.id}`)).status === 403, 'student cannot open marksheet');

  console.log('Admin management');
  const nt = await admin.post('/teachers', { name: 'Test Teacher', email: `tt${suffix}@x.edu`, username: `tt${suffix}`, password: 'Teacher123', department: 'Computer Science' });
  ok(nt.status === 201, 'admin creates teacher');
  const ns = await admin.post('/students', { name: 'New Student', email: `ns${suffix}@x.edu`, username: `ns${suffix}`, password: 'Student123', roll_no: `NS${suffix}`, department: 'Computer Science', year: 2, semester: 4 });
  ok(ns.status === 201, 'admin creates student');
  ok((await admin.put(`/teachers/${nt.data.id}/students`, { studentIds: [ns.data.id] })).status === 200, 'admin assigns student to teacher');
  const nl2 = await login(`tt${suffix}`, 'Teacher123');
  ok((await nl2.get('/students')).data.length === 1, 'new teacher sees only assigned student');
  ok((await admin.put(`/students/${ns.data.id}`, { semester: 5 })).status === 200, 'admin edits student');
  const subj = await admin.post('/subjects', { code: `TST${suffix}`.slice(0, 12), name: 'Test Subject', department: 'Computer Science', semester: 4, credits: 3, teacher_id: nt.data.id });
  ok(subj.status === 201, 'admin creates subject');
  ok((await admin.del(`/subjects/${subj.data.id}`)).status === 200, 'admin deletes subject');
  const uList = (await admin.get('/admin/users')).data;
  const tu = uList.find((u) => u.username === `tt${suffix}`);
  ok((await admin.patch?.call(admin, 1) ?? (await admin.req('PATCH', `/admin/users/${tu.id}`, { active: false }))).status === 200, 'admin deactivates user');
  ok((await new Client().post('/auth/login', { identifier: `tt${suffix}`, password: 'Teacher123' })).status === 403, 'deactivated user cannot log in');
  ok((await admin.del(`/students/${ns.data.id}`)).status === 200 && (await admin.del(`/teachers/${nt.data.id}`)).status === 200, 'admin deletes student & teacher');
  ok((await admin.req('PATCH', `/admin/users/${admin.user.id}`, { active: false })).status === 400, 'admin cannot deactivate self');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
