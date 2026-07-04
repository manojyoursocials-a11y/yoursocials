import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  // GET — list all users with stats (including coins)
  if (req.method === 'GET') {
    return res.json(await db.getMembers());
  }

  // POST — create user (admin only)
  if (req.method === 'POST') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name, email, password, role = 'member', job_title = '' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    if (await db.getUserByEmail(email)) return res.status(400).json({ error: 'Email already exists' });
    const hashed = await bcrypt.hash(password, 10);
    return res.status(201).json(await db.createUser({ id: uuid(), name, email, password: hashed, role, job_title }));
  }

  // PATCH — update user or reset coins
  if (req.method === 'PATCH') {
    const { id, name, job_title, role, password, action } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });

    // ── COIN RESET (admin only) ──────────────────────────────
    if (action === 'resetCoins') {
      if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      if (id === 'all') {
        // Reset ALL users coins to 0
        const users = await db.getUsers();
        for (const u of users) {
          await db.updateUser(u.id, { coins: 0 });
        }
        return res.json({ ok: true, reset: 'all', count: users.length });
      }
      // Reset single user
      await db.updateUser(id, { coins: 0 });
      return res.json({ ok: true, reset: id });
    }

    // ── NORMAL UPDATE ────────────────────────────────────────
    const isSelf  = session.user.id === id;
    const isAdmin = session.user.role === 'admin';
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const updates = {};
    if (name !== undefined)       updates.name      = name;
    if (job_title !== undefined)  updates.job_title = job_title;
    if (isAdmin && role)          updates.role      = role;
    if (password && password.length >= 6) updates.password = await bcrypt.hash(password, 10);
    await db.updateUser(id, updates);
    return res.json({ ok: true });
  }

  // DELETE — remove user (admin only)
  if (req.method === 'DELETE') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { id } = req.query;
    if (id === session.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await db.deleteUser(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
