import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const results = {};
  const db = getDb();

  // Test 1: Can we get users?
  try {
    const users = await db.getUsers();
    results.users = { ok: true, count: users.length, names: users.map(u => u.name || u.email) };
  } catch(e) { results.users = { ok: false, error: e.message }; }

  // Test 2: Can we read notifications?
  try {
    const notifs = await db.getNotifications(session.user.id);
    results.read_notifs = { ok: true, count: notifs.length };
  } catch(e) { results.read_notifs = { ok: false, error: e.message }; }

  // Test 3: Can we write a notification?
  try {
    const testId = uuid();
    await db.createNotification({
      id:      testId,
      user_id: session.user.id,
      type:    'task_created',
      title:   '🧪 Debug test',
      body:    'This is a test notification written directly to DB',
      task_id: null,
    });
    results.write_notif = { ok: true, id: testId };
  } catch(e) { results.write_notif = { ok: false, error: e.message }; }

  // Test 4: Can we get unread count?
  try {
    const count = await db.getUnreadCount(session.user.id);
    results.unread_count = { ok: true, count };
  } catch(e) { results.unread_count = { ok: false, error: e.message }; }

  // Test 5: Write notification to ALL users
  if (req.method === 'POST') {
    try {
      const users = await db.getUsers();
      let written = 0;
      for (const u of users) {
        await db.createNotification({
          id:      uuid(),
          user_id: u.id,
          type:    'task_assigned',
          title:   '🔔 Test from ' + (session.user.name || 'Admin'),
          body:    'If you see this popup + sound, notifications are working!',
          task_id: null,
        });
        written++;
      }
      results.notif_all = { ok: true, sent_to: written };
    } catch(e) { results.notif_all = { ok: false, error: e.message }; }
  }

  return res.json({ userId: session.user.id, name: session.user.name, results });
}
