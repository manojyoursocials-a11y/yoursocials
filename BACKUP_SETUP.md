# Your Socials OS — Automatic GitHub Backup Setup

This setup saves your ENTIRE database to GitHub every day at 6:30 AM IST automatically.

## What gets backed up
- All users and their data
- All tasks with attachments
- All clients
- All finance records  
- All calendar posts
- All gallery photos (including images)
- All reimbursements with receipts
- All leads and interactions
- All important festival days
- All app settings

## One-time setup (10 minutes)

### Step 1 — Create a backups branch protection
In GitHub → your repo → Settings → Branches → keep `main` as default

### Step 2 — Create a Personal Access Token
1. GitHub → your profile → **Settings** (bottom left)
2. **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Name: `YourSocialsBackup`
5. Expiry: **No expiration**
6. Scopes: tick **repo** (full repo access)
7. Click **Generate token**
8. **Copy the token** — you won't see it again!

### Step 3 — Add secrets to your GitHub repo
Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 3 secrets:

| Secret name | Value |
|---|---|
| `BACKUP_TOKEN` | The personal access token from Step 2 |
| `APP_URL` | `https://yoursocials.vercel.app` |
| `ADMIN_SESSION_TOKEN` | Your session cookie (see Step 4) |

### Step 4 — Get your admin session token
1. Open `yoursocials.vercel.app` and login as admin
2. Press F12 → Application tab → Cookies → `yoursocials.vercel.app`
3. Copy the value of `next-auth.session-token`
4. Paste it as the `ADMIN_SESSION_TOKEN` secret

### Step 5 — Test it manually
Go to your GitHub repo → **Actions** tab → **Daily Database Backup** → **Run workflow** → **Run workflow**

Wait 30 seconds → you should see a `backups/backup-YYYY-MM-DD.json` file appear in your repo.

### That's it! 
From now on, every day at 6:30 AM IST, a fresh backup is automatically committed to your GitHub repo. You'll always have the last 30 days of backups.

## To restore from backup
Contact support or a developer with the backup JSON file — all data can be re-imported using the database setup scripts.

## Manual backup anytime
Go to `yoursocials.vercel.app/admin` → **Backup tab** → **Download Backup Now**
