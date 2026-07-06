import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  // GET — fetch notifications for current user
  // ?since=ISO_TIMESTAMP returns only new ones (for polling)
  if (req.method === 'GET') {
    if (req.query.since) {
      const notifs = await db.getNewNotifications(userId, req.query.since);
      const count  = await db.getUnreadCount(userId);
      return res.json({ notifications: notifs, unread: count });
    }
    const notifs = await db.getNotifications(userId);
    const count  = await db.getUnreadCount(userId);
    return res.json({ notifications: notifs, unread: count });
  }

  // PATCH — mark read
  if (req.method === 'PATCH') {
    const { id, all } = req.body;
    if (all) await db.markAllRead(userId);
    else if (id) await db.markRead(id);
    return res.json({ ok: true });
  }

  // DELETE — remove one
  if (req.method === 'DELETE') {
    await db.deleteNotification(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
