// Full database backup — exports ALL tables including media
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const db = getDb();
  const { sql } = db;

  try {
    // Fetch ALL tables in parallel with full data including media/base64
    const results = await Promise.allSettled([
      sql`SELECT * FROM users ORDER BY created_at`,
      sql`SELECT * FROM tasks ORDER BY created_at`,
      sql`SELECT * FROM clients ORDER BY created_at`,
      sql`SELECT * FROM followups ORDER BY created_at`,
      sql`SELECT * FROM notifications ORDER BY created_at LIMIT 500`,
      sql`SELECT * FROM rewards ORDER BY created_at`,
      sql`SELECT * FROM finance ORDER BY created_at`,
      sql`SELECT * FROM calendars ORDER BY created_at`,
      sql`SELECT * FROM calendar_posts ORDER BY created_at`,
      sql`SELECT * FROM gallery_albums ORDER BY created_at`,
      sql`SELECT * FROM gallery_photos ORDER BY created_at`,
      sql`SELECT * FROM reimbursements ORDER BY created_at`,
      sql`SELECT * FROM leads ORDER BY created_at`,
      sql`SELECT * FROM lead_interactions ORDER BY created_at`,
      sql`SELECT * FROM important_days ORDER BY created_at`,
      sql`SELECT * FROM app_settings`,
    ]);

    const [
      users, tasks, clients, followups, notifications, rewards,
      finance, calendars, calendar_posts, gallery_albums, gallery_photos,
      reimbursements, leads, lead_interactions, important_days, app_settings,
    ] = results.map(r => r.status === 'fulfilled' ? r.value : []);

    const backup = {
      exported_at:  new Date().toISOString(),
      app:          'Your Socials OS',
      version:      '2.0',
      tables: {
        users:            users            || [],
        tasks:            tasks            || [],
        clients:          clients          || [],
        followups:        followups        || [],
        notifications:    notifications    || [],
        rewards:          rewards          || [],
        finance:          finance          || [],
        calendars:        calendars        || [],
        calendar_posts:   calendar_posts   || [],
        gallery_albums:   gallery_albums   || [],
        gallery_photos:   gallery_photos   || [],
        reimbursements:   reimbursements   || [],
        leads:            leads            || [],
        lead_interactions:lead_interactions|| [],
        important_days:   important_days   || [],
        app_settings:     app_settings     || [],
      },
      summary: {
        users:          (users||[]).length,
        tasks:          (tasks||[]).length,
        clients:        (clients||[]).length,
        followups:      (followups||[]).length,
        finance:        (finance||[]).length,
        gallery_photos: (gallery_photos||[]).length,
        leads:          (leads||[]).length,
        calendar_posts: (calendar_posts||[]).length,
      }
    };

    if (req.method === 'GET') {
      const filename = `yoursocials-backup-${new Date().toISOString().slice(0,10)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(backup);
    }

    // POST — return data for GitHub push
    return res.json({ ok: true, backup });

  } catch(e) {
    console.error('Backup error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

export const config = { api: { bodyParser: false, responseLimit: '50mb' } };
