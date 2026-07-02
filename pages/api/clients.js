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
      SELECT c.*,
             COUNT(t.id) AS task_count,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count
      FROM clients c
      LEFT JOIN tasks t ON t.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all();
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { name, contact_name, contact_email, contact_phone, industry, notes, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = crypto.randomBytes(8).toString('hex');
    db.prepare(`INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, industry, notes, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, name, contact_name || null, contact_email || null, contact_phone || null, industry || null, notes || null, status, userId);
    return res.status(201).json({ id });
  }

  if (req.method === 'PATCH') {
    const { id, name, contact_name, contact_email, contact_phone, industry, notes, status } = req.body;
    db.prepare(`UPDATE clients SET name=?, contact_name=?, contact_email=?, contact_phone=?, industry=?, notes=?, status=?, updated_at=datetime('now') WHERE id=?`)
      .run(name, contact_name || null, contact_email || null, contact_phone || null, industry || null, notes || null, status || 'active', id);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
