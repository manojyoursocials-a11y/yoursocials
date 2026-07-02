import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT c.*,
             COUNT(t.id)::int                                    AS task_count,
             COUNT(t.id) FILTER (WHERE t.status = 'done')::int  AS done_count
      FROM clients c
      LEFT JOIN tasks t ON t.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { name, contact_name, contact_email, contact_phone, industry, notes, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { rows } = await sql`
      INSERT INTO clients (name, contact_name, contact_email, contact_phone, industry, notes, status, created_by)
      VALUES (${name}, ${contact_name||null}, ${contact_email||null}, ${contact_phone||null}, ${industry||null}, ${notes||null}, ${status}, ${userId})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  if (req.method === 'PATCH') {
    const { id, name, contact_name, contact_email, contact_phone, industry, notes, status } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const { rows } = await sql`
      UPDATE clients SET
        name          = ${name},
        contact_name  = ${contact_name||null},
        contact_email = ${contact_email||null},
        contact_phone = ${contact_phone||null},
        industry      = ${industry||null},
        notes         = ${notes||null},
        status        = ${status||'active'},
        updated_at    = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return res.json(rows[0]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await sql`DELETE FROM clients WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
}
