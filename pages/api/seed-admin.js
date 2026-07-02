import { getDb } from '../../lib/db';
import bcrypt from 'bcryptjs';

// This endpoint creates the first admin user
// Call it once at: /api/seed-admin?name=YourName&email=you@email.com&password=yourpassword
// It only works if NO admin exists yet
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const db = getDb();
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password required' });
  }

  // Block if admin already exists
  const adminExists = db.getUsers().some(u => u.role === 'admin');
  if (adminExists) {
    return res.status(400).json({ error: 'Admin already exists. Use the app to manage users.' });
  }

  if (db.getUserByEmail(email)) {
    return res.status(400).json({ error: 'Email already in use' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = db.createUser({ name, email, password: hashed, role: 'admin', job_title: 'Admin' });
  const { password: _, ...safe } = user;

  return res.status(201).json({ message: 'Admin created! You can now log in.', user: safe });
}
