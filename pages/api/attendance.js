import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const isAdmin = session.user.role === 'admin';
  const userId  = session.user.id;

  if (req.method === 'GET') {
    try {
      const { month, year, uid } = req.query;
      const data = await db.getAttendance({
        month: month ? parseInt(month) : null,
        year:  year  ? parseInt(year)  : null,
        userId: uid || null,
      });
      return res.json(data);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    try {
      const { user_id, date, status, note } = req.body;
      if (!user_id || !date || !status) return res.status(400).json({ error: 'user_id, date, status required' });
      const record = await db.markAttendance({
        id: uuid(), user_id, date, status, note, marked_by: userId,
      });
      return res.status(201).json(record);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    try {
      await db.deleteAttendance(req.query.id);
      return res.json({ ok: true });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  res.status(405).end();
}
