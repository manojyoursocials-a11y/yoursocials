import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();

  if (req.method === 'GET') {
    return res.json(await db.getMembers());
  }

  if (req.method === 'POST') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name, email, password, role = 'member', job_title = '', phone = '', image = '' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    if (await db.getUserByEmail(email)) return res.status(400).json({ error: 'Email already exists' });
    if (phone && await db.getUserByPhone(phone)) return res.status(400).json({ error: 'Phone number already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await db.createUser({ id: uuid(), name, email, password: hashed, phone: phone||null, image: image||null, role, job_title });
    return res.status(201).json(user);
  }

  if (req.method === 'PATCH') {
    const { id, name, job_title, role, password, phone, image, action } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });

    // Coin reset (admin only)
    if (action === 'resetCoins') {
      if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      if (id === 'all') {
        const users = await db.getUsers();
        for (const u of users) await db.updateUser(u.id, { coins: 0 });
        return res.json({ ok: true, reset: 'all', count: users.length });
      }
      await db.updateUser(id, { coins: 0 });
      return res.json({ ok: true, reset: id });
    }

    const isSelf  = session.user.id === id;
    const isAdmin = session.user.role === 'admin';
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const updates = {};
    if (name !== undefined)      updates.name      = name;
    if (job_title !== undefined)  updates.job_title = job_title;
    if (phone !== undefined)      updates.phone     = phone || null;
    if (image !== undefined)      updates.image     = image || null;
    if (isAdmin && role)          updates.role      = role;
    if (password && password.length >= 6) updates.password = await bcrypt.hash(password, 10);
    await db.updateUser(id, updates);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { id } = req.query;
    if (id === session.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await db.deleteUser(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
