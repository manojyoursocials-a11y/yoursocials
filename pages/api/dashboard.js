import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

// Simple in-memory cache — one cached result per user
const cache = {};
const CACHE_TTL = 30000; // 30 seconds

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId = session.user.id;
  const now    = Date.now();

  // Return cached result if fresh
  if (cache[userId] && now - cache[userId].ts < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[userId].data);
  }

  try {
    const data = await getDb().getDashboard();
    cache[userId] = { ts: now, data };
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch(e) {
    console.error('Dashboard error:', e.message);
    // Return stale cache on error rather than failing
    if (cache[userId]) return res.json(cache[userId].data);
    return res.status(500).json({ error: e.message });
  }
}
