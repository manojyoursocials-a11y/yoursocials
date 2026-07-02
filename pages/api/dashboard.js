import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const tasks     = db.prepare('SELECT * FROM tasks').all();
  const members   = db.prepare('SELECT id, name, image, coins, streak, job_title, role FROM users ORDER BY coins DESC').all();
  const rewards   = db.prepare('SELECT * FROM rewards ORDER BY coin_cost').all();
  const followups = db.prepare("SELECT id, status FROM followups WHERE status = 'pending'").all();

  const total    = tasks.length;
  const done     = tasks.filter(t => t.status === 'done').length;
  const inProg   = tasks.filter(t => t.status === 'inprogress').length;
  const review   = tasks.filter(t => t.status === 'review').length;
  const todo     = tasks.filter(t => t.status === 'todo').length;
  const overdue  = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < today).length;
  const dueToday = tasks.filter(t => t.status !== 'done' && t.deadline === today);
  const qTasks   = tasks.filter(t => t.quality_rating);
  const avgQ     = qTasks.length ? (qTasks.reduce((s, t) => s + t.quality_rating, 0) / qTasks.length).toFixed(1) : null;
  const compPct  = total > 0 ? Math.round((done / total) * 100) : 0;
  const health   = Math.min(100, Math.round(compPct * 0.4 + Math.max(0, 100 - overdue * 15) * 0.4 + 20));
  const totalCoins = members.reduce((s, m) => s + (m.coins || 0), 0);

  res.json({
    stats: { total, done, inProg, review, todo, overdue, avgQuality: avgQ, completionPct: compPct, healthScore: health, pendingFollowups: followups.length, totalCoins },
    dueToday,
    members,
    rewards,
  });
}
