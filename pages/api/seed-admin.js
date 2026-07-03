import { getDb } from '../../lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const db = getDb();
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  const users = await db.getUsers();
  const adminExists = users.some(u => u.role === 'admin');
  if (adminExists) return res.status(400).json({ error: 'Admin already exists. Use Manage Users in the app.' });
  const existing = await db.getUserByEmail(email);
  if (existing) return res.status(400).json({ error: 'Email already in use' });
  const hashed = await bcrypt.hash(password, 10);
  const user = await db.createUser({ id: uuid(), name, email, password: hashed, role: 'admin', job_title: 'Admin' });
  return res.status(201).json({ message: 'Admin created! You can now log in.', user });
}
