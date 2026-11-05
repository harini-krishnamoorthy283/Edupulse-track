import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool, migrate, bulkInsert, rows } from './db.js';
import { evaluateAll } from './alerts.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(2026);
const pick = (a) => a[Math.floor(R() * a.length)];
const d = (off) => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const DEPTS = [{ name: 'AI & Data Science', code: 'AD', pre: 'AIDS' }, { name: 'Computer Science', code: 'CS', pre: 'CSE' }];
const SEM_SUBJECTS = {
  1: ['Engineering Mathematics I', 'Engineering Physics', 'Problem Solving with Python', 'Basic Electrical Engineering', 'Communicative English', 'Engineering Graphics'],
  2: ['Engineering Mathematics II', 'Engineering Chemistry', 'Data Structures', 'Digital Logic Design', 'Environmental Science', 'Programming in C'],
  3: ['Discrete Mathematics', 'Object Oriented Programming', 'Database Management Systems', 'Computer Organization', 'Probability and Statistics', 'Operating Systems'],
  4: ['Design and Analysis of Algorithms', 'Machine Learning', 'Computer Networks', 'Software Engineering', 'Theory of Computation', 'Design Thinking'],
};
const TOPICS = [['Asymptotic notation', 'Divide and conquer', 'Greedy strategies', 'Dynamic programming', 'Graph traversals', 'Shortest paths', 'NP completeness'],
  ['Linear regression', 'Logistic regression', 'Decision trees', 'Ensemble methods', 'Neural networks', 'Model evaluation', 'Clustering'],
  ['OSI model', 'IP addressing', 'Routing algorithms', 'Transport layer', 'TCP congestion control', 'Application protocols', 'Network security'],
  ['SDLC models', 'Requirement analysis', 'UML design', 'Testing strategies', 'Agile and Scrum', 'Project estimation', 'Maintenance'],
  ['Finite automata', 'Regular expressions', 'Context-free grammars', 'Pushdown automata', 'Turing machines', 'Decidability', 'Complexity classes'],
  ['Empathy mapping', 'Problem definition', 'Ideation techniques', 'Prototyping', 'User testing', 'Storyboarding', 'Pitching solutions']];
const NAMES = ['Aarav Krishnan', 'Diya Raman', 'Karthik Subramanian', 'Meera Lakshmi', 'Nikhil Anand', 'Priya Dharshini', 'Rahul Venkatesh', 'Sneha Murugan', 'Vignesh Kumar', 'Ananya Iyer', 'Harish Balaji', 'Kavya Sundaram',
  'Arjun Natarajan', 'Bhavana Selvam', 'Charan Prakash', 'Deepika Rajan', 'Eshwar Mohan', 'Fathima Rizwana', 'Gokul Nathan', 'Hemalatha Senthil', 'Ishaan Gopal', 'Janani Ravi', 'Kishore Pandian', 'Lavanya Chandran'];
// Student behaviour profiles — each exercises a different early-warning rule.
const PROFILES = ['strong', 'strong', 'average', 'average', 'lowAttendance', 'absentStreak', 'declining', 'missingAssignments', 'feeDefaulter', 'lowMarks', 'average', 'good'];

export async function seed() {
  await migrate();
  await pool.query('TRUNCATE users,students,teachers,subjects,teacher_students,attendance,marks,tasks,task_submissions,results,extracurriculars,feedback,fees,fee_payments,lessons,lesson_progress,notifications,alerts,activities RESTART IDENTITY CASCADE');
  const H = (p) => bcrypt.hashSync(p, 10);
  const hAdmin = H('Admin@123'), hTeacher = H('Teacher@123'), hStudent = H('Student@123');
  const userRow = async (name, email, username, hash, role) => (await pool.query('INSERT INTO users (name,email,username,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name, email, username, hash, role])).rows[0].id;

  const adminId = await userRow('Dr. R. Sundaram (Admin)', 'admin@edupulse.edu', 'admin', hAdmin, 'admin');

  // Teachers
  const teacherDefs = [['Dr. Lakshmi Narayanan', 0, 'Professor'], ['Mr. Arun Prasad', 0, 'Assistant Professor'], ['Mrs. Revathi Gopal', 1, 'Associate Professor'], ['Mr. Suresh Babu', 1, 'Assistant Professor']];
  const teachers = [];
  for (let i = 0; i < teacherDefs.length; i++) {
    const [name, di, desig] = teacherDefs[i];
    const uid = await userRow(name, `teacher${i + 1}@edupulse.edu`, `teacher${i + 1}`, hTeacher, 'teacher');
    const t = (await pool.query('INSERT INTO teachers (user_id,department,designation,phone) VALUES ($1,$2,$3,$4) RETURNING id', [uid, DEPTS[di].name, desig, `98400${10000 + i * 111}`])).rows[0].id;
    teachers.push({ id: t, userId: uid, dept: di });
  }

  // Subjects (semesters 1-4 per department)
  const subjects = {}; // `${dept}-${sem}` -> [{id,name,code,credits,teacherId}]
  for (let di = 0; di < DEPTS.length; di++) {
    const dTeachers = teachers.filter((t) => t.dept === di);
    for (let sem = 1; sem <= 4; sem++) {
      subjects[`${di}-${sem}`] = [];
      for (let k = 0; k < 6; k++) {
        const teacher = dTeachers[k < 3 ? 0 : 1];
        const code = `${DEPTS[di].pre}${sem}${String(k + 1).padStart(2, '0')}`;
        const credits = k === 5 ? 2 : k < 3 ? 4 : 3;
        const id = (await pool.query('INSERT INTO subjects (code,name,department,semester,credits,teacher_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [code, SEM_SUBJECTS[sem][k], DEPTS[di].name, sem, credits, teacher.id])).rows[0].id;
        subjects[`${di}-${sem}`].push({ id, code, name: SEM_SUBJECTS[sem][k], credits, teacherId: teacher.id });
      }
    }
  }

  // Students
  const students = [];
  for (let di = 0; di < 2; di++) for (let k = 0; k < 12; k++) {
    const n = di * 12 + k + 1;
    const name = NAMES[n - 1];
    const uid = await userRow(name, `student${n}@edupulse.edu`, `student${n}`, hStudent, 'student');
    const roll = `EDUP24${DEPTS[di].code}${String(k + 1).padStart(3, '0')}`;
    const sid = (await pool.query('INSERT INTO students (user_id,roll_no,department,year,semester,section,phone,address,dob,guardian_name,guardian_phone) VALUES ($1,$2,$3,2,4,$4,$5,$6,$7,$8,$9) RETURNING id',
      [uid, roll, DEPTS[di].name, k < 6 ? 'A' : 'B', `9444${String(100000 + n * 137).slice(0, 6)}`, `${10 + n}, Anna Nagar, Tiruchirappalli, Tamil Nadu`, `200${4 + (k % 2)}-0${1 + (k % 9)}-1${k % 9}`, `Mr. ${name.split(' ')[1]} Sr.`, `9840${String(200000 + n * 311).slice(0, 6)}`])).rows[0].id;
    students.push({ id: sid, userId: uid, di, k, name, profile: PROFILES[k], base: { strong: 86, good: 76, average: 66, lowAttendance: 58, absentStreak: 70, declining: 80, missingAssignments: 68, feeDefaulter: 69, lowMarks: 36 }[PROFILES[k]] });
  }

  // Teacher-student assignments
  const assign = [];
  students.forEach((s) => {
    const dT = teachers.filter((t) => t.dept === s.di);
    if (s.k < 8) assign.push([dT[0].id, s.id]);
    if (s.k >= 4) assign.push([dT[1].id, s.id]);
  });
  await bulkInsert('teacher_students', ['teacher_id', 'student_id'], assign);

  // Attendance + lessons
  const dates = []; for (let o = -56; o <= -1; o++) { const day = new Date(d(o)).getUTCDay(); if (day !== 0 && day !== 6) dates.push(d(o)); }
  const att = [], lessons = [];
  for (let di = 0; di < 2; di++) {
    const subs = subjects[`${di}-4`];
    dates.forEach((date, idx) => subs.forEach((sub, si) => {
      if ((idx + si) % 2 !== 0) return;
      const ti = Math.floor(idx / 2);
      const topic = TOPICS[si][ti % TOPICS[si].length];
      lessons.push([sub.id, date, `${topic} — Part ${Math.floor(ti / TOPICS[si].length) + 1}`, `Key points: definitions, worked examples and practice questions on ${topic.toLowerCase()}. Refer to the textbook chapter and attempt the exercise set before the next class.`,
        `https://www.youtube.com/results?search_query=${encodeURIComponent(sub.name + ' ' + topic)}`, `https://nptel.ac.in/courses`, teachers.find((t) => t.id === sub.teacherId).userId]);
      students.filter((s) => s.di === di).forEach((s) => {
        let p = { strong: 0.97, good: 0.93, average: 0.89, lowAttendance: 0.58, absentStreak: 0.92, declining: 0.9, missingAssignments: 0.9, feeDefaulter: 0.9, lowMarks: 0.86 }[s.profile];
        let present = R() < p;
        if (s.profile === 'absentStreak' && idx >= dates.length - 6) present = false;
        att.push([s.id, sub.id, date, present ? (R() < 0.04 ? 'late' : 'present') : 'absent', teachers.find((t) => t.id === sub.teacherId).userId]);
      });
    }));
  }
  await bulkInsert('attendance', ['student_id', 'subject_id', 'date', 'status', 'marked_by'], att);
  await bulkInsert('lessons', ['subject_id', 'lesson_date', 'topic', 'notes', 'video_url', 'resource_url', 'created_by'], lessons);

  // Marks (current semester)
  const EXAMS = [['CAT 1', 'internal', 50, -49], ['Assignment 1', 'assignment', 20, -35], ['CAT 2', 'internal', 50, -28], ['Assignment 2', 'assignment', 20, -14], ['CAT 3', 'internal', 50, -7], ['Model Exam', 'semester', 100, -3]];
  const marks = [];
  students.forEach((s) => subjects[`${s.di}-4`].forEach((sub, si) => EXAMS.forEach(([title, type, max, off], ei) => {
    let pct = s.base + (R() - 0.5) * 14 + (si % 3 === 0 ? 3 : 0);
    if (s.profile === 'declining') pct = 84 - ei * 8.5 + (R() - 0.5) * 6;
    if (s.profile === 'lowMarks' && si === 1) pct -= 6;
    pct = clamp(pct, 8, 99);
    marks.push([s.id, sub.id, type, title, Math.round((pct / 100) * max), max, d(off), 4]);
  })));
  await bulkInsert('marks', ['student_id', 'subject_id', 'type', 'title', 'score', 'max_score', 'exam_date', 'semester'], marks);

  // Assignment tasks + submissions
  const taskRows = [];
  for (let di = 0; di < 2; di++) subjects[`${di}-4`].forEach((sub, si) => {
    taskRows.push([sub.id, `${sub.name}: Problem Set 1`, 'Solve all questions and upload the answer sheet.', d(-30), teachers.find((t) => t.id === sub.teacherId).userId]);
    taskRows.push([sub.id, `${sub.name}: Mini Project Report`, 'Submit the report with references.', d(-10), teachers.find((t) => t.id === sub.teacherId).userId]);
    if (si < 3) taskRows.push([sub.id, `${sub.name}: Case Study`, 'Group case study write-up (2 pages).', d(7 + si * 3), teachers.find((t) => t.id === sub.teacherId).userId]);
  });
  await bulkInsert('tasks', ['subject_id', 'title', 'description', 'due_date', 'created_by'], taskRows);
  const tasks = await rows('SELECT t.id,t.due_date,sub.department FROM tasks t JOIN subjects sub ON sub.id=t.subject_id ORDER BY t.id');
  const subs = [];
  students.forEach((s) => tasks.filter((t) => t.department === DEPTS[s.di].name).forEach((t, i) => {
    const overdue = t.due_date < d(0);
    if (overdue) {
      if (s.profile === 'missingAssignments' && i % 4 !== 0) return;
      subs.push([t.id, s.id, 'submitted']);
    } else if (R() < 0.3) subs.push([t.id, s.id, 'submitted']);
  }));
  await bulkInsert('task_submissions', ['task_id', 'student_id', 'status'], subs);

  // Results for semesters 1-3
  const GRADES = (p) => (p >= 90 ? 'O' : p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'B+' : p >= 50 ? 'B' : p >= 40 ? 'C' : 'F');
  const results = [];
  students.forEach((s) => { for (let sem = 1; sem <= 3; sem++) subjects[`${s.di}-${sem}`].forEach((sub) => results.push([s.id, sub.id, sem, GRADES(clamp(s.base + 4 + (R() - 0.5) * 24, 20, 99))])); });
  await bulkInsert('results', ['student_id', 'subject_id', 'semester', 'grade'], results);

  // Fees + payments
  const feeRows = [];
  students.forEach((s) => feeRows.push([s.id, 'Tuition Fee – Semester 3', 'tuition', 42000, d(-200)], [s.id, 'Tuition Fee – Semester 4', 'tuition', 45000, d(-70)], [s.id, 'Exam Fee – Semester 4', 'exam', 3500, d(-20)], [s.id, 'Library & Transport', 'transport', 6000, d(25)]));
  await bulkInsert('fees', ['student_id', 'title', 'category', 'amount', 'due_date'], feeRows);
  const fees = await rows('SELECT id,student_id,title,amount FROM fees ORDER BY id');
  const pays = []; let rc = 1;
  const rec = () => `EDP-DEMO-${String(rc++).padStart(5, '0')}`;
  fees.forEach((f) => {
    const s = students.find((x) => x.id === f.student_id);
    const method = pick(['upi', 'card', 'netbanking']);
    if (f.title.includes('Semester 3')) pays.push([f.id, f.amount, d(-208), method, rec()]);
    else if (f.title.includes('Tuition Fee – Semester 4')) {
      if (s.profile === 'feeDefaulter') return;
      pays.push([f.id, f.amount, d(-75 + Math.floor(R() * 8)), method, rec()]);
    } else if (f.title.includes('Exam')) {
      if (s.profile === 'lowAttendance') return;
      pays.push([f.id, f.amount, d(-30 + Math.floor(R() * 8)), method, rec()]);
    } else if (R() < 0.3) pays.push([f.id, 3000, d(-3), method, rec()]);
  });
  await bulkInsert('fee_payments', ['fee_id', 'amount', 'paid_on', 'method', 'receipt_no'], pays);

  // Extracurricular
  const EX = [['sports', 'Inter-college Cricket Tournament', 'inter-college', 'Runners-up'], ['sports', 'Chess Championship', 'college', 'Winner'], ['sports', 'Zonal Athletics Meet – 400m', 'state', 'Bronze medal'], ['event', 'Annual Tech Fest – Volunteer', 'college', 'Participant'],
    ['event', 'Hackathon: Smart Campus', 'inter-college', 'Finalist'], ['competition', 'Paper Presentation – IEEE Student Chapter', 'inter-college', 'First prize'], ['competition', 'Coding Contest – CodeSprint', 'college', 'Rank 3'], ['achievement', 'NPTEL Certification – Elite', 'national', 'Elite + Silver'],
    ['achievement', 'Best Outgoing Volunteer – NSS', 'college', 'Awarded'], ['event', 'Cultural Fest – Dance', 'college', 'Participant']];
  const ex = [];
  students.forEach((s, i) => { const n = s.profile === 'strong' || s.profile === 'good' ? 4 : i % 3; for (let j = 0; j < n; j++) { const e = EX[(i * 3 + j) % EX.length]; ex.push([s.id, e[0], e[1], `${e[1]} — participated as part of the college team.`, e[2], e[3], d(-10 - j * 25 - (i % 7) * 4), students[i].userId]); } });
  await bulkInsert('extracurriculars', ['student_id', 'category', 'title', 'description', 'level', 'result', 'event_date', 'created_by'], ex);

  // Feedback
  const fb = [];
  students.slice(0, 10).forEach((s, i) => { const t = teachers.filter((x) => x.dept === s.di)[i % 2]; fb.push([s.userId, t.userId, 'student_to_teacher', 3 + (i % 3), i % 4 === 0, pick(['Explains concepts clearly with good examples.', 'Please share slides before class.', 'Very supportive during doubt sessions.', 'Pace is slightly fast in the practical sessions.'])]); });
  teachers.forEach((t, i) => { const s = students.find((x) => x.di === t.dept && x.k === 6 + (i % 2) * 0); fb.push([t.userId, s.userId, 'teacher_to_student', null, false, 'Good potential — focus on revision consistency and submit assignments on time.']); });
  await bulkInsert('feedback', ['author_id', 'target_id', 'kind', 'rating', 'anonymous', 'message'], fb);

  // Announcements + activities
  const allUsers = await rows("SELECT id FROM users WHERE role<>'admin'");
  await bulkInsert('notifications', ['user_id', 'title', 'message', 'type', 'link'], allUsers.flatMap((u) => [
    [u.id, 'Welcome to EduPulse', 'Track attendance, marks, fees and more in one place.\n— Administration', 'announcement', '/dashboard'],
    [u.id, 'Model exam results published', 'Model exam marks are now available under Marks and Performance.\n— Examination Cell', 'announcement', '/marks'],
    [u.id, 'Reminder: Semester 4 exam fee', 'Please clear pending exam fees before the hall-ticket date.', 'reminder', '/fees'],
  ]));
  await bulkInsert('activities', ['user_id', 'student_id', 'action', 'detail', 'created_at'], [
    [adminId, null, 'announcement', 'Sent "Model exam results published" to all users', new Date(Date.now() - 2 * 36e5).toISOString()],
    [teachers[0].userId, null, 'marks_added', 'Model Exam: marks entered for AI & DS students', new Date(Date.now() - 5 * 36e5).toISOString()],
    [teachers[2].userId, null, 'attendance_marked', 'Marked attendance for Computer Networks', new Date(Date.now() - 26 * 36e5).toISOString()],
    [adminId, null, 'fee_created', 'Fee "Library & Transport" added for 24 student(s)', new Date(Date.now() - 48 * 36e5).toISOString()],
  ]);

  const r = await evaluateAll();
  console.log(`Seed complete. Alerts generated: ${r.created}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
