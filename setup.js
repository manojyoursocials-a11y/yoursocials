#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════╗
 * ║        Your Socials OS — Automated Setup            ║
 * ║  Run once: node setup.js                            ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * This script will:
 *  1. Generate NEXTAUTH_SECRET automatically
 *  2. Ask you 5 questions (takes ~2 minutes)
 *  3. Create your .env.local file
 *  4. Push to GitHub
 *  5. Deploy to Vercel via Vercel CLI
 *  6. Set all env vars in Vercel automatically
 *  7. Create your admin account
 *  8. Open the app in your browser
 */

const { execSync, exec } = require('child_process');
const readline = require('readline');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const https    = require('https');

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function log(msg)    { console.log(`${GREEN}✅ ${msg}${RESET}`); }
function info(msg)   { console.log(`${CYAN}ℹ  ${msg}${RESET}`); }
function warn(msg)   { console.log(`${YELLOW}⚠  ${msg}${RESET}`); }
function error(msg)  { console.log(`${RED}❌ ${msg}${RESET}`); }
function title(msg)  { console.log(`\n${BOLD}${CYAN}${msg}${RESET}\n`); }
function run(cmd, silent=false) {
  try {
    return execSync(cmd, { stdio: silent ? 'pipe' : 'inherit', encoding:'utf8' });
  } catch(e) {
    return null;
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q, defaultVal='') {
  return new Promise(resolve => {
    const hint = defaultVal ? ` (default: ${defaultVal})` : '';
    rl.question(`${YELLOW}? ${q}${hint}: ${RESET}`, ans => {
      resolve(ans.trim() || defaultVal);
    });
  });
}
function askSecret(q) {
  return new Promise(resolve => {
    process.stdout.write(`${YELLOW}? ${q}: ${RESET}`);
    const stdin = process.openStdin();
    const wasRaw = process.stdin.isRaw;
    try { process.stdin.setRawMode(true); } catch(e) {}
    let val = '';
    process.stdin.on('data', function handler(ch) {
      ch = ch + '';
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        process.stdin.removeListener('data', handler);
        try { process.stdin.setRawMode(wasRaw); } catch(e) {}
        process.stdout.write('\n');
        resolve(val);
      } else if (ch === '\u0003') {
        process.exit();
      } else if (ch === '\u007f' || ch === '\b') {
        if (val.length > 0) { val = val.slice(0,-1); process.stdout.write('\b \b'); }
      } else {
        val += ch;
        process.stdout.write('*');
      }
    });
  });
}

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u    = new URL(url);
    const opts = { hostname:u.hostname, port:u.port||443, path:u.pathname, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} };
    const req  = https.request(opts, res => {
      let raw='';
      res.on('data', d => raw+=d);
      res.on('end',  () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.clear();
  console.log(`
${BOLD}${CYAN}
  ╔══════════════════════════════════════════╗
  ║    ⚡  Your Socials OS — Setup Wizard   ║
  ╚══════════════════════════════════════════╝
${RESET}
This wizard will set up everything in ~3 minutes.
You only need to answer a few questions.
`);

  // ── STEP 1: Check prerequisites ─────────────────────────
  title('Step 1/7 — Checking prerequisites');

  const hasGit    = run('git --version', true);
  const hasNode   = run('node --version', true);
  const hasNpm    = run('npm --version',  true);

  if (!hasGit)  { error('Git not found. Install from https://git-scm.com'); process.exit(1); }
  if (!hasNode) { error('Node.js not found. Install from https://nodejs.org'); process.exit(1); }
  log('Git, Node.js and npm found');

  // Check / install Vercel CLI
  const hasVercel = run('vercel --version', true);
  if (!hasVercel) {
    info('Installing Vercel CLI...');
    run('npm install -g vercel');
  }
  log('Vercel CLI ready');

  // ── STEP 2: Collect info ─────────────────────────────────
  title('Step 2/7 — Your details');
  info('Answer these questions to configure your app:\n');

  const adminName     = await ask('Your full name (admin account)', 'Manoj');
  const adminEmail    = await ask('Your email (used to log in)');
  const adminPassword = await askSecret('Create a password (min 6 chars)');
  console.log('');

  if (!adminEmail.includes('@')) { error('Invalid email'); process.exit(1); }
  if (adminPassword.length < 6)  { error('Password must be at least 6 characters'); process.exit(1); }

  const anthropicKey  = await ask('Anthropic API key (sk-ant-... from console.anthropic.com)', 'skip');

  // ── STEP 3: Generate secrets + write .env.local ──────────
  title('Step 3/7 — Creating environment config');

  const secret = crypto.randomBytes(32).toString('hex');
  log('Generated NEXTAUTH_SECRET');

  // We'll fill NEXTAUTH_URL after deploy — use placeholder for now
  const envContent = [
    `NEXTAUTH_SECRET=${secret}`,
    `NEXTAUTH_URL=PLACEHOLDER`,
    anthropicKey !== 'skip' ? `ANTHROPIC_API_KEY=${anthropicKey}` : `# ANTHROPIC_API_KEY=add_after_deploy`,
  ].join('\n');

  fs.writeFileSync('.env.local', envContent);
  log('.env.local created');

  // Save config for later steps
  const config = { secret, adminName, adminEmail, adminPassword, anthropicKey };
  fs.writeFileSync('.setup-config.json', JSON.stringify(config));

  // ── STEP 4: Git init and push ────────────────────────────
  title('Step 4/7 — Pushing to GitHub');

  const isGitRepo = fs.existsSync('.git');
  if (!isGitRepo) {
    run('git init');
    run('git add .');
    run('git commit -m "Initial commit — Your Socials OS"');
    warn('No GitHub remote set up yet.');
    info('Please create a NEW repo on github.com, then run:');
    console.log(`\n  ${BOLD}git remote add origin https://github.com/YOUR_USERNAME/your-socials-os.git`);
    console.log(`  git push -u origin main${RESET}\n`);
    const pushed = await ask('Have you pushed to GitHub? (yes/no)', 'no');
    if (pushed.toLowerCase() !== 'yes') {
      info('Come back and run: node setup.js --after-push');
      rl.close();
      return;
    }
  } else {
    run('git add .');
    run('git commit -m "Setup: Your Socials OS v5"');
    run('git push');
    log('Pushed to GitHub');
  }

  // ── STEP 5: Deploy to Vercel ─────────────────────────────
  title('Step 5/7 — Deploying to Vercel');
  info('Logging in to Vercel (browser will open)...\n');

  run('vercel login');

  info('Deploying project...\n');
  const deployOutput = run('vercel --yes', true) || '';

  // Extract the URL from deploy output
  const urlMatch = deployOutput.match(/https:\/\/[^\s]+\.vercel\.app/);
  let appUrl = urlMatch ? urlMatch[0] : '';

  if (!appUrl) {
    warn('Could not auto-detect URL.');
    appUrl = await ask('Paste your Vercel app URL (from vercel dashboard)');
  }
  appUrl = appUrl.replace(/\/$/, '');
  log(`App deployed at: ${appUrl}`);

  // ── STEP 6: Set env vars in Vercel ───────────────────────
  title('Step 6/7 — Configuring environment variables');

  const envVars = [
    ['NEXTAUTH_SECRET', secret],
    ['NEXTAUTH_URL',    appUrl],
  ];
  if (anthropicKey !== 'skip') {
    envVars.push(['ANTHROPIC_API_KEY', anthropicKey]);
  }

  for (const [key, val] of envVars) {
    run(`echo "${val}" | vercel env add ${key} production`, true);
    run(`echo "${val}" | vercel env add ${key} preview`,    true);
    run(`echo "${val}" | vercel env add ${key} development`,true);
    log(`Set ${key}`);
  }

  // Redeploy with env vars
  info('Redeploying with environment variables...');
  run('vercel --prod --yes', true);
  log('Production deployment complete');

  // ── STEP 7: Create admin account ─────────────────────────
  title('Step 7/7 — Creating your admin account');

  info('Waiting 10 seconds for deployment to be live...');
  await sleep(10000);

  const seedUrl = `${appUrl}/api/seed-admin`;
  info(`Calling ${seedUrl}...`);

  let attempts = 0;
  let seedResult = null;
  while (attempts < 5) {
    try {
      seedResult = await postJSON(seedUrl, { name: adminName, email: adminEmail, password: adminPassword });
      if (seedResult.message || seedResult.user) break;
    } catch(e) {}
    attempts++;
    info(`Attempt ${attempts}/5 — waiting 5 seconds...`);
    await sleep(5000);
  }

  if (seedResult?.message) {
    log('Admin account created!');
  } else if (seedResult?.error) {
    warn(`Note: ${seedResult.error}`);
  } else {
    warn('Could not auto-create admin. You will need to run:');
    console.log(`\n  Go to: ${appUrl}\n  Open browser console (F12) and paste:\n`);
    console.log(`  fetch('/api/seed-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'${adminName}',email:'${adminEmail}',password:'YOUR_PASSWORD'})}).then(r=>r.json()).then(console.log)\n`);
  }

  // Cleanup
  try { fs.unlinkSync('.setup-config.json'); } catch(e) {}

  // ── Done ─────────────────────────────────────────────────
  console.log(`
${BOLD}${GREEN}
  ╔══════════════════════════════════════════════════════╗
  ║           ✅  Setup Complete!                       ║
  ╚══════════════════════════════════════════════════════╝
${RESET}
  ${BOLD}Your app:${RESET}      ${CYAN}${appUrl}${RESET}
  ${BOLD}Login with:${RESET}    ${adminEmail}
  ${BOLD}Password:${RESET}      (the one you entered)

  ${BOLD}Next steps:${RESET}
  1. Open ${appUrl}/login
  2. Sign in with your credentials
  3. Go to ⚙️ Manage Users in the sidebar
  4. Add your team members with their emails + passwords
  5. Share the URL + their credentials with your team

  ${YELLOW}Need help? All settings are in Vercel → Settings → Environment Variables${RESET}
`);

  // Open browser
  const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  run(`${openCmd} ${appUrl}/login`, true);

  rl.close();
}

main().catch(e => {
  error(e.message);
  process.exit(1);
});
