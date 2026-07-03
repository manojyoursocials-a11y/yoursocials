import { neon } from '@neondatabase/serverless';

function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.');
  }
  return neon(process.env.DATABASE_URL);
}

export async function setupDatabase() {
  const db = sql();

  await db`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'member',
    job_title TEXT NOT NULL DEFAULT '', coins INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_name TEXT, contact_email TEXT,
    contact_phone TEXT, industry TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    link TEXT, status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'P3',
    owner_id TEXT, client_id TEXT, deadline DATE, estimated_hours NUMERIC(5,1),
    actual_hours NUMERIC(5,1), quality_rating INTEGER, ai_checklist TEXT NOT NULL DEFAULT '[]',
    created_by TEXT, completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Add link column if upgrading existing DB
  await db`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link TEXT`;

  await db`CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY, client_id TEXT, subject TEXT NOT NULL, body TEXT,
    due_date DATE, status TEXT NOT NULL DEFAULT 'pending', assigned_to TEXT,
    created_by TEXT, sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, description TEXT,
    coin_cost INTEGER NOT NULL DEFAULT 0, reward_type TEXT NOT NULL DEFAULT 'weekly',
    status TEXT NOT NULL DEFAULT 'locked', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  const existing = await db`SELECT COUNT(*) as c FROM rewards`;
  if (parseInt(existing[0].c) === 0) {
    const { v4: uuid } = await import('uuid');
    const rewards = [
      [uuid(),'Team Lunch','🍕','Celebrate with a team lunch',500,'weekly'],
      [uuid(),'Bowling Night','🎳','Strike it up at the bowling alley',800,'weekly'],
      [uuid(),'Ice Skating','⛸️','Cool off at the rink together',800,'weekly'],
      [uuid(),'Rock Climbing','🧗','Reach new heights as a team',800,'weekly'],
      [uuid(),'Cricket Match','🏏','Team vs team on the pitch',600,'weekly'],
      [uuid(),'Gaming Night','🎮','LAN party at the office',400,'weekly'],
      [uuid(),'Movie Night','🎬','Team movie outing',500,'weekly'],
      [uuid(),'Goa Trip','✈️','Grand monthly prize — Goa team trip',13000,'monthly'],
    ];
    for (const [id,name,emoji,description,coin_cost,reward_type] of rewards) {
      await db`INSERT INTO rewards (id,name,emoji,description,coin_cost,reward_type) VALUES (${id},${name},${emoji},${description},${coin_cost},${reward_type})`;
    }
  }
  return { ok: true };
}

export function getDb() {
  const db = sql();
  return {

    // ── USERS ─────────────────────────────────────────────────
    async getUsers() {
      return db`SELECT id,email,name,role,job_title,coins,streak,created_at FROM users ORDER BY coins DESC`;
    },
    async getUserById(id) {
      const r = await db`SELECT * FROM users WHERE id=${id} LIMIT 1`;
      return r[0]||null;
    },
    async getUserByEmail(email) {
      const r = await db`SELECT * FROM users WHERE email=${email} LIMIT 1`;
      return r[0]||null;
    },
    async createUser({id,email,name,password,role='member',job_title=''}) {
      const r = await db`INSERT INTO users (id,email,name,password,role,job_title) VALUES (${id},${email},${name},${password},${role},${job_title}) RETURNING id,email,name,role,job_title,coins,streak`;
      return r[0];
    },
    async updateUser(id, updates) {
      const allowed = ['name','password','role','job_title','coins','streak'];
      const fields  = Object.keys(updates).filter(k => allowed.includes(k));
      for (const f of fields) {
        await db`UPDATE users SET ${db(f)}=${updates[f]} WHERE id=${id}`;
      }
    },
    async deleteUser(id)       { await db`DELETE FROM users WHERE id=${id}`; },
    async addCoins(userId, amt){ await db`UPDATE users SET coins=coins+${amt} WHERE id=${userId}`; },

    // ── CLIENTS ───────────────────────────────────────────────
    async getClients() {
      return db`
        SELECT c.*,
               COUNT(t.id)::int AS task_count,
               SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)::int AS done_count
        FROM clients c LEFT JOIN tasks t ON t.client_id=c.id
        GROUP BY c.id ORDER BY c.created_at DESC`;
    },
    async createClient({id,name,contact_name,contact_email,contact_phone,industry,notes,status='active',created_by}) {
      const r = await db`INSERT INTO clients (id,name,contact_name,contact_email,contact_phone,industry,notes,status,created_by)
        VALUES (${id},${name},${contact_name||null},${contact_email||null},${contact_phone||null},${industry||null},${notes||null},${status},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async updateClient(id,{name,contact_name,contact_email,contact_phone,industry,notes,status}) {
      await db`UPDATE clients SET name=${name},contact_name=${contact_name||null},contact_email=${contact_email||null},contact_phone=${contact_phone||null},industry=${industry||null},notes=${notes||null},status=${status||'active'},updated_at=NOW() WHERE id=${id}`;
    },
    async deleteClient(id) { await db`DELETE FROM clients WHERE id=${id}`; },

    // ── TASKS ─────────────────────────────────────────────────
    async getTasks() {
      return db`
        SELECT t.*, u.name AS owner_name, c.name AS client_name
        FROM tasks t
        LEFT JOIN users u ON t.owner_id=u.id
        LEFT JOIN clients c ON t.client_id=c.id
        ORDER BY t.created_at DESC`;
    },
    async getTasksByMember(memberId) {
      return db`
        SELECT t.*, c.name AS client_name
        FROM tasks t
        LEFT JOIN clients c ON t.client_id=c.id
        WHERE t.owner_id=${memberId}
        ORDER BY t.created_at DESC`;
    },
    async createTask({id,title,description,link,priority,owner_id,client_id,deadline,estimated_hours,ai_checklist,created_by}) {
      const r = await db`INSERT INTO tasks (id,title,description,link,priority,owner_id,client_id,deadline,estimated_hours,ai_checklist,created_by)
        VALUES (${id},${title},${description||''},${link||null},${priority||'P3'},${owner_id||null},${client_id||null},${deadline||null},${estimated_hours||null},${ai_checklist||'[]'},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async updateTask(id, updates) {
      const allowed = ['title','description','link','status','priority','owner_id','client_id','deadline','estimated_hours','actual_hours','quality_rating','ai_checklist'];
      const fields  = Object.keys(updates).filter(k => allowed.includes(k));
      for (const f of fields) {
        const val = updates[f] === '' && ['link','description'].includes(f) ? null : updates[f];
        await db`UPDATE tasks SET ${db(f)}=${val}, updated_at=NOW() WHERE id=${id}`;
      }
      if (updates.status === 'done') {
        await db`UPDATE tasks SET completed_at=NOW() WHERE id=${id}`;
      }
    },
    async deleteTask(id) { await db`DELETE FROM tasks WHERE id=${id}`; },

    // ── FOLLOWUPS ─────────────────────────────────────────────
    async getFollowups() {
      return db`
        SELECT f.*, c.name AS client_name, u.name AS assignee_name
        FROM followups f
        LEFT JOIN clients c ON f.client_id=c.id
        LEFT JOIN users u ON f.assigned_to=u.id
        ORDER BY f.due_date ASC NULLS LAST, f.created_at DESC`;
    },
    async createFollowup({id,client_id,subject,due_date,assigned_to,created_by}) {
      const r = await db`INSERT INTO followups (id,client_id,subject,due_date,assigned_to,created_by)
        VALUES (${id},${client_id||null},${subject},${due_date||null},${assigned_to||null},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async updateFollowup(id,{status,body}) {
      await db`UPDATE followups SET status=COALESCE(${status||null},status), body=COALESCE(${body||null},body), sent_at=CASE WHEN ${status||null}='done' THEN NOW() ELSE sent_at END, updated_at=NOW() WHERE id=${id}`;
    },
    async deleteFollowup(id) { await db`DELETE FROM followups WHERE id=${id}`; },

    // ── REWARDS ───────────────────────────────────────────────
    async getRewards() { return db`SELECT * FROM rewards ORDER BY coin_cost`; },
    async createReward({id,name,emoji,description,coin_cost,reward_type}) {
      const r = await db`INSERT INTO rewards (id,name,emoji,description,coin_cost,reward_type) VALUES (${id},${name},${emoji},${description||''},${coin_cost||0},${reward_type||'weekly'}) RETURNING *`;
      return r[0];
    },
    async updateReward(id,{name,emoji,description,coin_cost,reward_type}) {
      await db`UPDATE rewards SET name=${name},emoji=${emoji},description=${description||''},coin_cost=${coin_cost||0},reward_type=${reward_type||'weekly'} WHERE id=${id}`;
    },
    async deleteReward(id) { await db`DELETE FROM rewards WHERE id=${id}`; },

    // ── MEMBERS with stats ─────────────────────────────────────
    async getMembers() {
      return db`
        SELECT u.id,u.email,u.name,u.role,u.job_title,u.coins,u.streak,u.created_at,
               COUNT(t.id)::int AS total_tasks,
               SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)::int AS done_tasks,
               SUM(CASE WHEN t.status!='done' AND t.deadline<CURRENT_DATE THEN 1 ELSE 0 END)::int AS overdue_tasks,
               ROUND(AVG(CASE WHEN t.quality_rating IS NOT NULL THEN t.quality_rating END),1) AS avg_quality
        FROM users u LEFT JOIN tasks t ON t.owner_id=u.id
        GROUP BY u.id ORDER BY u.coins DESC`;
    },

    // ── DASHBOARD ─────────────────────────────────────────────
    async getDashboard() {
      const [tasks,members,rewards,followups] = await Promise.all([
        db`SELECT status,priority,deadline::text,owner_id,quality_rating,title,client_id FROM tasks`,
        db`SELECT id,name,coins,streak,job_title,role FROM users ORDER BY coins DESC`,
        db`SELECT * FROM rewards ORDER BY coin_cost`,
        db`SELECT id,status FROM followups WHERE status='pending'`,
      ]);
      const today  = new Date().toISOString().split('T')[0];
      const total  = tasks.length;
      const done   = tasks.filter(t=>t.status==='done').length;
      const inProg = tasks.filter(t=>t.status==='inprogress').length;
      const review = tasks.filter(t=>t.status==='review').length;
      const todo   = tasks.filter(t=>t.status==='todo').length;
      const overdue= tasks.filter(t=>t.status!=='done'&&t.deadline&&t.deadline<today).length;
      const dueToday=tasks.filter(t=>t.status!=='done'&&t.deadline===today);
      const qArr   = tasks.filter(t=>t.quality_rating);
      const avgQ   = qArr.length?(qArr.reduce((s,t)=>s+t.quality_rating,0)/qArr.length).toFixed(1):null;
      const compPct= total>0?Math.round((done/total)*100):0;
      const health = Math.min(100,Math.round(compPct*0.4+Math.max(0,100-overdue*15)*0.4+20));
      const totalCoins=members.reduce((s,m)=>s+(m.coins||0),0);
      return {
        stats:{total,done,inProg,review,todo,overdue,avgQuality:avgQ,completionPct:compPct,healthScore:health,pendingFollowups:followups.length,totalCoins},
        dueToday, members, rewards,
      };
    },
  };
}
