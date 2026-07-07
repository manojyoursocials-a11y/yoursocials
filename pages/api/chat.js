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

  // GET /api/chat               → list rooms for current user
  // GET /api/chat?room=ID       → get messages for a room
  // GET /api/chat?room=ID&since → new messages since timestamp
  // GET /api/chat?members=ID    → get room members
  if (req.method === 'GET') {
    if (req.query.members) {
      const members = await db.getRoomMembers(req.query.members);
      return res.json(members);
    }
    if (req.query.room) {
      const inRoom = await db.isMember(req.query.room, userId);
      if (!inRoom) return res.status(403).json({ error: 'Not a member' });
      if (req.query.since) {
        const msgs = await db.getNewMessages(req.query.room, req.query.since);
        return res.json(msgs);
      }
      const msgs = await db.getMessages(req.query.room);
      return res.json(msgs);
    }
    return res.json(await db.getRooms(userId));
  }

  // POST /api/chat — create room or send message
  if (req.method === 'POST') {
    const { type, name, memberIds, room_id, content, media_url, media_type } = req.body;

    // Create room
    if (type === 'create_room') {
      if (!name || !memberIds?.length) return res.status(400).json({ error: 'Name and members required' });
      const allMembers = [...new Set([userId, ...memberIds])]; // always include creator
      const room = await db.createRoom({ id: uuid(), name, type: 'group', created_by: userId, memberIds: allMembers });
      return res.status(201).json(room);
    }

    // Send message
    if (room_id) {
      const inRoom = await db.isMember(room_id, userId);
      if (!inRoom) return res.status(403).json({ error: 'Not a member' });
      if (!content && !media_url) return res.status(400).json({ error: 'Message or media required' });
      const msg = await db.sendMessage({ id: uuid(), room_id, user_id: userId, content: content || null, media_url: media_url || null, media_type: media_type || null });
      return res.status(201).json(msg);
    }

    return res.status(400).json({ error: 'Invalid request' });
  }

  // PATCH — add/remove members, rename room
  if (req.method === 'PATCH') {
    const { room_id, add_user, remove_user, name } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id required' });
    if (add_user)    await db.addRoomMember(room_id, add_user);
    if (remove_user) await db.removeRoomMember(room_id, remove_user);
    return res.json({ ok: true });
  }

  // DELETE — delete room (admin) or message (sender)
  if (req.method === 'DELETE') {
    if (req.query.room && isAdmin)   { await db.deleteRoom(req.query.room); return res.json({ ok: true }); }
    if (req.query.msg)               { await db.deleteMessage(req.query.msg); return res.json({ ok: true }); }
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.status(405).end();
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
