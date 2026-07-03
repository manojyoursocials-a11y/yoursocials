import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET')  return res.json(await db.getFollowups());

  if (req.method === 'POST') {
    if (!req.body.subject) return res.status(400).json({ error: 'Subject required' });
    return res.status(201).json(await db.createFollowup({
      ...req.body, id: uuid(),
      assigned_to: req.body.assigned_to || userId,
      created_by: userId,
    }));
  }

  if (req.method === 'PATCH') {
    const { id, status, body } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    if (status === 'done') {
      await db.doneFollowup(id, body || null);
      await db.addCoins(userId, 30);
    } else {
      await db.updateFollowupBody(id, body || null);
    }
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await db.deleteFollowup(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
