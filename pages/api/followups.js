import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import crypto from 'crypto';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET') {
    const rows = db.prepare(`
      SELECT f.*, c.name AS client_name, u.name AS assignee_name
      FROM followups f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN users   u ON f.assigned_to = u.id
      ORDER BY f.due_date ASC, f.created_at DESC
    `).all();
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { client_id, subject, due_date, assigned_to } = req.body;
    if (!subject) return res.status(400).json({ error: 'Subject required' });
    const id = crypto.randomBytes(8).toString('hex');
    db.prepare(`INSERT INTO followups (id, client_id, subject, due_date, assigned_to, created_by) VALUES (?,?,?,?,?,?)`)
      .run(id, client_id || null, subject, due_date || null, assigned_to || userId, userId);
    return res.status(201).json({ id });
  }

  if (req.method === 'PATCH') {
    const { id, status, body } = req.body;
    const sentAt = status === 'done' ? `datetime('now')` : 'sent_at';
    db.prepare(`UPDATE followups SET status = COALESCE(?, status), body = COALESCE(?, body), sent_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE sent_at END, updated_at = datetime('now') WHERE id = ?`)
      .run(status || null, body || null, status || null, id);
    if (status === 'done') {
      db.prepare('UPDATE users SET coins = coins + 30 WHERE id = ?').run(userId);
    }
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    db.prepare('DELETE FROM followups WHERE id = ?').run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
