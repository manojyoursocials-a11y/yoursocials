import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

const DEFAULT_NOTIF = {
  task_created:    true,
  task_assigned:   true,
  task_moved:      true,
  task_edited:     true,
  task_deleted:    true,
  followup_created:true,
  followup_done:   true,
  client_created:  true,
  client_updated:  true,
  client_deleted:  true,
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET') {
    const saved = await db.getSetting('notif_settings');
    return res.json({ ...DEFAULT_NOTIF, ...(saved || {}) });
  }

  if (req.method === 'PATCH') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const current = await db.getSetting('notif_settings') || {};
    const updated = { ...DEFAULT_NOTIF, ...current, ...req.body };
    await db.setSetting('notif_settings', updated);
    return res.json(updated);
  }

  res.status(405).end();
}
