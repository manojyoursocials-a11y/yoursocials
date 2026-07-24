// Lazy-load large base64 files only when user clicks to view
// Prevents huge base64 strings being sent on every list load
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

const sql = require('../../lib/db').getDb;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=300'); // 5min cache for files
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { type, id } = req.query;
  const db = getDb();

  if (type === 'receipt') {
    const r = await db.sql`SELECT receipt_url FROM reimbursements WHERE id=${id}`.catch(()=>[]);
    return res.json({ url: r[0]?.receipt_url || null });
  }
  if (type === 'photo') {
    const r = await db.sql`SELECT url FROM gallery_photos WHERE id=${id}`.catch(()=>[]);
    return res.json({ url: r[0]?.url || null });
  }
  if (type === 'task-media') {
    const r = await db.sql`SELECT media_urls FROM tasks WHERE id=${id}`.catch(()=>[]);
    return res.json({ urls: r[0]?.media_urls || [] });
  }

  return res.status(400).json({ error: 'unknown type' });
}
