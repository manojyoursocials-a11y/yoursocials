import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const db = getDb();
    // Mark all read for all users (can't delete all directly, so mark read)
    const users = await db.getUsers();
    for (const u of users) {
      await db.markAllRead(u.id);
    }
    return res.json({ ok: true, cleared_for: users.length + ' users' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
