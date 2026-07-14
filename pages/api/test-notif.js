// Debug endpoint — sends a real test notification to the current user
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  try {
    // Insert a real notification for the calling user
    await db.createNotification({
      id:      uuid(),
      user_id: session.user.id,
      type:    'task_assigned',
      title:   '🔔 Test notification',
      body:    'Notifications are working! Sound + popup should have fired.',
      task_id: null,
    });
    // Also send to ALL users so the whole team can verify
    const users = await db.getUsers();
    for (const u of users) {
      if (u.id === session.user.id) continue;
      await db.createNotification({
        id:      uuid(),
        user_id: u.id,
        type:    'task_assigned',
        title:   '🔔 Test from ' + (session.user.name || 'Admin'),
        body:    'Notification test — if you see this, notifications are working!',
        task_id: null,
      });
    }
    return res.json({ ok: true, sent_to: users.length });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
