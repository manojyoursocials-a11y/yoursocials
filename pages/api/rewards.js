import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET')    return res.json(await db.getRewards());
  if (req.method === 'POST')   {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const {name,emoji,description,coin_cost,reward_type} = req.body;
    if (!name||!emoji) return res.status(400).json({error:'Name and emoji required'});
    return res.status(201).json(await db.createReward({id:uuid(),name,emoji,description,coin_cost,reward_type}));
  }
  if (req.method === 'PATCH')  {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const {id,...rest} = req.body;
    await db.updateReward(id, rest);
    return res.json({ok:true});
  }
  if (req.method === 'DELETE') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await db.deleteReward(req.query.id);
    return res.json({ok:true});
  }
  res.status(405).end();
}
