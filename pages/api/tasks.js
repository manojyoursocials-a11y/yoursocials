import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

// Send one notification to one user (silently ignore errors)
async function notify(db, { userId, type, title, body, taskId }) {
  try {
    await db.createNotification({ id: uuid(), user_id: userId, type, title, body, task_id: taskId || null });
  } catch(e) { console.error('notify error:', e.message); }
}

// Notify a set of user IDs (skip the actor)
async function notifyUsers(db, userIds, payload, actorId) {
  const unique = [...new Set(userIds)].filter(id => id && id !== actorId);
  for (const uid of unique) await notify(db, { ...payload, userId: uid });
}

// Notify ALL members in the system (for global events like create/delete)
async function notifyAll(db, payload, actorId) {
  try {
    // Check global admin setting for this notification type
    const settings = await db.getSetting('notif_settings');
    if (settings && settings[payload.type] === false) return; // disabled globally
    const users = await db.getUsers();
    await notifyUsers(db, users.map(u => u.id), payload, actorId);
  } catch(e) { console.error('notifyAll error:', e.message); }
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const userId   = session.user.id;
  const userName = session.user.name || session.user.email || 'Someone';
  const jobTitle = (session.user.job_title || '').toLowerCase();
  const isAdmin  = session.user.role === 'admin';
  const db = getDb();

  // ── GET ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (req.query.member)    return res.json(await db.getTasksByMember(req.query.member));
    if (req.query.client)    return res.json(await db.getTasksByClient(req.query.client));
    if (req.query.today === '1') return res.json(await db.getTodayTasks());
    return res.json(await db.getTasks());
  }

  // ── POST — Create task ─────────────────────────────────────
  if (req.method === 'POST') {
    const { title, description, links, priority, owner_id, client_id, deadline, post_date, content_type, estimated_hours, ai_checklist } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const assigneeId = owner_id || userId;
    const task = await db.createTask({
      id: uuid(), title,
      description:    description || '',
      links:          typeof links === 'string' ? links : JSON.stringify(links || []),
      media:          typeof req.body.media === 'string' ? req.body.media : JSON.stringify(req.body.media || []),
      priority:       priority || 'P3',
      content_type:   content_type || null,
      owner_id:       assigneeId,
      client_id:      client_id || null,
      deadline:       deadline || null,
      post_date:      post_date || null,
      estimated_hours: estimated_hours || null,
      ai_checklist:   typeof ai_checklist === 'string' ? ai_checklist : JSON.stringify(ai_checklist || []),
      created_by:     userId,
    });
    await db.addCoins(userId, 10);

    // Notify EVERYONE: new task created
    await notifyAll(db, {
      type:  'task_created',
      title: '📋 New task created',
      body:  `${userName} created "${title}"`,
      taskId: task.id,
    }, userId);

    // Extra: notify assignee specifically if not the creator
    if (assigneeId !== userId) {
      await notify(db, {
        userId: assigneeId,
        type:   'task_assigned',
        title:  '👤 Task assigned to you',
        body:   `${userName} assigned "${title}" to you`,
        taskId: task.id,
      });
    }

    return res.status(201).json(task);
  }

  // ── PATCH — Move / Edit / Bulk Delete ─────────────────────
  if (req.method === 'PATCH') {
    const body = req.body;

    // Bulk delete done tasks
    if (body.bulkDelete === true && Array.isArray(body.ids) && body.ids.length > 0) {
      await db.deleteTasks(body.ids);
      await notifyAll(db, {
        type:  'task_deleted',
        title: '🗑 Done tasks cleared',
        body:  `${userName} cleared ${body.ids.length} done task${body.ids.length > 1 ? 's' : ''}`,
        taskId: null,
      }, userId);
      return res.json({ ok: true, deleted: body.ids.length });
    }

    const id = body.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    // ── STATUS MOVE ──────────────────────────────────────────
    if (body.status !== undefined && body.title === undefined) {
      const task = await db.getTaskById(id);
      const { reviewAwarded, doneAwarded } = await db.moveTask(id, body.status);

      // Coins
      if (body.status === 'done' && doneAwarded) await db.addCoins(userId, 30);
      if (body.status === 'review' && reviewAwarded) {
        if (jobTitle.includes('graphic') || jobTitle.includes('designer')) await db.addCoins(userId, 30);
      }

      const labels = { todo:'To Do', inprogress:'In Progress', review:'Under Review', done:'Done ✅' };
      const emojis = { todo:'📋', inprogress:'⚡', review:'👁️', done:'✅' };
      const label  = labels[body.status] || body.status;
      const emoji  = emojis[body.status] || '📋';
      const tTitle = task?.title || 'A task';

      // Notify EVERYONE about status change
      await notifyAll(db, {
        type:  'task_moved',
        title: `${emoji} Task moved to ${label}`,
        body:  `${userName} moved "${tTitle}" → ${label}`,
        taskId: id,
      }, userId);

      return res.json({ ok: true });
    }

    // ── EDIT ─────────────────────────────────────────────────
    if (body.title !== undefined) {
      // Permission check
      if (!isAdmin) {
        const task = await db.getTaskById(id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.created_by !== userId && task.owner_id !== userId) {
          return res.status(403).json({ error: 'Only the assigner or assignee can edit this task' });
        }
      }

      const oldTask = await db.getTaskById(id);
      const editData = { ...body };
      if (typeof editData.links !== 'string') editData.links = JSON.stringify(editData.links || []);
      await db.editTask(id, editData);

      // Notify EVERYONE: task edited
      await notifyAll(db, {
        type:  'task_edited',
        title: '✏️ Task updated',
        body:  `${userName} updated "${body.title}"`,
        taskId: id,
      }, userId);

      // Extra: notify new assignee if changed
      if (body.owner_id && body.owner_id !== oldTask?.owner_id && body.owner_id !== userId) {
        await notify(db, {
          userId: body.owner_id,
          type:   'task_assigned',
          title:  '👤 Task assigned to you',
          body:   `${userName} assigned "${body.title}" to you`,
          taskId: id,
        });
      }

      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Provide status or title' });
  }

  // ── DELETE — Single task ───────────────────────────────────
  if (req.method === 'DELETE') {
    const task = await db.getTaskById(req.query.id);
    await db.deleteTask(req.query.id);

    // Notify EVERYONE: task deleted
    await notifyAll(db, {
      type:  'task_deleted',
      title: '🗑 Task deleted',
      body:  `${userName} deleted "${task?.title || 'a task'}"`,
      taskId: null,
    }, userId);

    return res.json({ ok: true });
  }

  res.status(405).end();
}

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };
