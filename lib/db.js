import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Storage path — /tmp on Vercel (writable), local dir in dev
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/yoursocials.json'
  : join(process.cwd(), 'yoursocials.json');

// ── Default structure ────────────────────────────────────────
const DEFAULT = {
  users: [],
  clients: [],
  tasks: [],
  followups: [],
  rewards: [
    { id: uuidv4(), name: 'Team Lunch',    emoji: '🍕', description: 'Celebrate with a team lunch',         coin_cost: 500,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Bowling Night', emoji: '🎳', description: 'Strike it up at the bowling alley',   coin_cost: 800,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Ice Skating',   emoji: '⛸️',  description: 'Cool off at the rink together',       coin_cost: 800,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Rock Climbing', emoji: '🧗', description: 'Reach new heights as a team',         coin_cost: 800,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Cricket Match', emoji: '🏏', description: 'Team vs team on the pitch',           coin_cost: 600,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Gaming Night',  emoji: '🎮', description: 'LAN party at the office',             coin_cost: 400,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Movie Night',   emoji: '🎬', description: 'Team movie outing',                   coin_cost: 500,   reward_type: 'weekly',  status: 'locked' },
    { id: uuidv4(), name: 'Goa Trip',      emoji: '✈️',  description: 'Grand monthly prize — Goa team trip', coin_cost: 13000, reward_type: 'monthly', status: 'locked' },
  ],
};

// ── Read / write helpers ─────────────────────────────────────
function read() {
  try {
    if (existsSync(DB_PATH)) {
      const raw = readFileSync(DB_PATH, 'utf8');
      const data = JSON.parse(raw);
      // Ensure all collections exist (forward-compat)
      return { ...DEFAULT, ...data };
    }
  } catch (e) {
    console.error('DB read error:', e.message);
  }
  return { ...DEFAULT };
}

function write(data) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('DB write error:', e.message);
  }
}

// ── Public API — mimics the old getDb() interface ───────────
// Returns a db object with helper methods used across API routes
export function getDb() {
  const data = read();

  return {
    // ── Raw access ──────────────────────────────────────────
    data,
    save: () => write(data),

    // ── Users ───────────────────────────────────────────────
    upsertUser({ id, email, name, image }) {
      const idx = data.users.findIndex(u => u.email === email);
      if (idx >= 0) {
        data.users[idx] = { ...data.users[idx], name, image };
      } else {
        data.users.push({ id: id || uuidv4(), email, name: name || '', image: image || '', role: 'member', job_title: '', coins: 0, streak: 0, created_at: new Date().toISOString() });
      }
      write(data);
    },

    getUserByEmail(email) {
      return data.users.find(u => u.email === email) || null;
    },

    updateUser(id, updates) {
      const idx = data.users.findIndex(u => u.id === id);
      if (idx >= 0) { data.users[idx] = { ...data.users[idx], ...updates }; write(data); }
    },

    addCoins(userId, amount) {
      const idx = data.users.findIndex(u => u.id === userId);
      if (idx >= 0) { data.users[idx].coins = (data.users[idx].coins || 0) + amount; write(data); }
    },

    // ── Tasks ────────────────────────────────────────────────
    getTasks() {
      return data.tasks.map(t => {
        const owner  = data.users.find(u => u.id === t.owner_id)  || null;
        const client = data.clients.find(c => c.id === t.client_id) || null;
        return { ...t, owner_name: owner?.name || null, owner_image: owner?.image || null, client_name: client?.name || null };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    createTask(fields) {
      const task = { id: uuidv4(), status: 'todo', priority: 'P3', ai_checklist: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null, ...fields };
      data.tasks.push(task);
      write(data);
      return task;
    },

    updateTask(id, updates) {
      const idx = data.tasks.findIndex(t => t.id === id);
      if (idx >= 0) {
        data.tasks[idx] = { ...data.tasks[idx], ...updates, updated_at: new Date().toISOString() };
        if (updates.status === 'done') data.tasks[idx].completed_at = new Date().toISOString();
        write(data);
      }
    },

    deleteTask(id) {
      data.tasks = data.tasks.filter(t => t.id !== id);
      write(data);
    },

    // ── Clients ──────────────────────────────────────────────
    getClients() {
      return data.clients.map(c => {
        const clientTasks = data.tasks.filter(t => t.client_id === c.id);
        return { ...c, task_count: clientTasks.length, done_count: clientTasks.filter(t => t.status === 'done').length };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    createClient(fields) {
      const client = { id: uuidv4(), status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields };
      data.clients.push(client);
      write(data);
      return client;
    },

    updateClient(id, updates) {
      const idx = data.clients.findIndex(c => c.id === id);
      if (idx >= 0) { data.clients[idx] = { ...data.clients[idx], ...updates, updated_at: new Date().toISOString() }; write(data); }
    },

    deleteClient(id) {
      data.clients = data.clients.filter(c => c.id !== id);
      write(data);
    },

    // ── Follow-ups ───────────────────────────────────────────
    getFollowups() {
      return data.followups.map(f => {
        const client   = data.clients.find(c => c.id === f.client_id) || null;
        const assignee = data.users.find(u => u.id === f.assigned_to)  || null;
        return { ...f, client_name: client?.name || null, assignee_name: assignee?.name || null };
      }).sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return new Date(b.created_at) - new Date(a.created_at);
      });
    },

    createFollowup(fields) {
      const f = { id: uuidv4(), status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields };
      data.followups.push(f);
      write(data);
      return f;
    },

    updateFollowup(id, updates) {
      const idx = data.followups.findIndex(f => f.id === id);
      if (idx >= 0) {
        data.followups[idx] = { ...data.followups[idx], ...updates, updated_at: new Date().toISOString() };
        if (updates.status === 'done') data.followups[idx].sent_at = new Date().toISOString();
        write(data);
      }
    },

    deleteFollowup(id) {
      data.followups = data.followups.filter(f => f.id !== id);
      write(data);
    },

    // ── Members (with task stats) ────────────────────────────
    getMembers() {
      const today = new Date().toISOString().split('T')[0];
      return data.users.map(u => {
        const mt      = data.tasks.filter(t => t.owner_id === u.id);
        const done    = mt.filter(t => t.status === 'done').length;
        const overdue = mt.filter(t => t.status !== 'done' && t.deadline && t.deadline < today).length;
        const qTasks  = mt.filter(t => t.quality_rating);
        const avgQ    = qTasks.length ? qTasks.reduce((s, t) => s + t.quality_rating, 0) / qTasks.length : null;
        return { ...u, total_tasks: mt.length, done_tasks: done, overdue_tasks: overdue, avg_quality: avgQ };
      }).sort((a, b) => (b.coins || 0) - (a.coins || 0));
    },

    // ── Rewards ──────────────────────────────────────────────
    getRewards() {
      return [...data.rewards].sort((a, b) => a.coin_cost - b.coin_cost);
    },

    // ── Dashboard ────────────────────────────────────────────
    getDashboard() {
      const today   = new Date().toISOString().split('T')[0];
      const tasks   = data.tasks;
      const total   = tasks.length;
      const done    = tasks.filter(t => t.status === 'done').length;
      const inProg  = tasks.filter(t => t.status === 'inprogress').length;
      const review  = tasks.filter(t => t.status === 'review').length;
      const todo    = tasks.filter(t => t.status === 'todo').length;
      const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today).length;
      const dueToday = tasks.filter(t => t.status !== 'done' && t.deadline === today);
      const qTasks  = tasks.filter(t => t.quality_rating);
      const avgQ    = qTasks.length ? (qTasks.reduce((s, t) => s + t.quality_rating, 0) / qTasks.length).toFixed(1) : null;
      const compPct = total > 0 ? Math.round((done / total) * 100) : 0;
      const health  = Math.min(100, Math.round(compPct * 0.4 + Math.max(0, 100 - overdue * 15) * 0.4 + 20));
      const members = data.users;
      const totalCoins = members.reduce((s, u) => s + (u.coins || 0), 0);
      const pending = data.followups.filter(f => f.status === 'pending').length;

      return {
        stats: { total, done, inProg, review, todo, overdue, avgQuality: avgQ, completionPct: compPct, healthScore: health, pendingFollowups: pending, totalCoins },
        dueToday,
        members: members.sort((a, b) => (b.coins || 0) - (a.coins || 0)),
        rewards: this.getRewards(),
      };
    },
  };
}
