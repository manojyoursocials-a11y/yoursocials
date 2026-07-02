import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET') {
    const rows = db.prepare(`
      SELECT u.*,
             COUNT(t.id) AS total_tasks,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
             SUM(CASE WHEN t.status != 'done' AND t.deadline IS NOT NULL AND t.deadline < date('now') THEN 1 ELSE 0 END) AS overdue_tasks,
             AVG(CASE WHEN t.quality_rating IS NOT NULL THEN t.quality_rating ELSE NULL END) AS avg_quality
      FROM users u
      LEFT JOIN tasks t ON t.owner_id = u.id
      GROUP BY u.id
      ORDER BY u.coins DESC
    `).all();
    return res.json(rows);
  }

  if (req.method === 'PATCH') {
    const { job_title, role } = req.body;
    const userId = session.user.id;
    db.prepare('UPDATE users SET job_title = ?, role = ? WHERE id = ?').run(job_title || null, role || 'member', userId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
