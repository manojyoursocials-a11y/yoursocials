import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET') {
    const rows = db.prepare(`
      SELECT t.*,
             u.name  AS owner_name,
             u.image AS owner_image,
             c.name  AS client_name
      FROM tasks t
      LEFT JOIN users   u ON t.owner_id  = u.id
      LEFT JOIN clients c ON t.client_id = c.id
      ORDER BY t.created_at DESC
    `).all();
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { title, description = '', priority = 'P3', owner_id, client_id, deadline, estimated_hours, ai_checklist = '[]' } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const id = require('crypto').randomBytes(8).toString('hex');
    db.prepare(`
      INSERT INTO tasks (id, title, description, priority, owner_id, client_id, deadline, estimated_hours, ai_checklist, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, description, priority, owner_id || userId, client_id || null, deadline || null, estimated_hours || null, typeof ai_checklist === 'string' ? ai_checklist : JSON.stringify(ai_checklist), userId);
    db.prepare('UPDATE users SET coins = coins + 50 WHERE id = ?').run(userId);
    return res.status(201).json({ id });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const allowed = ['title', 'description', 'status', 'priority', 'owner_id', 'client_id', 'deadline', 'estimated_hours', 'actual_hours', 'quality_rating', 'ai_checklist'];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'No valid fields' });
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const vals = fields.map(f => f === 'ai_checklist' ? JSON.stringify(updates[f]) : updates[f]);
    const completedAt = updates.status === 'done' ? `, completed_at = datetime('now')` : '';
    db.prepare(`UPDATE tasks SET ${sets}${completedAt}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
    if (updates.status === 'done') {
      db.prepare('UPDATE users SET coins = coins + 100 WHERE id = ?').run(userId);
    }
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
