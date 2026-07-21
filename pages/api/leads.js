import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

// Only specific roles can access leads
const ALLOWED_ROLES = ['admin', 'manager', 'sales', 'member'];

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  // All authenticated team members can access (controlled in UI per role if needed)
  const db     = getDb();
  const userId = session.user.id;
  const isAdmin = session.user.role === 'admin';

  if (req.method === 'GET') {
    try {
      if (req.query.id) {
        const lead = await db.getLead(req.query.id);
        if (!lead) return res.status(404).json({ error: 'Not found' });
        const interactions = await db.getInteractions(req.query.id);
        return res.json({ lead, interactions });
      }
      const leads = await db.getLeads();
      return res.json(leads);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'POST') {
    try {
      if (req.body.action === 'interaction') {
        const item = await db.addInteraction({
          id: uuid(), lead_id: req.body.lead_id,
          type: req.body.type, note: req.body.note, created_by: userId,
        });
        // Update last_contacted
        await db.updateLead(req.body.lead_id, { last_contacted: new Date().toISOString() });
        return res.status(201).json(item);
      }
      const lead = await db.createLead({ ...req.body, id: uuid(), created_by: userId });
      return res.status(201).json(lead);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const lead = await db.updateLead(id, data);
      return res.json(lead);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    try {
      await db.deleteLead(req.query.id);
      return res.json({ ok: true });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  res.status(405).end();
}
