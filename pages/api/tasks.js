import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId  = session.user.id;
  const userRole = session.user.role;
  const jobTitle = (session.user.job_title || '').toLowerCase();
  const isAdmin  = userRole === 'admin';
  const db = getDb();

  if (req.method === 'GET') {
    if (req.query.member) return res.json(await db.getTasksByMember(req.query.member));
    if (req.query.client) return res.json(await db.getTasksByClient(req.query.client));
    if (req.query.today === '1') return res.json(await db.getTodayTasks());
    return res.json(await db.getTasks());
  }

  if (req.method === 'POST') {
    const { title, description, links, priority, owner_id, client_id, deadline, post_date, estimated_hours, ai_checklist } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const task = await db.createTask({
      id: uuid(), title,
      description: description || '',
      links: typeof links === 'string' ? links : JSON.stringify(links || []),
      priority: priority || 'P3',
      owner_id: owner_id || userId,
      client_id: client_id || null,
      deadline: deadline || null,
      post_date: post_date || null,
      estimated_hours: estimated_hours || null,
      ai_checklist: typeof ai_checklist === 'string' ? ai_checklist : JSON.stringify(ai_checklist || []),
      created_by: userId,
    });
    // Task created = 10 coins
    await db.addCoins(userId, 10);
    return res.status(201).json(task);
  }

  if (req.method === 'PATCH') {
    const body = req.body;
    const id   = body.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    // STATUS MOVE
    if (body.status !== undefined && body.title === undefined) {
      await db.moveTask(id, body.status);

      if (body.status === 'done') {
        // Task done = 30 coins (changed from 50)
        await db.addCoins(userId, 30);
      }

      if (body.status === 'review') {
        // Under Review = 30 coins ONLY for Graphic Designer role
        const isDesigner = jobTitle.includes('graphic') || jobTitle.includes('designer');
        if (isDesigner) {
          await db.addCoins(userId, 30);
        }
      }

      return res.json({ ok: true });
    }

    // EDIT — only assigner or assignee (or admin)
    if (body.title !== undefined) {
      if (!isAdmin) {
        const task = await db.getTaskById(id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.created_by !== userId && task.owner_id !== userId) {
          return res.status(403).json({ error: 'Only the assigner or assignee can edit this task' });
        }
      }
      const editData = { ...body };
      if (typeof editData.links !== 'string') editData.links = JSON.stringify(editData.links || []);
      await db.editTask(id, editData);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Provide status or title' });
  }

  if (req.method === 'DELETE') {
    await db.deleteTask(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
