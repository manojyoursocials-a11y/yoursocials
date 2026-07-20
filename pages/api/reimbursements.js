import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db      = getDb();
  const isAdmin = session.user.role === 'admin';
  const userId  = session.user.id;

  if (req.method === 'GET') {
    try {
      const data = await db.getReimbursements(userId, isAdmin);
      return res.json(data);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'POST') {
    try {
      const { title, category, amount, description, receipt_url } = req.body;
      if (!title || !category || !amount) return res.status(400).json({ error: 'title, category and amount required' });
      const item = await db.createReimbursement({
        id: uuid(), title, category,
        amount: parseFloat(amount),
        description, receipt_url, submitted_by: userId,
      });
      return res.status(201).json(item);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    try {
      const { id, status, admin_note } = req.body;
      if (!id || !status) return res.status(400).json({ error: 'id and status required' });
      const item = await db.updateReimbursementStatus(id, status, admin_note, userId);
      return res.json(item);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    try {
      await db.deleteReimbursement(req.query.id);
      return res.json({ ok: true });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  res.status(405).end();
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
