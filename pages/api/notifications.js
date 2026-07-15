import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const userId = session.user.id;
    const db = getDb();

    if (req.method === 'GET') {
      try {
        if (req.query.since) {
          const notifs = await db.getNewNotifications(userId, req.query.since);
          const count  = await db.getUnreadCount(userId);
          return res.json({ notifications: notifs, unread: count });
        }
        const notifs = await db.getNotifications(userId);
        const count  = await db.getUnreadCount(userId);
        return res.json({ notifications: notifs, unread: count });
      } catch(e) {
        console.error('GET notifications error:', e.message);
        // Return empty gracefully — never 500 on GET
        return res.json({ notifications: [], unread: 0 });
      }
    }

    if (req.method === 'PATCH') {
      try {
        const { id, all } = req.body;
        if (all) await db.markAllRead(userId);
        else if (id) await db.markRead(id);
        return res.json({ ok: true });
      } catch(e) {
        console.error('PATCH notifications error:', e.message);
        return res.json({ ok: true }); // fail silently
      }
    }

    if (req.method === 'DELETE') {
      try {
        await db.deleteNotification(req.query.id);
        return res.json({ ok: true });
      } catch(e) {
        console.error('DELETE notifications error:', e.message);
        return res.json({ ok: true });
      }
    }

    res.status(405).end();
  } catch(e) {
    console.error('Notifications handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
