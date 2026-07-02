import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT f.*, c.name AS client_name, u.name AS assignee_name
      FROM followups f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN users   u ON f.assigned_to = u.id
      ORDER BY f.due_date ASC NULLS LAST, f.created_at DESC
    `;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { client_id, subject, due_date, assigned_to } = req.body;
    if (!subject) return res.status(400).json({ error: 'Subject required' });
    const { rows } = await sql`
      INSERT INTO followups (client_id, subject, due_date, assigned_to, created_by)
      VALUES (${client_id||null}, ${subject}, ${due_date||null}, ${assigned_to||userId}, ${userId})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  if (req.method === 'PATCH') {
    const { id, status, body } = req.body;
    const sentAt = status === 'done' ? new Date().toISOString() : null;
    const { rows } = await sql`
      UPDATE followups SET
        status     = COALESCE(${status}, status),
        body       = COALESCE(${body||null}, body),
        sent_at    = CASE WHEN ${status} = 'done' THEN NOW() ELSE sent_at END,
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    if (status === 'done') {
      await sql`UPDATE users SET coins = coins + 30 WHERE id = ${userId}`;
    }
    return res.json(rows[0]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await sql`DELETE FROM followups WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
}
