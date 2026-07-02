# ⚡ Your Socials OS

> AI-powered team performance OS. No external databases. Everything runs on Vercel.

---

## Setup — 3 steps only

### Step 1 — Push to GitHub

```bash
git init && git add . && git commit -m "init"
# Create repo on github.com, then:
git remote add origin https://github.com/YOUR/your-socials-os.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. **vercel.com** → New Project → Import your GitHub repo
2. Framework: **Next.js** (auto-detected)
3. Click **Deploy**

### Step 3 — Add 4 environment variables

Vercel → Project → **Settings → Environment Variables**:

| Variable | How to get it |
|---|---|
| `NEXTAUTH_URL` | Your app URL e.g. `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | console.cloud.google.com → Credentials → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

**Google OAuth redirect URI to add:** `https://your-app.vercel.app/api/auth/callback/google`

After adding env vars → **Redeploy** → open URL → **Continue with Google** → you're in. ✅

The database (SQLite) is created automatically in `/tmp` on first request. No setup needed.

---

## No external services needed
- ✅ Database: SQLite (auto-created, zero config)
- ✅ Auth: Google OAuth via NextAuth
- ✅ AI: Anthropic Claude (server-side, key stays secret)
- ✅ Hosting: Vercel

> **Note:** SQLite on Vercel uses `/tmp` which resets on cold starts. For permanent data in production, you can later swap `lib/db.js` to use Vercel Postgres (free tier) — but the app works perfectly as-is for teams starting out.
