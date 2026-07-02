import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = session.user.id;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT t.*,
             u.name  AS owner_name,
             u.image AS owner_image,
             u.email AS owner_email,
             c.name  AS client_name
      FROM tasks t
      LEFT JOIN users   u ON t.owner_id  = u.id
      LEFT JOIN clients c ON t.client_id = c.id
      ORDER BY t.created_at DESC
    `;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { title, description, priority = 'P3', owner_id, client_id, deadline, estimated_hours, ai_checklist = '[]' } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const { rows } = await sql`
      INSERT INTO tasks (title, description, priority, owner_id, client_id, deadline, estimated_hours, ai_checklist, created_by)
      VALUES (${title}, ${description}, ${priority}, ${owner_id || userId}, ${client_id || null}, ${deadline || null}, ${estimated_hours || null}, ${JSON.stringify(ai_checklist)}, ${userId})
      RETURNING *
    `;
    // Award coins for creating a task
    await sql`UPDATE users SET coins = coins + 50 WHERE id = ${userId}`;
    return res.status(201).json(rows[0]);
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });

    const allowed = ['title','description','status','priority','owner_id','client_id','deadline','estimated_hours','actual_hours','quality_rating','ai_checklist'];
    const fields  = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'No valid fields' });

    // Build dynamic update
    let query = 'UPDATE tasks SET updated_at = NOW()';
    const vals = [];
    fields.forEach((f, i) => {
      const v = f === 'ai_checklist' ? JSON.stringify(updates[f]) : updates[f];
      query += `, ${f} = $${i + 1}`;
      vals.push(v);
    });
    // Handle done status
    if (updates.status === 'done') { query += `, completed_at = NOW()`; }
    query += ` WHERE id = $${vals.length + 1} RETURNING *`;
    vals.push(id);

    const { rows } = await sql.query(query, vals);

    // Award 100 coins when marking done
    if (updates.status === 'done') {
      await sql`UPDATE users SET coins = coins + 100 WHERE id = ${userId}`;
    }
    return res.json(rows[0]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
}
