import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

// Admin-only: bulk clear done tasks or done followups
export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDb();
  const { type } = req.query;
  if (type === 'done-tasks') {
    await db.deleteAllDoneTasks();
    return res.json({ ok: true, cleared: 'done-tasks' });
  }
  if (type === 'done-followups') {
    await db.deleteAllFollowups();
    return res.json({ ok: true, cleared: 'done-followups' });
  }
  return res.status(400).json({ error: 'type must be done-tasks or done-followups' });
}
