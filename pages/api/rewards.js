import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM rewards ORDER BY coin_cost`;
    return res.json(rows);
  }
  res.status(405).end();
}
