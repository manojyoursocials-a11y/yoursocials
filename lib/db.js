import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  return neon(process.env.DATABASE_URL);
}

export async function setupDatabase() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '', password TEXT NOT NULL DEFAULT '', phone TEXT, image TEXT, role TEXT NOT NULL DEFAULT 'member', job_title TEXT NOT NULL DEFAULT '', coins INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_name TEXT, contact_email TEXT, contact_phone TEXT, industry TEXT, notes TEXT, logo TEXT, status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', links TEXT NOT NULL DEFAULT '[]', media TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'P3', owner_id TEXT, client_id TEXT, deadline DATE, post_date DATE, estimated_hours NUMERIC(5,1), actual_hours NUMERIC(5,1), quality_rating INTEGER, ai_checklist TEXT NOT NULL DEFAULT '[]', created_by TEXT, completed_at TIMESTAMPTZ, review_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE, done_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  // Add columns safely for existing databases
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS post_date DATE`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_type TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_coins_awarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS today_notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', done BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS followups (id TEXT PRIMARY KEY, client_id TEXT, subject TEXT NOT NULL, body TEXT, due_date DATE, status TEXT NOT NULL DEFAULT 'pending', assigned_to TEXT, created_by TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🎁', description TEXT NOT NULL DEFAULT '', coin_cost INTEGER NOT NULL DEFAULT 0, reward_type TEXT NOT NULL DEFAULT 'weekly', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS finance (
    id               TEXT PRIMARY KEY,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    name             TEXT NOT NULL,
    amount           NUMERIC(12,2) NOT NULL,
    transaction_type TEXT NOT NULL DEFAULT 'expense',
    payment_for      TEXT,
    brand_name       TEXT,
    transaction_mode TEXT NOT NULL DEFAULT 'UPI',
    description      TEXT,
    closing_balance  NUMERIC(12,2),
    direction        TEXT NOT NULL DEFAULT 'give',
    created_by       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    task_id TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // App settings table (key-value store for global settings)
  await sql`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // Seed default notification settings if not present
  await sql`INSERT INTO app_settings(key,value) VALUES('notif_settings','{}') ON CONFLICT DO NOTHING`;

  // Content Calendar tables
  await sql`CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7C5CFC',
    description TEXT,
    client_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS calendar_posts (
    id TEXT PRIMARY KEY,
    calendar_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_description TEXT,
    platform TEXT,
    content_type TEXT,
    status TEXT NOT NULL DEFAULT 'planning',
    assigned_to TEXT,
    topic_tags TEXT NOT NULL DEFAULT '[]',
    target_audience TEXT,
    publish_date DATE,
    publish_time TEXT,
    media TEXT NOT NULL DEFAULT '[]',
    links TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Chat tables
  await sql`CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'group',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS chat_members (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT`;
  await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_type TEXT`;
  return { ok: true };
}

export function getDb() {
  const sql = getSql();
  return {
    // ── USERS ─────────────────────────────────────────────
    async getUsers()       { return sql`SELECT id,email,name,role,job_title,coins,streak,created_at FROM users ORDER BY coins DESC`; },
    async getUserById(id)  { const r=await sql`SELECT * FROM users WHERE id=${id} LIMIT 1`; return r[0]||null; },
    async getUserByEmail(e){ const r=await sql`SELECT * FROM users WHERE email=${e} LIMIT 1`; return r[0]||null; },
    async getUserByPhone(phone){ const r=await sql`SELECT * FROM users WHERE phone=${phone} LIMIT 1`; return r[0]||null; },
    async getUserByEmailOrPhone(q){ const r=await sql`SELECT * FROM users WHERE email=${q} OR phone=${q} LIMIT 1`; return r[0]||null; },
    async createUser({id,email,name,password,phone,image,role,job_title}) {
      const r=await sql`INSERT INTO users(id,email,name,password,phone,image,role,job_title) VALUES(${id},${email},${name},${password},${phone||null},${image||null},${role||'member'},${job_title||''}) RETURNING id,email,name,role,job_title,coins,streak,phone,image`;
      return r[0];
    },
    async updateUser(id,u) {
      if(u.name!==undefined)      await sql`UPDATE users SET name=${u.name} WHERE id=${id}`;
      if(u.password!==undefined)  await sql`UPDATE users SET password=${u.password} WHERE id=${id}`;
      if(u.role!==undefined)      await sql`UPDATE users SET role=${u.role} WHERE id=${id}`;
      if(u.job_title!==undefined) await sql`UPDATE users SET job_title=${u.job_title} WHERE id=${id}`;
      if(u.coins!==undefined)     await sql`UPDATE users SET coins=${u.coins} WHERE id=${id}`;
      if(u.phone!==undefined)     await sql`UPDATE users SET phone=${u.phone||null} WHERE id=${id}`;
      if(u.image!==undefined)     await sql`UPDATE users SET image=${u.image||null} WHERE id=${id}`;
    },
    async deleteUser(id)       { await sql`DELETE FROM users WHERE id=${id}`; },
    async addCoins(userId,amt) { await sql`UPDATE users SET coins=coins+${amt} WHERE id=${userId}`; },

    // ── CLIENTS ───────────────────────────────────────────
    async getClients() {
      return sql`SELECT c.*,c.logo,COUNT(t.id)::int AS task_count,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)::int AS done_count FROM clients c LEFT JOIN tasks t ON t.client_id=c.id GROUP BY c.id ORDER BY c.created_at DESC`;
    },
    async createClient({id,name,contact_name,contact_email,contact_phone,industry,notes,logo,status,created_by}) {
      const r=await sql`INSERT INTO clients(id,name,contact_name,contact_email,contact_phone,industry,notes,logo,status,created_by) VALUES(${id},${name},${contact_name||null},${contact_email||null},${contact_phone||null},${industry||null},${notes||null},${logo||null},${status||'active'},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async updateClient(id,f) {
      await sql`UPDATE clients SET name=${f.name},contact_name=${f.contact_name||null},contact_email=${f.contact_email||null},contact_phone=${f.contact_phone||null},industry=${f.industry||null},notes=${f.notes||null},logo=${f.logo||null},status=${f.status||'active'},updated_at=NOW() WHERE id=${id}`;
    },
    async deleteClient(id) { await sql`DELETE FROM clients WHERE id=${id}`; },

    // ── TASKS ─────────────────────────────────────────────
    async getTasks() {
      return sql`SELECT t.*,u.name AS owner_name,u.image AS owner_image,u.email AS owner_email,cb.name AS created_by_name,cb.image AS created_by_image,c.name AS client_name,c.logo AS client_logo FROM tasks t LEFT JOIN users u ON t.owner_id=u.id LEFT JOIN users cb ON t.created_by=cb.id LEFT JOIN clients c ON t.client_id=c.id ORDER BY t.created_at DESC`;
    },
    async getTaskById(id) { const r=await sql`SELECT * FROM tasks WHERE id=${id} LIMIT 1`; return r[0]||null; },
    async getTasksByMember(memberId) {
      return sql`SELECT t.*,c.name AS client_name,c.logo AS client_logo,cb.name AS created_by_name,cb.image AS created_by_image FROM tasks t LEFT JOIN clients c ON t.client_id=c.id LEFT JOIN users cb ON t.created_by=cb.id WHERE t.owner_id=${memberId} ORDER BY t.status,t.created_at DESC`;
    },
    async getTasksByClient(clientId) {
      return sql`SELECT t.*,u.name AS owner_name,u.image AS owner_image,cb.name AS created_by_name,cb.image AS created_by_image FROM tasks t LEFT JOIN users u ON t.owner_id=u.id LEFT JOIN users cb ON t.created_by=cb.id WHERE t.client_id=${clientId} ORDER BY t.status,t.created_at DESC`;
    },
    async getTodayTasks() {
      const today=new Date().toISOString().split('T')[0];
      return sql`SELECT t.*,u.name AS owner_name,u.image AS owner_image,c.name AS client_name,c.logo AS client_logo FROM tasks t LEFT JOIN users u ON t.owner_id=u.id LEFT JOIN clients c ON t.client_id=c.id WHERE t.status!='done' AND (t.deadline=${today} OR t.post_date=${today}) ORDER BY t.priority`;
    },
    async createTask({id,title,description,links,media,priority,owner_id,client_id,deadline,post_date,content_type,estimated_hours,ai_checklist,created_by}) {
      const r=await sql`INSERT INTO tasks(id,title,description,links,media,priority,owner_id,client_id,deadline,post_date,content_type,estimated_hours,ai_checklist,created_by) VALUES(${id},${title},${description||''},${links||'[]'},${media||'[]'},${priority||'P3'},${owner_id||null},${client_id||null},${deadline||null},${post_date||null},${content_type||null},${estimated_hours||null},${ai_checklist||'[]'},${created_by||null}) RETURNING *`;
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
      await sql`UPDATE tasks SET title=${f.title||''},description=${f.description||''},links=${f.links||'[]'},media=${f.media||'[]'},priority=${f.priority||'P3'},owner_id=${f.owner_id||null},client_id=${f.client_id||null},deadline=${f.deadline||null},post_date=${f.post_date||null},content_type=${f.content_type||null},estimated_hours=${f.estimated_hours||null},ai_checklist=${f.ai_checklist||'[]'},updated_at=NOW() WHERE id=${id}`;
    },
    async deleteTask(id) { await sql`DELETE FROM tasks WHERE id=${id}`; },
    async deleteTasks(ids) {
      // Delete multiple tasks by id array
      for (const id of ids) { await sql`DELETE FROM tasks WHERE id=${id}`; }
    },

    // ── FOLLOWUPS ─────────────────────────────────────────
    async getFollowups() {
      return sql`SELECT f.*,c.name AS client_name,c.logo AS client_logo,u.name AS assignee_name,u.image AS assignee_image FROM followups f LEFT JOIN clients c ON f.client_id=c.id LEFT JOIN users u ON f.assigned_to=u.id ORDER BY f.due_date ASC NULLS LAST,f.created_at DESC`;
    },
    async createFollowup({id,client_id,subject,due_date,assigned_to,created_by}) {
      const r=await sql`INSERT INTO followups(id,client_id,subject,due_date,assigned_to,created_by) VALUES(${id},${client_id||null},${subject},${due_date||null},${assigned_to||null},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async doneFollowup(id,body)       { await sql`UPDATE followups SET status='done',body=${body||null},sent_at=NOW(),updated_at=NOW() WHERE id=${id}`; },
    async updateFollowupBody(id,body) { await sql`UPDATE followups SET body=${body||null},updated_at=NOW() WHERE id=${id}`; },
    async deleteFollowup(id)          { await sql`DELETE FROM followups WHERE id=${id}`; },
    async deleteAllFollowups()        { await sql`DELETE FROM followups WHERE status='done'`; },
    async deleteAllDoneTasks()        { await sql`DELETE FROM tasks WHERE status='done'`; },

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
      return sql`SELECT u.id,u.email,u.name,u.role,u.job_title,u.coins,u.streak,u.image,u.phone,u.created_at,COUNT(t.id)::int AS total_tasks,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END)::int AS done_tasks,SUM(CASE WHEN t.status!='done' AND t.deadline IS NOT NULL AND t.deadline<CURRENT_DATE THEN 1 ELSE 0 END)::int AS overdue_tasks,ROUND(AVG(CASE WHEN t.quality_rating IS NOT NULL THEN t.quality_rating END),1) AS avg_quality FROM users u LEFT JOIN tasks t ON t.owner_id=u.id GROUP BY u.id ORDER BY u.coins DESC`;
    },

    // ── DASHBOARD ─────────────────────────────────────────
    async getDashboard() {
      const [tasks,members,rewards,followups]=await Promise.all([
        sql`SELECT status,priority,deadline::text,post_date::text,quality_rating,title FROM tasks`,
        sql`SELECT id,name,coins,streak,job_title,role,image FROM users ORDER BY coins DESC`,
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
    // ── FINANCE ─────────────────────────────────────────
    async getFinance({ from, to, type } = {}) {
      if (from && to) return sql`SELECT * FROM finance WHERE entry_date BETWEEN ${from} AND ${to} ORDER BY entry_date DESC, created_at DESC`;
      if (from) return sql`SELECT * FROM finance WHERE entry_date >= ${from} ORDER BY entry_date DESC, created_at DESC`;
      return sql`SELECT * FROM finance ORDER BY entry_date DESC, created_at DESC LIMIT 200`;
    },
    async createFinance({id,name,amount,transaction_type,payment_for,brand_name,transaction_mode,description,closing_balance,direction,entry_date,created_by}) {
      const r = await sql`INSERT INTO finance(id,name,amount,transaction_type,payment_for,brand_name,transaction_mode,description,closing_balance,direction,entry_date,created_by) VALUES(${id},${name},${amount},${transaction_type||'expense'},${payment_for||null},${brand_name||null},${transaction_mode||'UPI'},${description||null},${closing_balance||null},${direction||'give'},${entry_date||null},${created_by||null}) RETURNING *`;
      return r[0];
    },
    async updateFinance(id,f) {
      await sql`UPDATE finance SET name=${f.name},amount=${f.amount},transaction_type=${f.transaction_type||'expense'},payment_for=${f.payment_for||null},brand_name=${f.brand_name||null},transaction_mode=${f.transaction_mode||'UPI'},description=${f.description||null},closing_balance=${f.closing_balance||null},direction=${f.direction||'give'},entry_date=${f.entry_date||null} WHERE id=${id}`;
    },
    async deleteFinance(id) { await sql`DELETE FROM finance WHERE id=${id}`; },
    async getFinanceSummary() {
      const r = await sql`SELECT
        SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END)::numeric AS total_income,
        SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END)::numeric AS total_expense,
        SUM(CASE WHEN transaction_type='income' THEN amount ELSE -amount END)::numeric AS net_balance,
        SUM(CASE WHEN direction='get' THEN amount ELSE 0 END)::numeric AS to_get,
        SUM(CASE WHEN direction='give' AND transaction_type='expense' THEN amount ELSE 0 END)::numeric AS to_give,
        COUNT(*)::int AS total_entries
      FROM finance`;
      return r[0];
    },
    async getMonthlyFinance() {
      return sql`SELECT
        TO_CHAR(entry_date,'YYYY-MM') AS month,
        SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END)::numeric AS income,
        SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END)::numeric AS expense,
        COUNT(*)::int AS count
      FROM finance GROUP BY TO_CHAR(entry_date,'YYYY-MM') ORDER BY month DESC LIMIT 12`;
    },

    // ── NOTIFICATIONS ───────────────────────────────────
    async createNotification({id, user_id, type, title, body, task_id}) {
      await sql`INSERT INTO notifications(id,user_id,type,title,body,task_id) VALUES(${id},${user_id},${type},${title},${body},${task_id||null})`;
    },
    async getNotifications(userId) {
      return sql`SELECT * FROM notifications WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 50`;
    },
    async getUnreadCount(userId) {
      const r = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE user_id=${userId} AND read=FALSE`;
      return r[0]?.count || 0;
    },
    async getNewNotifications(userId, since) {
      // Cast to timestamptz to ensure correct timezone comparison
      return sql`SELECT * FROM notifications WHERE user_id=${userId} AND created_at > ${since}::timestamptz ORDER BY created_at ASC`;
    },
    async markAllRead(userId) {
      await sql`UPDATE notifications SET read=TRUE WHERE user_id=${userId}`;
    },
    async markRead(id) {
      await sql`UPDATE notifications SET read=TRUE WHERE id=${id}`;
    },
    async deleteNotification(id) {
      await sql`DELETE FROM notifications WHERE id=${id}`;
    },
    // ── APP SETTINGS ─────────────────────────────────
    async getSetting(key) {
      const r = await sql`SELECT value FROM app_settings WHERE key=${key} LIMIT 1`;
      if (!r[0]) return null;
      try { return JSON.parse(r[0].value); } catch { return r[0].value; }
    },
    async setSetting(key, value) {
      const v = typeof value === 'string' ? value : JSON.stringify(value);
      await sql`INSERT INTO app_settings(key,value,updated_at) VALUES(${key},${v},NOW()) ON CONFLICT(key) DO UPDATE SET value=${v},updated_at=NOW()`;
    },

    // ── CALENDARS ────────────────────────────────────
    async getCalendars(userId) {
      return sql`SELECT ca.*,cl.name AS client_name,cl.logo AS client_logo,
        COUNT(cp.id)::int AS post_count
        FROM calendars ca
        LEFT JOIN clients cl ON ca.client_id=cl.id
        LEFT JOIN calendar_posts cp ON cp.calendar_id=ca.id
        GROUP BY ca.id,cl.name,cl.logo ORDER BY ca.created_at DESC`;
    },
    async createCalendar({id,name,color,description,client_id,created_by}) {
      const r=await sql`INSERT INTO calendars(id,name,color,description,client_id,created_by)
        VALUES(${id},${name},${color||'#7C5CFC'},${description||null},${client_id||null},${created_by})
        RETURNING *`;
      return r[0];
    },
    async updateCalendar(id,f) {
      await sql`UPDATE calendars SET name=${f.name},color=${f.color||'#7C5CFC'},description=${f.description||null},client_id=${f.client_id||null} WHERE id=${id}`;
    },
    async deleteCalendar(id) {
      await sql`DELETE FROM calendar_posts WHERE calendar_id=${id}`;
      await sql`DELETE FROM calendars WHERE id=${id}`;
    },
    async getPosts(calendarId, from, to) {
      if (from && to) return sql`SELECT cp.*,u.name AS assignee_name,u.image AS assignee_image FROM calendar_posts cp LEFT JOIN users u ON cp.assigned_to=u.id WHERE cp.calendar_id=${calendarId} AND cp.publish_date>=${from} AND cp.publish_date<=${to} ORDER BY cp.publish_date,cp.publish_time`;
      if (calendarId) return sql`SELECT cp.*,u.name AS assignee_name,u.image AS assignee_image FROM calendar_posts cp LEFT JOIN users u ON cp.assigned_to=u.id WHERE cp.calendar_id=${calendarId} ORDER BY cp.publish_date,cp.publish_time`;
      return sql`SELECT cp.*,ca.name AS calendar_name,ca.color AS calendar_color,u.name AS assignee_name,u.image AS assignee_image FROM calendar_posts cp LEFT JOIN calendars ca ON cp.calendar_id=ca.id LEFT JOIN users u ON cp.assigned_to=u.id ORDER BY cp.publish_date,cp.publish_time`;
    },
    async getPostsByDateRange(from, to, calendarIds) {
      return sql`SELECT cp.*,ca.name AS calendar_name,ca.color AS calendar_color,u.name AS assignee_name,u.image AS assignee_image FROM calendar_posts cp LEFT JOIN calendars ca ON cp.calendar_id=ca.id LEFT JOIN users u ON cp.assigned_to=u.id WHERE cp.publish_date>=${from} AND cp.publish_date<=${to} ORDER BY cp.publish_date,cp.publish_time`;
    },
    async createPost({id,calendar_id,title,content_description,platform,content_type,status,assigned_to,topic_tags,target_audience,publish_date,publish_time,media,links,notes,created_by}) {
      const r=await sql`INSERT INTO calendar_posts(id,calendar_id,title,content_description,platform,content_type,status,assigned_to,topic_tags,target_audience,publish_date,publish_time,media,links,notes,created_by)
        VALUES(${id},${calendar_id},${title},${content_description||null},${platform||null},${content_type||null},${status||'planning'},${assigned_to||null},${topic_tags||'[]'},${target_audience||null},${publish_date||null},${publish_time||null},${media||'[]'},${links||'[]'},${notes||null},${created_by})
        RETURNING *`;
      return r[0];
    },
    async updatePost(id,f) {
      await sql`UPDATE calendar_posts SET title=${f.title},content_description=${f.content_description||null},platform=${f.platform||null},content_type=${f.content_type||null},status=${f.status||'planning'},assigned_to=${f.assigned_to||null},topic_tags=${f.topic_tags||'[]'},target_audience=${f.target_audience||null},publish_date=${f.publish_date||null},publish_time=${f.publish_time||null},media=${f.media||'[]'},links=${f.links||'[]'},notes=${f.notes||null},updated_at=NOW() WHERE id=${id}`;
    },
    async deletePost(id) { await sql`DELETE FROM calendar_posts WHERE id=${id}`; },

    // ── CHAT ─────────────────────────────────────────
    async getRooms(userId) {
      return sql`SELECT r.*,
        (SELECT COUNT(*)::int FROM chat_messages m WHERE m.room_id=r.id) AS msg_count,
        (SELECT m.content FROM chat_messages m WHERE m.room_id=r.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM chat_messages m WHERE m.room_id=r.id ORDER BY m.created_at DESC LIMIT 1) AS last_at
        FROM chat_rooms r
        INNER JOIN chat_members cm ON cm.room_id=r.id AND cm.user_id=${userId}
        ORDER BY last_at DESC NULLS LAST, r.created_at DESC`;
    },
    async getAllRooms() {
      return sql`SELECT r.*,
        (SELECT COUNT(*)::int FROM chat_messages m WHERE m.room_id=r.id) AS msg_count
        FROM chat_rooms r ORDER BY r.created_at DESC`;
    },
    async createRoom({id, name, type, created_by, memberIds}) {
      await sql`INSERT INTO chat_rooms(id,name,type,created_by) VALUES(${id},${name},${type||'group'},${created_by})`;
      for (const uid of memberIds) {
        await sql`INSERT INTO chat_members(room_id,user_id) VALUES(${id},${uid}) ON CONFLICT DO NOTHING`;
      }
      return (await sql`SELECT * FROM chat_rooms WHERE id=${id}`)[0];
    },
    async getRoomMembers(roomId) {
      return sql`SELECT u.id,u.name,u.email,u.image,u.role,u.job_title FROM chat_members cm JOIN users u ON cm.user_id=u.id WHERE cm.room_id=${roomId}`;
    },
    async addRoomMember(roomId, userId) {
      await sql`INSERT INTO chat_members(room_id,user_id) VALUES(${roomId},${userId}) ON CONFLICT DO NOTHING`;
    },
    async removeRoomMember(roomId, userId) {
      await sql`DELETE FROM chat_members WHERE room_id=${roomId} AND user_id=${userId}`;
    },
    async deleteRoom(id) {
      await sql`DELETE FROM chat_messages WHERE room_id=${id}`;
      await sql`DELETE FROM chat_members WHERE room_id=${id}`;
      await sql`DELETE FROM chat_rooms WHERE id=${id}`;
    },
    async getMessages(roomId, limit=80) {
      return sql`SELECT m.*,u.name AS user_name,u.image AS user_image FROM chat_messages m LEFT JOIN users u ON m.user_id=u.id WHERE m.room_id=${roomId} ORDER BY m.created_at ASC LIMIT ${limit}`;
    },
    async getNewMessages(roomId, since) {
      return sql`SELECT m.*,u.name AS user_name,u.image AS user_image FROM chat_messages m LEFT JOIN users u ON m.user_id=u.id WHERE m.room_id=${roomId} AND m.created_at>${since} ORDER BY m.created_at ASC`;
    },
    async sendMessage({id, room_id, user_id, content, media_url, media_type}) {
      const r = await sql`INSERT INTO chat_messages(id,room_id,user_id,content,media_url,media_type) VALUES(${id},${room_id},${user_id},${content||null},${media_url||null},${media_type||null}) RETURNING *`;
      return r[0];
    },
    async deleteMessage(id) { await sql`DELETE FROM chat_messages WHERE id=${id}`; },
    async isMember(roomId, userId) {
      const r = await sql`SELECT 1 FROM chat_members WHERE room_id=${roomId} AND user_id=${userId} LIMIT 1`;
      return r.length > 0;
    },
  };
}
