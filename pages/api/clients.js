import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET')    return res.json(db.getClients());
  if (req.method === 'POST')   { if (!req.body.name) return res.status(400).json({ error: 'Name required' }); return res.status(201).json(db.createClient({ ...req.body, created_by: session.user.id })); }
  if (req.method === 'PATCH')  { const { id, ...rest } = req.body; db.updateClient(id, rest); return res.json({ ok: true }); }
  if (req.method === 'DELETE') { db.deleteClient(req.query.id); return res.json({ ok: true }); }
  res.status(405).end();
}
