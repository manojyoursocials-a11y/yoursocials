import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Textarea, Spinner, toast, Avatar, MEMBER_COLORS } from '../components/UI';

const api = (url, method='GET', body) =>
  fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined }).then(r=>r.json());

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function timeAgo(iso) {
  const m = Math.floor((Date.now()-new Date(iso))/60000);
  if (m < 1) return 'just now'; if (m < 60) return m+'m ago';
  if (m < 1440) return Math.floor(m/60)+'h ago'; return Math.floor(m/1440)+'d ago';
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ items, index, onClose }) {
  const [cur, setCur] = useState(index);
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCur(c => Math.min(c+1, items.length-1));
      if (e.key === 'ArrowLeft')  setCur(c => Math.max(c-1, 0));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, onClose]);

  const item = items[cur];
  if (!item) return null;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.95)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      {/* Close */}
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,.1)', border:'none', borderRadius:'50%', width:40, height:40, color:'#fff', cursor:'pointer', fontSize:'1.2rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>

      {/* Prev */}
      {cur > 0 && (
        <button onClick={e=>{e.stopPropagation();setCur(c=>c-1);}} style={{ position:'absolute', left:20, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.1)', border:'none', borderRadius:'50%', width:48, height:48, color:'#fff', cursor:'pointer', fontSize:'1.4rem', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
      )}

      {/* Media */}
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        {item.type === 'video'
          ? <video src={item.url} controls style={{ maxWidth:'90vw', maxHeight:'80vh', borderRadius:12 }}/>
          : <img src={item.url} alt={item.caption||''} style={{ maxWidth:'90vw', maxHeight:'80vh', borderRadius:12, objectFit:'contain' }}/>
        }
        {(item.caption || item.uploader_name) && (
          <div style={{ textAlign:'center' }}>
            {item.caption && <div style={{ color:'#fff', fontSize:'.9rem', fontWeight:600, marginBottom:4 }}>{item.caption}</div>}
            {item.uploader_name && <div style={{ color:'rgba(255,255,255,.5)', fontSize:'.78rem' }}>📸 {item.uploader_name} · {timeAgo(item.created_at)}</div>}
          </div>
        )}
      </div>

      {/* Next */}
      {cur < items.length-1 && (
        <button onClick={e=>{e.stopPropagation();setCur(c=>c+1);}} style={{ position:'absolute', right:20, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.1)', border:'none', borderRadius:'50%', width:48, height:48, color:'#fff', cursor:'pointer', fontSize:'1.4rem', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
      )}

      {/* Counter */}
      <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', color:'rgba(255,255,255,.5)', fontSize:'.8rem' }}>{cur+1} / {items.length}</div>
    </div>
  );
}

export default function Gallery() {
  const { data:session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';
  const userId  = session?.user?.id;

  const [albums,       setAlbums]       = useState([]);
  const [photos,       setPhotos]       = useState([]);
  const [pending,      setPending]      = useState([]);
  const [activeAlbum,  setActiveAlbum]  = useState(null); // null = all photos
  const [albumPhotos,  setAlbumPhotos]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [lightbox,     setLightbox]     = useState(null); // {items, index}
  const [view,         setView]         = useState('grid'); // grid | albums
  const [showUpload,   setShowUpload]   = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [showPending,  setShowPending]  = useState(false);
  const [albumName,    setAlbumName]    = useState('');
  const [albumDesc,    setAlbumDesc]    = useState('');
  const [uploadFiles,  setUploadFiles]  = useState([]);
  const [uploadCaption,setUploadCaption]= useState('');
  const [uploadAlbum,  setUploadAlbum]  = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await api('/api/gallery');
    setAlbums(Array.isArray(d.albums) ? d.albums : []);
    setPhotos(Array.isArray(d.photos) ? d.photos : []);
    if (isAdmin) {
      const p = await api('/api/gallery?pending=1');
      setPending(Array.isArray(p) ? p : []);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { if (status==='authenticated') load(); }, [status, load]);

  async function loadAlbum(album) {
    setActiveAlbum(album);
    const p = await api('/api/gallery?album=' + album.id);
    setAlbumPhotos(Array.isArray(p) ? p : []);
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    const previews = await Promise.all(files.map(async f => ({
      file: f, preview: await toBase64(f),
      type: f.type.startsWith('video/') ? 'video' : 'image',
      name: f.name, size: f.size,
    })));
    setUploadFiles(prev => [...prev, ...previews]);
    e.target.value = '';
  }

  async function submitUpload() {
    if (!uploadFiles.length) return;
    setUploading(true);
    let ok = 0;
    for (const f of uploadFiles) {
      if (f.size > 20*1024*1024) { toast.error(f.name + ' is too large (max 20MB)'); continue; }
      await api('/api/gallery', 'POST', {
        url:      f.preview,
        type:     f.type,
        caption:  uploadCaption,
        album_id: uploadAlbum || null,
      });
      ok++;
    }
    setUploading(false);
    setShowUpload(false);
    setUploadFiles([]);
    setUploadCaption('');
    setUploadAlbum('');
    if (ok > 0) {
      toast.success(`${ok} photo${ok>1?'s':''} submitted for admin approval ✅`);
      load();
    }
  }

  async function createAlbum() {
    if (!albumName.trim()) return;
    await api('/api/gallery', 'POST', { action:'create_album', name:albumName.trim(), description:albumDesc.trim() });
    setShowNewAlbum(false); setAlbumName(''); setAlbumDesc('');
    toast.success('Album created!');
    load();
  }

  async function approve(id) {
    await api('/api/gallery', 'PATCH', { id, action:'approve' });
    setPending(p => p.filter(x => x.id !== id));
    toast.success('Photo approved and published ✅');
    load();
  }
  async function reject(id) {
    await api('/api/gallery', 'PATCH', { id, action:'reject' });
    setPending(p => p.filter(x => x.id !== id));
    toast.info('Photo rejected and removed');
  }
  async function deletePhoto(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this photo?')) return;
    await api('/api/gallery?id='+id, 'DELETE');
    if (activeAlbum) setAlbumPhotos(p => p.filter(x => x.id !== id));
    else setPhotos(p => p.filter(x => x.id !== id));
    toast.success('Deleted');
  }
  async function deleteAlbum(album, e) {
    e.stopPropagation();
    if (!confirm(`Delete album "${album.name}"? Photos inside will remain.`)) return;
    await api('/api/gallery', 'PATCH', { action:'delete_album', album_id: album.id });
    toast.success('Album deleted');
    load();
  }

  const displayPhotos = activeAlbum ? albumPhotos : photos;
  const ACCENT_COLORS = ['#7C5CFC','#FF5FA0','#00E5A0','#FFD60A','#00D4FF','#FF9F43'];

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
              {activeAlbum && (
                <button onClick={()=>{setActiveAlbum(null);setAlbumPhotos([]);}} style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 12px', color:'var(--muted2)', cursor:'pointer', fontSize:'.8rem', fontFamily:'inherit' }}>← Back</button>
              )}
              <h2 style={{ fontWeight:900, fontSize:'1.2rem', margin:0 }}>
                {activeAlbum ? `📁 ${activeAlbum.name}` : '🖼️ Team Gallery'}
              </h2>
            </div>
            <p style={{ fontSize:'.8rem', color:'var(--muted2)', margin:0 }}>
              {activeAlbum ? (activeAlbum.description || '') : 'Fun moments, celebrations and happy memories from the team'}
            </p>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {/* Pending badge */}
            {isAdmin && pending.length > 0 && (
              <button onClick={()=>setShowPending(true)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 14px', background:'rgba(255,77,109,.12)', border:'1px solid rgba(255,77,109,.3)', borderRadius:10, color:'#FF4D6D', cursor:'pointer', fontSize:'.82rem', fontWeight:700, fontFamily:'inherit' }}>
                🕐 {pending.length} Pending Approval
              </button>
            )}
            {isAdmin && (
              <Btn variant="ghost" onClick={()=>setShowNewAlbum(true)}>📁 New Album</Btn>
            )}
            <Btn onClick={()=>setShowUpload(true)}>📸 Upload</Btn>
          </div>
        </div>

        {/* ── VIEW TABS (only on main view) ── */}
        {!activeAlbum && (
          <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--surface2)', padding:4, borderRadius:10, border:'1px solid var(--border)', width:'fit-content' }}>
            {[['grid','🖼️ All Photos'],['albums','📁 Albums']].map(([v,l]) => (
              <button key={v} onClick={()=>setView(v)}
                style={{ padding:'7px 18px', borderRadius:7, border:'none', background:view===v?'var(--surface)':'transparent', color:view===v?'var(--text)':'var(--muted2)', fontSize:'.82rem', fontWeight:view===v?700:500, cursor:'pointer', fontFamily:'inherit', boxShadow:view===v?'var(--shadow)':'none', transition:'all .15s' }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {loading && <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}><Spinner size={28}/></div>}

        {/* ── ALBUMS VIEW ── */}
        {!loading && !activeAlbum && view === 'albums' && (
          <div>
            {albums.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted2)' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>📁</div>
                <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:8 }}>No albums yet</div>
                {isAdmin && <Btn onClick={()=>setShowNewAlbum(true)}>Create First Album</Btn>}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 }}>
              {albums.map((album, i) => (
                <div key={album.id} onClick={()=>loadAlbum(album)}
                  style={{ borderRadius:16, overflow:'hidden', cursor:'pointer', background:'var(--surface2)', border:'1px solid var(--border)', transition:'transform .15s, box-shadow .15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,.3)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
                  {/* Cover */}
                  <div style={{ height:160, background: album.cover_photo ? 'transparent' : ACCENT_COLORS[i%ACCENT_COLORS.length]+'22', position:'relative', overflow:'hidden' }}>
                    {album.cover_photo || album.latest_photo
                      ? <img src={album.cover_photo||album.latest_photo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'3rem' }}>📁</div>
                    }
                    {isAdmin && (
                      <button onClick={e=>deleteAlbum(album,e)}
                        style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.6)', border:'none', borderRadius:6, width:28, height:28, color:'#FF4D6D', cursor:'pointer', fontSize:'.75rem', display:'flex', alignItems:'center', justifyContent:'center' }}>🗑</button>
                    )}
                    <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,.65)', borderRadius:6, padding:'2px 8px', fontSize:'.72rem', color:'#fff', fontWeight:600 }}>
                      {album.photo_count || 0} photos
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight:700, fontSize:'.92rem', marginBottom:3 }}>{album.name}</div>
                    {album.description && <div style={{ fontSize:'.75rem', color:'var(--muted2)', lineHeight:1.5, marginBottom:3 }}>{album.description}</div>}
                    <div style={{ fontSize:'.68rem', color:'var(--muted)' }}>by {album.creator_name || 'Admin'} · {timeAgo(album.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PHOTO GRID (all photos or album photos) ── */}
        {!loading && (view==='grid' || activeAlbum) && (
          <div>
            {displayPhotos.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted2)' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>🖼️</div>
                <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:8 }}>
                  {activeAlbum ? 'No photos in this album yet' : 'No photos yet'}
                </div>
                <div style={{ fontSize:'.84rem', marginBottom:20, lineHeight:1.6 }}>
                  {activeAlbum ? 'Upload photos and select this album.' : 'Be the first to upload a fun team moment!'}
                </div>
                <Btn onClick={()=>setShowUpload(true)}>📸 Upload First Photo</Btn>
              </div>
            )}
            <div style={{ columns:'repeat(auto-fill,minmax(220px,1fr))', columnGap:10, rowGap:10 }}>
              {displayPhotos.map((photo, i) => (
                <div key={photo.id}
                  onClick={()=>setLightbox({items:displayPhotos, index:i})}
                  style={{ breakInside:'avoid', marginBottom:10, borderRadius:12, overflow:'hidden', cursor:'pointer', position:'relative', background:'var(--surface2)' }}
                  onMouseEnter={e=>e.currentTarget.querySelector('.overlay').style.opacity='1'}
                  onMouseLeave={e=>e.currentTarget.querySelector('.overlay').style.opacity='0'}>
                  {photo.type==='video'
                    ? <video src={photo.url} style={{ width:'100%', display:'block' }}/>
                    : <img src={photo.url} alt={photo.caption||''} style={{ width:'100%', display:'block' }} loading="lazy"/>
                  }
                  {/* Hover overlay */}
                  <div className="overlay" style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 50%)', opacity:0, transition:'opacity .2s', display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'12px 10px' }}>
                    {photo.caption && <div style={{ color:'#fff', fontSize:'.78rem', fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{photo.caption}</div>}
                    <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.68rem' }}>📸 {photo.uploader_name} · {timeAgo(photo.created_at)}</div>
                    {isAdmin && (
                      <button onClick={e=>deletePhoto(photo.id,e)}
                        style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.6)', border:'none', borderRadius:6, width:28, height:28, color:'#FF4D6D', cursor:'pointer', fontSize:'.75rem', display:'flex', alignItems:'center', justifyContent:'center' }}>🗑</button>
                    )}
                  </div>
                  {photo.type==='video' && (
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:44, height:44, borderRadius:'50%', background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', pointerEvents:'none' }}>▶</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── UPLOAD MODAL ── */}
      {showUpload && (
        <Modal open={showUpload} title="📸 Upload Photos / Videos" onClose={()=>{setShowUpload(false);setUploadFiles([]);}}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Drop zone */}
            <div onClick={()=>fileRef.current?.click()}
              style={{ border:'2px dashed var(--border2)', borderRadius:12, padding:'28px 20px', textAlign:'center', cursor:'pointer', transition:'all .15s', background:'var(--surface3)' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';e.currentTarget.style.background='rgba(124,92,252,.06)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--surface3)';}}
              onDrop={async e=>{e.preventDefault();const files=Array.from(e.dataTransfer.files);const previews=await Promise.all(files.map(async f=>({file:f,preview:await toBase64(f),type:f.type.startsWith('video/')?'video':'image',name:f.name,size:f.size})));setUploadFiles(p=>[...p,...previews]);}}
              onDragOver={e=>e.preventDefault()}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>📸</div>
              <div style={{ fontWeight:600, fontSize:'.9rem', marginBottom:4 }}>Click or drag photos/videos here</div>
              <div style={{ fontSize:'.75rem', color:'var(--muted2)' }}>JPG, PNG, GIF, MP4, MOV — max 20MB each</div>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={handleFileSelect}/>
            </div>

            {/* Preview grid */}
            {uploadFiles.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))', gap:8 }}>
                {uploadFiles.map((f,i) => (
                  <div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden', aspectRatio:'1' }}>
                    {f.type==='video'
                      ? <video src={f.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <img src={f.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    }
                    <button onClick={()=>setUploadFiles(p=>p.filter((_,j)=>j!==i))}
                      style={{ position:'absolute', top:3, right:3, background:'rgba(0,0,0,.7)', border:'none', borderRadius:'50%', width:20, height:20, color:'#fff', cursor:'pointer', fontSize:'.65rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Caption */}
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Caption (optional)</div>
              <Input value={uploadCaption} onChange={e=>setUploadCaption(e.target.value)} placeholder="Add a caption for these photos…"/>
            </div>

            {/* Album */}
            {albums.length > 0 && (
              <div>
                <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Add to Album (optional)</div>
                <select value={uploadAlbum} onChange={e=>setUploadAlbum(e.target.value)}
                  style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', color:'var(--text)', fontFamily:'Inter,sans-serif', fontSize:'.85rem', outline:'none' }}>
                  <option value="">No album (show in All Photos)</option>
                  {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ padding:'10px 14px', background:'rgba(255,214,10,.06)', border:'1px solid rgba(255,214,10,.2)', borderRadius:10, fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.6 }}>
              💡 Your photos will be sent to the admin for approval before appearing in the gallery.
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={()=>{setShowUpload(false);setUploadFiles([]);}} style={{ flex:1 }}>Cancel</Btn>
              <Btn onClick={submitUpload} disabled={uploading||!uploadFiles.length} style={{ flex:2 }}>
                {uploading ? '⏳ Uploading…' : `📸 Submit ${uploadFiles.length} Photo${uploadFiles.length!==1?'s':''}`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── NEW ALBUM MODAL ── */}
      {showNewAlbum && (
        <Modal open={showNewAlbum} title="📁 Create New Album" onClose={()=>{setShowNewAlbum(false);setAlbumName('');setAlbumDesc('');}}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Album Name *</div>
              <Input value={albumName} onChange={e=>setAlbumName(e.target.value)} placeholder="e.g. Diwali Celebration 2024"/>
            </div>
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Description (optional)</div>
              <Textarea value={albumDesc} onChange={e=>setAlbumDesc(e.target.value)} placeholder="Tell the story of this album…" rows={3}/>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <Btn variant="ghost" onClick={()=>{setShowNewAlbum(false);setAlbumName('');setAlbumDesc('');}} style={{ flex:1 }}>Cancel</Btn>
              <Btn onClick={createAlbum} disabled={!albumName.trim()} style={{ flex:2 }}>📁 Create Album</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── PENDING APPROVAL MODAL ── */}
      {showPending && (
        <Modal open={showPending} title={`🕐 Pending Approval (${pending.length})`} onClose={()=>setShowPending(false)} width={720}>
          <div style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:'70vh', overflowY:'auto' }}>
            {pending.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted2)' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>✅</div>
                <div>All caught up! No pending photos.</div>
              </div>
            )}
            {pending.map(photo => (
              <div key={photo.id} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                {photo.type==='video'
                  ? <video src={photo.url} style={{ width:100, height:80, objectFit:'cover', borderRadius:10, flexShrink:0 }}/>
                  : <img src={photo.url} alt="" style={{ width:100, height:80, objectFit:'cover', borderRadius:10, flexShrink:0 }}/>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:3 }}>
                    {photo.caption || <span style={{ color:'var(--muted)' }}>No caption</span>}
                  </div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted2)', marginBottom:8 }}>
                    Uploaded by <strong>{photo.uploader_name}</strong> · {timeAgo(photo.created_at)}
                    {photo.album_id && albums.find(a=>a.id===photo.album_id) && (
                      <span style={{ marginLeft:8 }}>📁 {albums.find(a=>a.id===photo.album_id)?.name}</span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>approve(photo.id)}
                      style={{ padding:'6px 16px', background:'rgba(0,229,160,.15)', border:'1px solid rgba(0,229,160,.3)', borderRadius:8, color:'var(--green)', cursor:'pointer', fontSize:'.8rem', fontWeight:700, fontFamily:'inherit' }}>
                      ✅ Approve
                    </button>
                    <button onClick={()=>reject(photo.id)}
                      style={{ padding:'6px 14px', background:'rgba(255,77,109,.1)', border:'1px solid rgba(255,77,109,.25)', borderRadius:8, color:'#FF4D6D', cursor:'pointer', fontSize:'.8rem', fontFamily:'inherit' }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <Lightbox items={lightbox.items} index={lightbox.index} onClose={()=>setLightbox(null)}/>
      )}
    </Layout>
  );
}
