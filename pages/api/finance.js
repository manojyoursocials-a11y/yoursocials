import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = session.user.role === 'admin';
  const db = getDb();

  if (req.method === 'GET') {
    const { summary, monthly, from, to } = req.query;
    if (summary === '1') return res.json(await db.getFinanceSummary());
    if (monthly === '1') return res.json(await db.getMonthlyFinance());
    return res.json(await db.getFinance({ from, to }));
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { name, amount } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });
    const entry = await db.createFinance({ ...req.body, id: uuid(), created_by: session.user.id });
    return res.status(201).json(entry);
  }

  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { id, ...rest } = req.body;
    await db.updateFinance(id, rest);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    await db.deleteFinance(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
