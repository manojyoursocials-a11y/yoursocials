import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET') {
    return res.json(await db.getImportantDays());
  }
  if (req.method === 'POST') {
    const { title, date, color, emoji, recurring } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'title and date required' });
    const day = await db.addImportantDay({ id: uuid(), title, date, color, emoji, recurring, created_by: session.user.id });
    return res.status(201).json(day);
  }
  if (req.method === 'DELETE') {
    await db.deleteImportantDay(req.query.id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
