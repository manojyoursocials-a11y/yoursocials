import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  return neon(process.env.DATABASE_URL);
}

export async function setupDatabase() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '', password TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'member', job_title TEXT NOT NULL DEFAULT '', coins INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_name TEXT, contact_email TEXT, contact_phone TEXT, industry TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', links TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'P3', owner_id TEXT, client_id TEXT, deadline DATE, post_date DATE, estimated_hours NUMERIC(5,1), actual_hours NUMERIC(5,1), quality_rating INTEGER, ai_checklist TEXT NOT NULL DEFAULT '[]', created_by TEXT, completed_at TIMESTAMPTZ, review_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE, done_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  // Add columns safely for existing databases
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS post_date DATE`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS today_notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', done BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS followups (id TEXT PRIMARY KEY, client_id TEXT, subject TEXT NOT NULL, body TEXT, due_date DATE, status TEXT NOT NULL DEFAULT 'pending', assigned_to TEXT, created_by TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🎁', description TEXT NOT NULL DEFAULT '', coin_cost INTEGER NOT NULL DEFAULT 0, reward_type TEXT NOT NULL DEFAULT 'weekly', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  return { ok: true };
}

export function getDb() {
  const sql = getSql();
  return {
    // ── USERS ─────────────────────────────────────────────
    async getUsers()       { return sql`SELECT id,email,name,role,job_title,coins,streak,created_at FROM users ORDER BY coins DESC`; },
    async getUserById(id)  { const r=await sql`SELECT * FROM users WHERE id=${id} LIMIT 1`; return r[0]||null; },
    async getUserByEmail(e){ const r=await sql`SELECT * FROM users WHERE email=${e} LIMIT 1`; return r[0]||null; },
    async createUser({id,email,name,password,role,job_title}) {
      const r=await sql`INSERT INTO users(id,email,name,password,role,job_title) VALUES(${id},${email},${name},${password},${role||'member'},${job_title||''}) RETURNING id,email,name,role,job_title,coins,streak`;
      return r[0];
    },
    async updateUser(id,u) {
      if(u.name!==undefined)      await sql`UPDATE users SET name=${u.name} WHERE id=${id}`;
      if(u.password!==undefined)  await sql`UPDATE users SET password=${u.password} WHERE id=${id}`;
      if(u.role!==undefined)      await sql`UPDATE users SET role=${u.role} WHERE id=${id}`;
      if(u.job_title!==undefined) await sql`UPDATE users SET job_title=${u.job_title} WHERE id=${id}`;
    },
    async deleteUser(id)       { await sql`DELETE FROM users WHERE id=${id}`; },
    async addCoins(userId,amt) { await sql`UPDATE users SET coins=coins+${amt} WHERE id=${userId}`; },

    // ── CLIENTS ───────────────────────────────────────────
    async getClients() {
      return sql`SELECT c.*,COUNT(t.id)::int AS task_count,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)::int AS done_count FROM clients c LEFT JOIN tasks t ON t.client_id=c.id GROUP BY c.id ORDER BY c.created_at DESC`;
    },
    async createClient({id,name,contact_name,contact_email,contact_phone,industry,notes,status,created_by}) {
      const r=await sql`INSERT INTO clients(id,name,contact_name,contact_email,contact_phone,industry,notes,status,created_by) VALUES(${id},${name},${contact_name||null},${contact_email||null},${contact_phone||null},${industry||null},${notes||null},${status||'active'},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async updateClient(id,f) {
      await sql`UPDATE clients SET name=${f.name},contact_name=${f.contact_name||null},contact_email=${f.contact_email||null},contact_phone=${f.contact_phone||null},industry=${f.industry||null},notes=${f.notes||null},status=${f.status||'active'},updated_at=NOW() WHERE id=${id}`;
    },
    async deleteClient(id) { await sql`DELETE FROM clients WHERE id=${id}`; },

    // ── TASKS ─────────────────────────────────────────────
    async getTasks() {
      return sql`SELECT t.*,u.name AS owner_name,u.email AS owner_email,cb.name AS created_by_name,c.name AS client_name FROM tasks t LEFT JOIN users u ON t.owner_id=u.id LEFT JOIN users cb ON t.created_by=cb.id LEFT JOIN clients c ON t.client_id=c.id ORDER BY t.created_at DESC`;
    },
    async getTaskById(id) { const r=await sql`SELECT * FROM tasks WHERE id=${id} LIMIT 1`; return r[0]||null; },
    async getTasksByMember(memberId) {
      return sql`SELECT t.*,c.name AS client_name,cb.name AS created_by_name FROM tasks t LEFT JOIN clients c ON t.client_id=c.id LEFT JOIN users cb ON t.created_by=cb.id WHERE t.owner_id=${memberId} ORDER BY t.status,t.created_at DESC`;
    },
    async getTasksByClient(clientId) {
      return sql`SELECT t.*,u.name AS owner_name,cb.name AS created_by_name FROM tasks t LEFT JOIN users u ON t.owner_id=u.id LEFT JOIN users cb ON t.created_by=cb.id WHERE t.client_id=${clientId} ORDER BY t.status,t.created_at DESC`;
    },
    async getTodayTasks() {
      const today=new Date().toISOString().split('T')[0];
      return sql`SELECT t.*,u.name AS owner_name,c.name AS client_name FROM tasks t LEFT JOIN users u ON t.owner_id=u.id LEFT JOIN clients c ON t.client_id=c.id WHERE t.status!='done' AND (t.deadline=${today} OR t.post_date=${today}) ORDER BY t.priority`;
    },
    async createTask({id,title,description,links,priority,owner_id,client_id,deadline,post_date,estimated_hours,ai_checklist,created_by}) {
      const r=await sql`INSERT INTO tasks(id,title,description,links,priority,owner_id,client_id,deadline,post_date,estimated_hours,ai_checklist,created_by) VALUES(${id},${title},${description||''},${links||'[]'},${priority||'P3'},${owner_id||null},${client_id||null},${deadline||null},${post_date||null},${estimated_hours||null},${ai_checklist||'[]'},${created_by||null}) RETURNING *`;
      return r[0];
    },
    // moveTask returns whether coins were awarded (so API can grant them)
    async moveTask(id, status) {
      let reviewAwarded = false;
      let doneAwarded   = false;
      if (status === 'done') {
        // Only award if not already awarded for this task
        const r = await sql`UPDATE tasks SET status='done',completed_at=NOW(),updated_at=NOW(),done_coins_awarded=TRUE WHERE id=${id} AND done_coins_awarded=FALSE RETURNING id`;
        doneAwarded = r.length > 0;
        // If already done before, just update status without returning (already awarded)
        if (!doneAwarded) await sql`UPDATE tasks SET status='done',completed_at=NOW(),updated_at=NOW() WHERE id=${id}`;
      } else if (status === 'review') {
        const r = await sql`UPDATE tasks SET status='review',updated_at=NOW(),review_coins_awarded=TRUE WHERE id=${id} AND review_coins_awarded=FALSE RETURNING id`;
        reviewAwarded = r.length > 0;
        if (!reviewAwarded) await sql`UPDATE tasks SET status='review',updated_at=NOW() WHERE id=${id}`;
      } else if (status === 'inprogress') {
        await sql`UPDATE tasks SET status='inprogress',updated_at=NOW() WHERE id=${id}`;
      } else if (status === 'todo') {
        await sql`UPDATE tasks SET status='todo',completed_at=NULL,updated_at=NOW() WHERE id=${id}`;
      }
      return { reviewAwarded, doneAwarded };
    },
    async editTask(id, f) {
      await sql`UPDATE tasks SET title=${f.title||''},description=${f.description||''},links=${f.links||'[]'},priority=${f.priority||'P3'},owner_id=${f.owner_id||null},client_id=${f.client_id||null},deadline=${f.deadline||null},post_date=${f.post_date||null},estimated_hours=${f.estimated_hours||null},ai_checklist=${f.ai_checklist||'[]'},updated_at=NOW() WHERE id=${id}`;
    },
    async deleteTask(id) { await sql`DELETE FROM tasks WHERE id=${id}`; },
    async deleteTasks(ids) {
      // Delete multiple tasks by id array
      for (const id of ids) { await sql`DELETE FROM tasks WHERE id=${id}`; }
    },

    // ── FOLLOWUPS ─────────────────────────────────────────
    async getFollowups() {
      return sql`SELECT f.*,c.name AS client_name,u.name AS assignee_name FROM followups f LEFT JOIN clients c ON f.client_id=c.id LEFT JOIN users u ON f.assigned_to=u.id ORDER BY f.due_date ASC NULLS LAST,f.created_at DESC`;
    },
    async createFollowup({id,client_id,subject,due_date,assigned_to,created_by}) {
      const r=await sql`INSERT INTO followups(id,client_id,subject,due_date,assigned_to,created_by) VALUES(${id},${client_id||null},${subject},${due_date||null},${assigned_to||null},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async doneFollowup(id,body)       { await sql`UPDATE followups SET status='done',body=${body||null},sent_at=NOW(),updated_at=NOW() WHERE id=${id}`; },
    async updateFollowupBody(id,body) { await sql`UPDATE followups SET body=${body||null},updated_at=NOW() WHERE id=${id}`; },
    async deleteFollowup(id)          { await sql`DELETE FROM followups WHERE id=${id}`; },

    // ── REWARDS ───────────────────────────────────────────
    async getRewards() { return sql`SELECT * FROM rewards ORDER BY reward_type,coin_cost`; },
    async createReward({id,name,emoji,description,coin_cost,reward_type}) {
      const r=await sql`INSERT INTO rewards(id,name,emoji,description,coin_cost,reward_type) VALUES(${id},${name||'Reward'},${emoji||'🎁'},${description||''},${coin_cost||0},${reward_type||'weekly'}) RETURNING *`;
      return r[0];
    },
    async updateReward(id,f) { await sql`UPDATE rewards SET name=${f.name||'Reward'},emoji=${f.emoji||'🎁'},description=${f.description||''},coin_cost=${f.coin_cost||0},reward_type=${f.reward_type||'weekly'} WHERE id=${id}`; },
    async deleteReward(id)   { await sql`DELETE FROM rewards WHERE id=${id}`; },

    // ── TODAY NOTES ───────────────────────────────────────
    async getTodayNotes(userId) { return sql`SELECT * FROM today_notes WHERE user_id=${userId} ORDER BY created_at ASC`; },
    async createTodayNote({id,userId,content}) {
      const r=await sql`INSERT INTO today_notes(id,user_id,content) VALUES(${id},${userId},${content}) RETURNING *`;
      return r[0];
    },
    async updateTodayNote(id,{content,done}) {
      if(content!==undefined) await sql`UPDATE today_notes SET content=${content} WHERE id=${id}`;
      if(done!==undefined)    await sql`UPDATE today_notes SET done=${done} WHERE id=${id}`;
    },
    async deleteTodayNote(id) { await sql`DELETE FROM today_notes WHERE id=${id}`; },
    async clearDoneTodayNotes(userId) { await sql`DELETE FROM today_notes WHERE user_id=${userId} AND done=TRUE`; },

    // ── MEMBERS with stats ────────────────────────────────
    async getMembers() {
      return sql`SELECT u.id,u.email,u.name,u.role,u.job_title,u.coins,u.streak,u.created_at,COUNT(t.id)::int AS total_tasks,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)::int AS done_tasks,SUM(CASE WHEN t.status!='done' AND t.deadline IS NOT NULL AND t.deadline<CURRENT_DATE THEN 1 ELSE 0 END)::int AS overdue_tasks,ROUND(AVG(CASE WHEN t.quality_rating IS NOT NULL THEN t.quality_rating END),1) AS avg_quality FROM users u LEFT JOIN tasks t ON t.owner_id=u.id GROUP BY u.id ORDER BY u.coins DESC`;
    },

    // ── DASHBOARD ─────────────────────────────────────────
    async getDashboard() {
      const [tasks,members,rewards,followups]=await Promise.all([
        sql`SELECT status,priority,deadline::text,post_date::text,quality_rating,title FROM tasks`,
        sql`SELECT id,name,coins,streak,job_title,role FROM users ORDER BY coins DESC`,
        sql`SELECT * FROM rewards ORDER BY reward_type,coin_cost`,
        sql`SELECT id FROM followups WHERE status='pending'`,
      ]);
      const today=new Date().toISOString().split('T')[0];
      const total=tasks.length,done=tasks.filter(t=>t.status==='done').length;
      const inProg=tasks.filter(t=>t.status==='inprogress').length,review=tasks.filter(t=>t.status==='review').length;
      const todo=tasks.filter(t=>t.status==='todo').length;
      const overdue=tasks.filter(t=>t.status!=='done'&&t.deadline&&t.deadline<today).length;
      const dueToday=tasks.filter(t=>t.status!=='done'&&(t.deadline===today||t.post_date===today));
      const qArr=tasks.filter(t=>t.quality_rating);
      const avgQ=qArr.length?(qArr.reduce((s,t)=>s+t.quality_rating,0)/qArr.length).toFixed(1):null;
      const compPct=total>0?Math.round((done/total)*100):0;
      const health=Math.min(100,Math.round(compPct*0.4+Math.max(0,100-overdue*15)*0.4+20));
      const totalCoins=members.reduce((s,m)=>s+(m.coins||0),0);
      return {stats:{total,done,inProg,review,todo,overdue,avgQuality:avgQ,completionPct:compPct,healthScore:health,pendingFollowups:followups.length,totalCoins},dueToday,members,rewards};
    },
  };
}
