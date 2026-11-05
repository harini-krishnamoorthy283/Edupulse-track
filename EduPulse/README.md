# EduPulse – Smart Student Monitoring System

React + Tailwind (client) · Node/Express (server) · PostgreSQL

**Get a public website link: see [DEPLOY.md](DEPLOY.md).**

## Run
```bash
# 1. PostgreSQL: create a database and user
createdb krconnect            # or: psql -c "CREATE DATABASE krconnect;"

# 2. Configure
cp server/.env.example server/.env     # edit DATABASE_URL, JWT_SECRET, ADMIN_SIGNUP_CODE
cp client/.env.example client/.env

# 3. Install & start
npm run install:all
npm run dev:server        # API on :4000 (creates tables; seeds demo data on first run)
npm run dev:client        # UI on :5173

# Production: npm run build && NODE_ENV=production npm start   (Express serves client/dist)
```

## Demo accounts (sample data)
| Role | Login | Password |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| Teacher | `teacher1` … `teacher4` | `Teacher@123` |
| Student | `student1` … `student24` | `Student@123` |

Re-seed: `npm run seed` (wipes data). Disable auto-seed with `AUTO_SEED=false`; hide demo buttons with `VITE_SHOW_DEMO=false`.

## Real-time & reports
- **Live updates:** the server streams change signals (Server-Sent Events, `/api/events`). When anyone enters marks, marks attendance,
  records a payment, etc., every open dashboard, table, chart, alert list and the notification bell refresh instantly (green **Live** badge in the top bar).
- **Live gradebook** (Reports → Live gradebook, also under Marks): spreadsheet-style grid per subject. Type a score, press Enter/Tab → saved,
  alerts re-evaluated and everyone's screens update. Add new assessment columns, export CSV.
- **Reports:** student report card (print / save as PDF / CSV), class summary matrix with ranks, attendance-shortage list, subject marksheet stats.

## Security
bcrypt hashing · JWT in httpOnly SameSite cookie (remember-me = 30 days, otherwise browser session) · account lockout after 5 failed logins ·
forgot/reset password with single-use 1-hour tokens (SMTP or log fallback) · sign out of all devices / revoke sessions on password change · CSRF header check · helmet CSP · rate-limited auth · zod validation ·
server-side scoping on every query (student = self, teacher = assigned students/own subjects, admin = all) ·
Admin self-signup requires `ADMIN_SIGNUP_CODE`.

## Early warnings (server/src/alerts.js)
Attendance < 75% · low marks (<50% avg or <40% in a subject) · ≥3 consecutive absent days · score decline ≥10 pts ·
≥2 overdue assignments · overdue fees. Re-evaluated on every relevant change and every 30 min; staff get severity,
reason and recommended action, students get improvement tips as notifications.

## Tests
`npm run test:api` (107 API checks, server running) · `npm run test:ui` (54 page-render + flow tests, server running)
