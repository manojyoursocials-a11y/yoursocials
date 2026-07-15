// Save/delete a push subscription for the current user
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'POST') {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await db.savePushSubscription({
      id:      uuid(),
      user_id: session.user.id,
      endpoint,
      p256dh:  keys.p256dh,
      auth:    keys.auth,
    });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (endpoint) await db.deletePushSubscription(endpoint);
    return res.json({ ok: true });
  }

  // GET — return subscription count (for admin panel)
  if (req.method === 'GET') {
    const count = await db.getPushSubCount();
    return res.json({ count });
  }

  res.status(405).end();
}
