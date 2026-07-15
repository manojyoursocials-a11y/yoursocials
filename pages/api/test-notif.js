import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  const users = await db.getUsers();
  const notifId = uuid();
  const now = new Date().toISOString();
  
  for (const u of users) {
    await db.createNotification({
      id:      uuid(),
      user_id: u.id,
      type:    'task_assigned',
      title:   '🔔 Test — ' + now.slice(11,19),
      body:    (session.user.name || 'Admin') + ' sent a test notification to everyone',
      task_id: null,
    });
  }
  return res.json({ ok: true, sent_to: users.length, at: now });
}
