import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET') {
    if (req.query.member) return res.json(await db.getTasksByMember(req.query.member));
    return res.json(await db.getTasks());
  }

  if (req.method === 'POST') {
    const { title, description, link, priority, owner_id, client_id, deadline, estimated_hours, ai_checklist } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const task = await db.createTask({
      id: uuid(), title,
      description: description || '',
      link: link || null,
      priority: priority || 'P3',
      owner_id: owner_id || userId,
      client_id: client_id || null,
      deadline: deadline || null,
      estimated_hours: estimated_hours || null,
      ai_checklist: typeof ai_checklist === 'string' ? ai_checklist : JSON.stringify(ai_checklist || []),
      created_by: userId,
    });
    await db.addCoins(userId, 10);
    return res.status(201).json(task);
  }

  if (req.method === 'PATCH') {
    const body = req.body;
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    // If body has 'status' but no 'title' — it's a STATUS MOVE
    if (body.status !== undefined && body.title === undefined) {
      await db.moveTask(id, body.status);
      if (body.status === 'done') await db.addCoins(userId, 50);
      return res.json({ ok: true });
    }

    // If body has 'title' — it's a FULL EDIT
    if (body.title !== undefined) {
      await db.editTask(id, body);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Provide status (to move) or title (to edit)' });
  }

  if (req.method === 'DELETE') {
    await db.deleteTask(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
