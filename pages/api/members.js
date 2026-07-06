import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET') return res.json(await db.getMembers());

  if (req.method === 'PATCH') {
    const { job_title, role, image } = req.body;
    const updates = {};

    // Job title — anyone can update their own
    if (job_title !== undefined) updates.job_title = job_title || '';

    // Image — anyone can update their own profile picture
    if (image !== undefined) updates.image = image || null;

    // Role — ONLY admin can change roles, and NEVER to admin via self-edit
    if (role !== undefined) {
      if (session.user.role !== 'admin') {
        // Non-admins cannot change their role at all
        return res.status(403).json({ error: 'Only admins can change roles' });
      }
      updates.role = role;
    }

    await db.updateUser(session.user.id, updates);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
