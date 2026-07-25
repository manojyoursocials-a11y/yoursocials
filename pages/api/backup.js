import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const sql = neon(process.env.DATABASE_URL);

  const tables = ['users','tasks','clients','followups','rewards','finance',
    'calendars','calendar_posts','gallery_albums','gallery_photos',
    'reimbursements','leads','lead_interactions','important_days',
    'attendance','app_settings'];

  try {
    const results = await Promise.allSettled(
      tables.map(t => sql(`SELECT * FROM ${t} ORDER BY created_at DESC`).catch(() => []))
    );

    const backup = {
      exported_at: new Date().toISOString(),
      app: 'Your Socials OS',
      version: '2.0',
      tables: Object.fromEntries(
        tables.map((t, i) => [t, results[i].status === 'fulfilled' ? results[i].value : []])
      ),
      summary: Object.fromEntries(
        tables.map((t, i) => [t, (results[i].status === 'fulfilled' ? results[i].value : []).length])
      ),
    };

    const filename = `yoursocials-backup-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.json(backup);

  } catch(e) {
    console.error('Backup error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

export const config = { api: { responseLimit: '50mb' } };
