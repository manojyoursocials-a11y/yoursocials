import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const db = getDb();

  if (req.method === 'GET')    return res.json(await db.getTodayNotes(userId));
  if (req.method === 'POST')   {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    return res.status(201).json(await db.createTodayNote({ id: uuid(), userId, content: content.trim() }));
  }
  if (req.method === 'PATCH')  {
    const { id, content, done } = req.body;
    await db.updateTodayNote(id, { content, done });
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    if (req.query.clearDone === '1') { await db.clearDoneTodayNotes(userId); return res.json({ ok: true }); }
    await db.deleteTodayNote(req.query.id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
