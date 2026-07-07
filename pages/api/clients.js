import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

async function notifyAll(db, payload, actorId) {
  try {
    const users = await db.getUsers();
    for (const u of users) {
      if (u.id === actorId) continue;
      await db.createNotification({ id: uuid(), user_id: u.id, ...payload, task_id: null });
    }
  } catch(e) {}
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const actor = session.user.name || session.user.email || 'Someone';
  if (req.method === 'GET')    return res.json(await db.getClients());
  if (req.method === 'POST') {
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });
    const client = await db.createClient({...req.body, id: uuid(), created_by: session.user.id});
    await notifyAll(db, { id:uuid(), type:'client_created', title:'🏢 New client added', body:`${actor} added client "${req.body.name}"` }, session.user.id);
    return res.status(201).json(client);
  }
  if (req.method === 'PATCH')  {
    const {id,...rest}=req.body;
    await db.updateClient(id,rest);
    await notifyAll(db, { id:uuid(), type:'client_updated', title:'🏢 Client updated', body:`${actor} updated client "${rest.name||''}"` }, session.user.id);
    return res.json({ok:true});
  }
  if (req.method === 'DELETE') {
    await db.deleteClient(req.query.id);
    await notifyAll(db, { id:uuid(), type:'client_deleted', title:'🏢 Client removed', body:`${actor} removed a client` }, session.user.id);
    return res.json({ok:true});
  }
  res.status(405).end();
}
