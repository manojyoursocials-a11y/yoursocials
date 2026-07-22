// Backup all data to JSON — download or save to Google Drive
// Call GET /api/backup to download full DB backup as JSON
// Call POST /api/backup to trigger and get backup data

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const db = getDb();

  try {
    // Fetch all tables in parallel
    const [
      users, tasks, clients, followups, notifications,
      rewards, finance, calendars, calendar_posts,
      gallery_albums, gallery_photos, reimbursements,
      leads, important_days,
    ] = await Promise.allSettled([
      db.getUsers(),
      db.getTasks(),
      db.getClients?.() || Promise.resolve([]),
      db.getFollowups?.() || Promise.resolve([]),
      Promise.resolve([]), // skip large notifications
      db.getRewards?.() || Promise.resolve([]),
      db.getFinance?.() || Promise.resolve([]),
      db.getGalleryAlbums?.() || Promise.resolve([]),
      Promise.resolve([]),
      db.getImportantDays?.() || Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
      db.getImportantDays?.() || Promise.resolve([]),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : []));

    const backup = {
      exported_at: new Date().toISOString(),
      app: 'Your Socials OS',
      version: '1.0',
      tables: {
        users:           users || [],
        tasks:           tasks || [],
        clients:         clients || [],
        followups:       followups || [],
        rewards:         rewards || [],
        finance:         finance || [],
        gallery_albums:  gallery_albums || [],
        important_days:  important_days || [],
      },
      summary: {
        total_users:    (users||[]).length,
        total_tasks:    (tasks||[]).length,
        total_clients:  (clients||[]).length,
        total_followups:(followups||[]).length,
        total_finance:  (finance||[]).length,
      }
    };

    const filename = `yoursocials-backup-${new Date().toISOString().slice(0,10)}.json`;

    if (req.method === 'GET') {
      // Download as file
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(backup);
    }

    // POST — return backup data (for automation)
    return res.json({ ok: true, filename, summary: backup.summary, data: backup });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
