import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET')    return res.json(db.getFollowups());
  if (req.method === 'POST')   { if (!req.body.subject) return res.status(400).json({ error: 'Subject required' }); return res.status(201).json(db.createFollowup({ ...req.body, assigned_to: req.body.assigned_to || userId, created_by: userId })); }
  if (req.method === 'PATCH')  { const { id, ...rest } = req.body; db.updateFollowup(id, rest); if (rest.status === 'done') db.addCoins(userId, 30); return res.json({ ok: true }); }
  if (req.method === 'DELETE') { db.deleteFollowup(req.query.id); return res.json({ ok: true }); }
  res.status(405).end();
}
