import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  if (req.method === 'GET')    return res.json(await db.getClients());
  if (req.method === 'POST')   { if (!req.body.name) return res.status(400).json({ error: 'Name required' }); return res.status(201).json(await db.createClient({...req.body, id: uuid(), created_by: session.user.id})); }
  if (req.method === 'PATCH')  { const {id,...rest}=req.body; await db.updateClient(id,rest); return res.json({ok:true}); }
  if (req.method === 'DELETE') { await db.deleteClient(req.query.id); return res.json({ok:true}); }
  res.status(405).end();
}
