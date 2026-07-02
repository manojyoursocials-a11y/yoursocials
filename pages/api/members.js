// pages/api/members.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT u.*,
             COUNT(t.id)::int                                        AS total_tasks,
             COUNT(t.id) FILTER (WHERE t.status = 'done')::int       AS done_tasks,
             COUNT(t.id) FILTER (WHERE t.status != 'done'
               AND t.deadline < NOW())::int                           AS overdue_tasks,
             ROUND(AVG(t.quality_rating) FILTER (WHERE t.quality_rating IS NOT NULL), 1) AS avg_quality
      FROM users u
      LEFT JOIN tasks t ON t.owner_id = u.id
      GROUP BY u.id
      ORDER BY u.coins DESC
    `;
    return res.json(rows);
  }

  if (req.method === 'PATCH') {
    const { job_title, role } = req.body;
    const userId = session.user.id;
    const { rows } = await sql`
      UPDATE users SET job_title = ${job_title||null}, role = ${role||'member'}
      WHERE id = ${userId} RETURNING *
    `;
    return res.json(rows[0]);
  }

  res.status(405).end();
}
