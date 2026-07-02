import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET') {
    return res.json(db.getTasks());
  }

  if (req.method === 'POST') {
    const { title, description, priority, owner_id, client_id, deadline, estimated_hours, ai_checklist } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const task = db.createTask({ title, description: description || '', priority: priority || 'P3', owner_id: owner_id || userId, client_id: client_id || null, deadline: deadline || null, estimated_hours: estimated_hours || null, ai_checklist: typeof ai_checklist === 'string' ? ai_checklist : JSON.stringify(ai_checklist || []), created_by: userId });
    db.addCoins(userId, 50);
    return res.status(201).json(task);
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    db.updateTask(id, updates);
    if (updates.status === 'done') db.addCoins(userId, 100);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    db.deleteTask(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
