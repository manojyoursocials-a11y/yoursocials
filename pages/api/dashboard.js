import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const [tasksRes, membersRes, followupsRes, rewardsRes] = await Promise.all([
    sql`SELECT status, priority, deadline, owner_id, quality_rating,
               title, client_id FROM tasks ORDER BY created_at DESC`,
    sql`SELECT id, name, image, coins, streak, job_title, role FROM users ORDER BY coins DESC`,
    sql`SELECT id, status FROM followups`,
    sql`SELECT * FROM rewards ORDER BY coin_cost`,
  ]);

  const tasks     = tasksRes.rows;
  const members   = membersRes.rows;
  const followups = followupsRes.rows;
  const rewards   = rewardsRes.rows;

  const total    = tasks.length;
  const done     = tasks.filter(t => t.status === 'done').length;
  const inProg   = tasks.filter(t => t.status === 'inprogress').length;
  const review   = tasks.filter(t => t.status === 'review').length;
  const todo     = tasks.filter(t => t.status === 'todo').length;
  const today    = new Date().toISOString().split('T')[0];
  const overdue  = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline.toString().slice(0,10) < today).length;
  const dueToday = tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline.toString().slice(0,10) === today);

  const qualityTasks = tasks.filter(t => t.quality_rating);
  const avgQuality   = qualityTasks.length > 0
    ? (qualityTasks.reduce((s, t) => s + t.quality_rating, 0) / qualityTasks.length).toFixed(1)
    : null;

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const healthScore   = Math.min(100, Math.round(
    completionPct * 0.4 + Math.max(0, 100 - overdue * 15) * 0.4 + 20
  ));

  const pendingFollowups = followups.filter(f => f.status === 'pending').length;
  const totalCoins       = members.reduce((s, m) => s + (m.coins || 0), 0);

  res.json({
    stats: { total, done, inProg, review, todo, overdue, avgQuality, completionPct, healthScore, pendingFollowups, totalCoins },
    dueToday,
    members,
    rewards,
  });
}
