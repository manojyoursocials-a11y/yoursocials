import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

async function notifyAll(db, payload, actorId) {
  try {
    const users = await db.getUsers();
    for (const u of users) {
      if (u.id === actorId) continue;
      await db.createNotification({ id: uuid(), user_id: u.id, ...payload, task_id: payload.task_id || null });
    }
  } catch(e) {}
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET')  return res.json(await db.getFollowups());

  if (req.method === 'POST') {
    if (!req.body.subject) return res.status(400).json({ error: 'Subject required' });
    const fu = await db.createFollowup({
      ...req.body, id: uuid(),
      assigned_to: req.body.assigned_to || userId,
      created_by: userId,
    });
    const uName = session.user.name || session.user.email || 'Someone';
    await notifyAll(db, { id: uuid(), type:'followup_created', title:'📩 New follow-up added', body:`${uName} added follow-up: "${req.body.subject}"` }, userId);
    return res.status(201).json(fu);
  }

  if (req.method === 'PATCH') {
    const { id, status, body } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const uName2 = session.user.name || session.user.email || 'Someone';
    if (status === 'done') {
      await db.doneFollowup(id, body || null);
      await db.addCoins(userId, 30);
      await notifyAll(db, { id: uuid(), type:'followup_done', title:'✅ Follow-up completed', body:`${uName2} marked a follow-up as sent (+30 🪙)` }, userId);
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
