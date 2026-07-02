import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { v4 as uuid } from 'uuid';

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/yoursocials.json'
  : join(process.cwd(), 'yoursocials.json');

const DEFAULT = {
  users: [],
  clients: [],
  tasks: [],
  followups: [],
  rewards: [
    { id: uuid(), name: 'Team Lunch',    emoji: '🍕', description: 'Celebrate with a team lunch',          coin_cost: 500,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Bowling Night', emoji: '🎳', description: 'Strike it up at the bowling alley',    coin_cost: 800,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Ice Skating',   emoji: '⛸️',  description: 'Cool off at the rink together',        coin_cost: 800,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Rock Climbing', emoji: '🧗', description: 'Reach new heights as a team',          coin_cost: 800,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Cricket Match', emoji: '🏏', description: 'Team vs team on the pitch',            coin_cost: 600,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Gaming Night',  emoji: '🎮', description: 'LAN party at the office',              coin_cost: 400,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Movie Night',   emoji: '🎬', description: 'Team movie outing',                    coin_cost: 500,   reward_type: 'weekly'  },
    { id: uuid(), name: 'Goa Trip',      emoji: '✈️',  description: 'Grand monthly prize — Goa team trip',  coin_cost: 13000, reward_type: 'monthly' },
  ],
};

function read() {
  try {
    if (existsSync(DB_PATH)) {
      const data = JSON.parse(readFileSync(DB_PATH, 'utf8'));
      return { ...DEFAULT, ...data };
    }
  } catch (e) { console.error('DB read:', e.message); }
  return { ...DEFAULT };
}

function write(data) {
  try { writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('DB write:', e.message); }
}

export function getDb() {
  const data = read();

  return {
    data,

    // ── USERS ────────────────────────────────────────────────
    getUsers()          { return data.users; },
    getUserById(id)     { return data.users.find(u => u.id === id) || null; },
    getUserByEmail(e)   { return data.users.find(u => u.email === e) || null; },

    createUser(fields) {
      const user = { id: uuid(), role: 'member', job_title: '', coins: 0, streak: 0, created_at: new Date().toISOString(), ...fields };
      data.users.push(user);
      write(data);
      return user;
    },

    updateUser(id, updates) {
      const i = data.users.findIndex(u => u.id === id);
      if (i >= 0) { data.users[i] = { ...data.users[i], ...updates }; write(data); return data.users[i]; }
      return null;
    },

    deleteUser(id) {
      data.users = data.users.filter(u => u.id !== id);
      write(data);
    },

    addCoins(userId, amount) {
      const i = data.users.findIndex(u => u.id === userId);
      if (i >= 0) { data.users[i].coins = (data.users[i].coins || 0) + amount; write(data); }
    },

    // ── CLIENTS ──────────────────────────────────────────────
    getClients() {
      return data.clients.map(c => ({
        ...c,
        task_count: data.tasks.filter(t => t.client_id === c.id).length,
        done_count: data.tasks.filter(t => t.client_id === c.id && t.status === 'done').length,
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    createClient(fields) {
      const client = { id: uuid(), status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields };
      data.clients.push(client);
      write(data);
      return client;
    },

    updateClient(id, updates) {
      const i = data.clients.findIndex(c => c.id === id);
      if (i >= 0) { data.clients[i] = { ...data.clients[i], ...updates, updated_at: new Date().toISOString() }; write(data); }
    },

    deleteClient(id) {
      data.clients = data.clients.filter(c => c.id !== id);
      write(data);
    },

    // ── TASKS ────────────────────────────────────────────────
    getTasks() {
      return data.tasks.map(t => {
        const owner  = data.users.find(u => u.id === t.owner_id)    || null;
        const client = data.clients.find(c => c.id === t.client_id) || null;
        return { ...t, owner_name: owner?.name || null, owner_image: null, client_name: client?.name || null };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    createTask(fields) {
      const task = { id: uuid(), status: 'todo', priority: 'P3', ai_checklist: '[]', completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields };
      data.tasks.push(task);
      write(data);
      return task;
    },

    updateTask(id, updates) {
      const i = data.tasks.findIndex(t => t.id === id);
      if (i >= 0) {
        data.tasks[i] = { ...data.tasks[i], ...updates, updated_at: new Date().toISOString() };
        if (updates.status === 'done') data.tasks[i].completed_at = new Date().toISOString();
        write(data);
      }
    },

    deleteTask(id) { data.tasks = data.tasks.filter(t => t.id !== id); write(data); },

    // ── FOLLOWUPS ────────────────────────────────────────────
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
      const f = { id: uuid(), status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields };
      data.followups.push(f);
      write(data);
      return f;
    },

    updateFollowup(id, updates) {
      const i = data.followups.findIndex(f => f.id === id);
      if (i >= 0) {
        data.followups[i] = { ...data.followups[i], ...updates, updated_at: new Date().toISOString() };
        if (updates.status === 'done') data.followups[i].sent_at = new Date().toISOString();
        write(data);
      }
    },

    deleteFollowup(id) { data.followups = data.followups.filter(f => f.id !== id); write(data); },

    // ── MEMBERS with stats ───────────────────────────────────
    getMembers() {
      const today = new Date().toISOString().split('T')[0];
      return data.users.map(u => {
        const mt    = data.tasks.filter(t => t.owner_id === u.id);
        const done  = mt.filter(t => t.status === 'done').length;
        const over  = mt.filter(t => t.status !== 'done' && t.deadline && t.deadline < today).length;
        const qArr  = mt.filter(t => t.quality_rating);
        const avgQ  = qArr.length ? qArr.reduce((s, t) => s + t.quality_rating, 0) / qArr.length : null;
        const { password, ...safe } = u;
        return { ...safe, total_tasks: mt.length, done_tasks: done, overdue_tasks: over, avg_quality: avgQ };
      }).sort((a, b) => (b.coins || 0) - (a.coins || 0));
    },

    // ── REWARDS ──────────────────────────────────────────────
    getRewards() { return [...data.rewards].sort((a, b) => a.coin_cost - b.coin_cost); },

    // ── DASHBOARD ────────────────────────────────────────────
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
      const qArr    = tasks.filter(t => t.quality_rating);
      const avgQ    = qArr.length ? (qArr.reduce((s, t) => s + t.quality_rating, 0) / qArr.length).toFixed(1) : null;
      const compPct = total > 0 ? Math.round((done / total) * 100) : 0;
      const health  = Math.min(100, Math.round(compPct * 0.4 + Math.max(0, 100 - overdue * 15) * 0.4 + 20));
      const members = data.users.map(u => { const { password, ...s } = u; return s; });
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
