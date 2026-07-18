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

  // GET — albums, photos, pending
  if (req.method === 'GET') {
    if (req.query.pending === '1') {
      if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
      return res.json(await db.getPendingPhotos());
    }
    if (req.query.album) {
      return res.json(await db.getGalleryPhotos({ albumId: req.query.album }));
    }
    if (req.query.all === '1') {
      return res.json(await db.getGalleryPhotos({ all: true }));
    }
    return res.json({
      albums: await db.getGalleryAlbums(),
      photos: await db.getGalleryPhotos(), // approved, no album filter
    });
  }

  // POST — upload photo or create album
  if (req.method === 'POST') {
    if (req.body.action === 'create_album') {
      if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
      const album = await db.createGalleryAlbum({
        id:          uuid(),
        name:        req.body.name,
        description: req.body.description,
        created_by:  userId,
      });
      return res.status(201).json(album);
    }

    // Upload photo
    const { url, type, caption, album_id } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    const photo = await db.addGalleryPhoto({
      id:         uuid(),
      album_id:   album_id || null,
      url,
      type:       type || 'image',
      caption:    caption || '',
      uploaded_by: userId,
    });
    return res.status(201).json(photo);
  }

  // PATCH — approve
  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { id, action, album_id } = req.body;
    if (action === 'approve') {
      const photo = await db.approvePhoto(id, userId);
      if (photo?.album_id) await db.updateAlbumCover(photo.album_id);
      return res.json({ ok: true, photo });
    }
    if (action === 'reject') {
      await db.rejectPhoto(id);
      return res.json({ ok: true });
    }
    if (action === 'delete_album') {
      await db.deleteGalleryAlbum(album_id);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown action' });
  }

  // DELETE — photo
  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    await db.deletePhoto(req.query.id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };
