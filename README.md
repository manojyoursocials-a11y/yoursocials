# ⚡ Your Socials OS

> AI-powered team performance OS — built entirely on Vercel. No other services needed.

---

## Setup in 4 steps (everything inside Vercel)

### Step 1 — Push to GitHub

```bash
# Extract the zip, then:
cd your-socials-os
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/your-socials-os.git
git push -u origin main
```

---

### Step 2 — Deploy on Vercel

1. Go to **https://vercel.com** → Log in → **Add New Project**
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — it will fail on first try (no env vars yet). That's fine.

---

### Step 3 — Add Vercel Postgres (the database)

1. In your Vercel project → **Storage** tab → **Create Database**
2. Choose **Postgres** → name it `your-socials-os-db` → Create
3. Click **Connect to Project** — Vercel auto-fills all `POSTGRES_*` variables for you ✅

---

### Step 4 — Add the 4 environment variables

Vercel dashboard → Project → **Settings** → **Environment Variables** → add these:

| Variable | Where to get it |
|---|---|
| `NEXTAUTH_URL` | Your Vercel app URL, e.g. `https://your-socials-os.vercel.app` |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in terminal, paste the result |
| `GOOGLE_CLIENT_ID` | See below ↓ |
| `GOOGLE_CLIENT_SECRET` | See below ↓ |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |

#### Getting Google OAuth credentials

1. Go to **https://console.cloud.google.com**
2. Create a project (or use existing) → **APIs & Services** → **Credentials**
3. **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized JavaScript origins: `https://your-socials-os.vercel.app`
6. Authorized redirect URIs: `https://your-socials-os.vercel.app/api/auth/callback/google`
7. Copy Client ID and Client Secret → paste into Vercel env vars

After adding all variables → **Redeploy** (Vercel dashboard → Deployments → Redeploy).

---

### First login

1. Open your app URL → click **Continue with Google**
2. The database tables are created automatically on first login (the `/api/setup` call runs in the background)
3. You're in! Start adding clients and tasks.

---

### Share with your team

Just send them your Vercel URL. Each team member:
1. Opens the URL
2. Clicks **Continue with Google**
3. Signs in with their work Google account
4. Their profile is created automatically — no admin setup needed

To set job titles: each person goes to **Team → Edit My Profile**.

---

## Local development

```bash
npm install
```

Create `.env.local` (copy from `.env.example`):
```env
POSTGRES_URL=your_vercel_postgres_url
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any_random_string_for_local
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
ANTHROPIC_API_KEY=sk-ant-...
```

Add `http://localhost:3000` and `http://localhost:3000/api/auth/callback/google` to your Google OAuth authorized URIs.

```bash
npm run dev
# Open http://localhost:3000
```

---

## Project structure

```
your-socials-os/
├── pages/
│   ├── _app.js              # SessionProvider wrapper
│   ├── index.js             # Dashboard
│   ├── tasks.js             # Kanban board
│   ├── clients.js           # Client management
│   ├── ai.js                # AI Manager chat
│   ├── team.js              # Team members
│   ├── leaderboard.js       # Coin rankings
│   ├── rewards.js           # Weekly rewards + trip
│   ├── analytics.js         # Performance charts
│   ├── followups.js         # Client follow-ups
│   ├── login.js             # Google OAuth login
│   └── api/
│       ├── auth/[...nextauth].js   # NextAuth handler
│       ├── setup.js                # DB init (auto-runs)
│       ├── dashboard.js            # Aggregated stats
│       ├── tasks.js                # Task CRUD
│       ├── clients.js              # Client CRUD
│       ├── members.js              # Team members
│       ├── followups.js            # Follow-up CRUD
│       ├── rewards.js              # Rewards list
│       └── ai.js                   # Anthropic proxy
├── components/
│   ├── Layout.js            # Sidebar + topbar
│   └── UI.js                # All shared components
├── lib/
│   ├── db.js                # Vercel Postgres + schema
│   └── auth.js              # NextAuth config
├── styles/globals.css
├── .env.example
└── next.config.js
```

---

## Tech stack — 100% Vercel

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (Pages Router) |
| Auth | NextAuth.js + Google OAuth |
| Database | Vercel Postgres (built-in) |
| AI | Anthropic Claude (server-side proxy) |
| Hosting | Vercel |
| Styling | Pure CSS variables |
| Animations | CSS + canvas-confetti |

---

## Troubleshooting

**Login redirects in a loop**
→ Make sure `NEXTAUTH_URL` exactly matches your Vercel URL (no trailing slash).

**Database error on first load**
→ Check Vercel → Storage → your DB is connected to the project.

**Google login error**
→ Double-check the redirect URI in Google Cloud Console matches exactly: `https://YOUR_APP.vercel.app/api/auth/callback/google`

**AI not responding**
→ Check `ANTHROPIC_API_KEY` in Vercel env vars. Must start with `sk-ant-`.
