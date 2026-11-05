# EduPulse – Step-by-step: get your website link

Result: a public link such as `https://edupulse.onrender.com` that anyone can open, with real sign-up, login and password reset.

## 0. Install once
- **Node.js 18+** (nodejs.org) · **Git** (git-scm.com) · **VS Code** (code.visualstudio.com)
- A free **GitHub** account (github.com) and a free **Render** account (render.com)

## 1. Open the project in VS Code
Unzip `EduPulse.zip` → VS Code → **File → Open Folder** → select the `EduPulse` folder.

## 2. (Optional but recommended) Test on your PC first
```bash
# create DB once (psql / pgAdmin): user krconnect, password krconnect, database krconnect
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run install:all
npm run dev:server      # terminal 1
npm run dev:client      # terminal 2  → open http://localhost:5173
```

## 3. Put the code on GitHub (from VS Code)
1. Left bar → **Source Control** icon (`Ctrl+Shift+G`).
2. Click **Initialize Repository**.
3. Type a message (e.g. `EduPulse first version`) → **Commit** (choose *Yes* to stage all changes).
4. Click **Publish Branch** → sign in to GitHub when asked → choose **Private repository** (recommended) → Publish.

## 4. Deploy on Render
1. Go to **render.com** → *Sign up* with GitHub.
2. Click **New + → Blueprint** → connect your GitHub → select the **EduPulse** repository.
3. Render reads `render.yaml` and shows a database + web service. Enter a value for **ADMIN_SIGNUP_CODE** (any secret, e.g. `MyCollege-2026!`) — you need it to create the first Admin account.
4. Click **Apply**. Wait 5–8 minutes until the service shows **Live**.
5. Click the service name `edupulse` → copy the URL at the top. **That is your website link.**

## 5. First login
Open the link → the landing page appears → **Sign in** → use the demo buttons (Admin / Teacher / Student).
To create your own admin: **Get started → Admin** and enter your `ADMIN_SIGNUP_CODE`.

## 6. Go "real": remove demo data and demo buttons
Render → your service → **Environment** → add / change:
| Key | Value |
|---|---|
| `AUTO_SEED` | `false` |
| `VITE_SHOW_DEMO` | `false` |

Then **Manual Deploy → Clear build cache & deploy**. (For a fresh empty database: Render → the database → delete & recreate it, or run `npm run seed` only if you want sample data.)

## 7. Turn on real password-reset emails
Without email settings, the reset link is only printed in Render's **Logs** tab. To send real emails add these variables (example: Gmail with an *App Password*, or Brevo/SendGrid SMTP):
| Key | Example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `yourname@gmail.com` |
| `SMTP_PASS` | your 16-character app password |
| `MAIL_FROM` | `EduPulse <yourname@gmail.com>` |

(Gmail: Google Account → Security → 2-Step Verification → App passwords.) Save → the service restarts → **Forgot password** now emails the link. An admin can also reset any user's password from **Administration → Users**.

## 8. Use your own domain (optional)
Render → service → **Settings → Custom Domains → Add** → follow the DNS instructions at your domain provider. HTTPS is automatic.

## 9. Updating the site later
Edit code in VS Code → Source Control → **Commit** → **Sync Changes**. Render redeploys automatically.

## Troubleshooting
| Problem | Fix |
|---|---|
| First visit takes ~30 s | Free plan sleeps after 15 min idle — normal. |
| Build fails | Render → Logs. Make sure the repo root contains `render.yaml`, `client/` and `server/`. |
| Can't log in as admin | Use the demo Admin button (if `AUTO_SEED` was true) or sign up as Admin with your `ADMIN_SIGNUP_CODE`. |
| Database expired | Free Render databases last 30 days — upgrade the DB plan or create a new one. |
| `ECONNREFUSED` locally | PostgreSQL isn't running on your PC — start it. |
