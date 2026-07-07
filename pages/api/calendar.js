import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId  = session.user.id;
  const isAdmin = session.user.role === 'admin';
  const db = getDb();

  if (req.method === 'GET') {
    // Get posts for a date range (calendar view)
    if (req.query.from && req.query.to) {
      return res.json(await db.getPostsByDateRange(req.query.from, req.query.to));
    }
    // Get posts for a specific calendar
    if (req.query.posts) {
      return res.json(await db.getPosts(req.query.posts));
    }
    // Get all calendars
    return res.json(await db.getCalendars(userId));
  }

  if (req.method === 'POST') {
    const { type } = req.body;

    if (type === 'calendar') {
      if (!req.body.name) return res.status(400).json({ error: 'Name required' });
      const cal = await db.createCalendar({ ...req.body, id: uuid(), created_by: userId });
      return res.status(201).json(cal);
    }

    if (type === 'post') {
      if (!req.body.title) return res.status(400).json({ error: 'Title required' });
      if (!req.body.calendar_id) return res.status(400).json({ error: 'Calendar required' });
      const post = await db.createPost({ ...req.body, id: uuid(), created_by: userId });
      return res.status(201).json(post);
    }

    return res.status(400).json({ error: 'type must be calendar or post' });
  }

  if (req.method === 'PATCH') {
    const { id, type, ...rest } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    if (type === 'calendar') await db.updateCalendar(id, rest);
    else await db.updatePost(id, rest);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id, type } = req.query;
    if (type === 'calendar') await db.deleteCalendar(id);
    else await db.deletePost(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
