import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { v4 as uuid } from 'uuid';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db      = getDb();
  const isAdmin = session.user.role === 'admin';
  const userId  = session.user.id;

  if (req.method === 'GET') {
    try {
      if (req.query.pending === '1') {
        if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
        return res.json(await db.getPendingPhotos());
      }
      if (req.query.album) {
        return res.json(await db.getGalleryPhotos({ albumId: req.query.album }));
      }
      const [albums, photos] = await Promise.all([
        db.getGalleryAlbums(),
        db.getGalleryPhotos(),
      ]);
      return res.json({ albums, photos });
    } catch(e) {
      console.error('Gallery GET error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      if (req.body.action === 'create_album') {
        if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
        const album = await db.createGalleryAlbum({
          id: uuid(), name: req.body.name,
          description: req.body.description, created_by: userId,
        });
        return res.status(201).json(album);
      }
      const { url, type, caption, album_id } = req.body;
      if (!url) return res.status(400).json({ error: 'url required' });
      const photo = await db.addGalleryPhoto({
        id: uuid(), album_id: album_id || null,
        url, type: type || 'image',
        caption: caption || '', uploaded_by: userId,
      });
      return res.status(201).json(photo);
    } catch(e) {
      console.error('Gallery POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    try {
      const { id, action, album_id } = req.body;
      if (action === 'approve') {
        const photo = await db.approvePhoto(id, userId);
        if (photo?.album_id) await db.updateAlbumCover(photo.album_id);
        return res.json({ ok: true, photo });
      }
      if (action === 'reject')       { await db.rejectPhoto(id);               return res.json({ ok: true }); }
      if (action === 'delete_album') { await db.deleteGalleryAlbum(album_id);  return res.json({ ok: true }); }
      return res.status(400).json({ error: 'unknown action' });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    await db.deletePhoto(req.query.id).catch(() => {});
    return res.json({ ok: true });
  }

  res.status(405).end();
}

// 10MB limit — images are compressed client-side before upload
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
