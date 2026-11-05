CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  year INT NOT NULL DEFAULT 1,
  semester INT NOT NULL DEFAULT 1,
  section TEXT DEFAULT 'A',
  phone TEXT, address TEXT, dob DATE, guardian_name TEXT, guardian_phone TEXT
);
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  designation TEXT DEFAULT 'Assistant Professor',
  phone TEXT
);
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  semester INT NOT NULL,
  credits INT NOT NULL DEFAULT 3,
  teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS teacher_students (
  teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, student_id)
);
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late')),
  marked_by INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (student_id, subject_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id, date);
CREATE TABLE IF NOT EXISTS marks (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('internal','assignment','semester')),
  title TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0),
  max_score NUMERIC NOT NULL DEFAULT 100 CHECK (max_score > 0),
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  semester INT
);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id, exam_date);
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS task_submissions (
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','late','pending')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (task_id, student_id)
);
CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('O','A+','A','B+','B','C','F')),
  UNIQUE (student_id, subject_id)
);
CREATE TABLE IF NOT EXISTS extracurriculars (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('sports','event','competition','achievement')),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT DEFAULT 'college',
  result TEXT,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fees (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tuition',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fee_payments (
  id SERIAL PRIMARY KEY,
  fee_id INT NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'upi',
  receipt_no TEXT NOT NULL UNIQUE,
  recorded_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  topic TEXT NOT NULL,
  notes TEXT, video_url TEXT, resource_url TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons(subject_id, lesson_date);
CREATE TABLE IF NOT EXISTS lesson_progress (
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('alert','reminder','announcement','info')),
  severity TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  reason TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  student_tip TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_active ON alerts(student_id, rule) WHERE status <> 'resolved';
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_act_created ON activities(created_at DESC);

-- Authentication hardening
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
