import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const TYPE_EMOJI = {
  task_created:'📋', task_assigned:'👤', task_moved:'⚡',
  task_edited:'✏️',  task_deleted:'🗑',  followup_created:'📩',
  followup_done:'✅', client_created:'🏢', client_updated:'🏢',
  client_deleted:'🏢', default:'🔔',
};

// ── Settings ─────────────────────────────────────────────────
function getLocalSettings() {
  try { return JSON.parse(localStorage.getItem('ys_notif_settings') || '{}'); } catch { return {}; }
}

// ── Audio ─────────────────────────────────────────────────────
let _audio = null;
function initAudio() {
  if (_audio) return;
  _audio = new Audio('/notification.mp3');
  _audio.preload = 'auto';
  _audio.load();
}
function playSound() {
  const s = getLocalSettings();
  if (s.soundEnabled === false) return;
  const vol = Math.min(1, (s.volume || 90) / 100);
  try {
    initAudio();
    _audio.volume = vol;
    _audio.currentTime = 0;
    const p = _audio.play();
    if (p) p.catch(() => {
      const a = new Audio('/notification.mp3');
      a.volume = vol;
      a.play().catch(() => {});
    });
  } catch { try { new Audio('/notification.mp3').play(); } catch {} }
}

// ── OS Push Notification ─────────────────────────────────────
function showOSNotif(title, body, tag) {
  const s = getLocalSettings();
  if (s.pushEnabled === false) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body, icon: '/favicon-32.png', badge: '/favicon-32.png',
      tag: tag || 'ys', requireInteraction: false, silent: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => { try { n.close(); } catch {} }, 8000);
  } catch {}
}

// ── Favicon badge ─────────────────────────────────────────────
let _origFav = null;
let _canvas  = null;
function updateFavicon(count) {
  if (typeof document === 'undefined') return;
  try {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    if (!_origFav) _origFav = '/favicon-32.png';
    if (count === 0) { link.href = _origFav; return; }
    if (!_canvas) { _canvas = document.createElement('canvas'); _canvas.width = 32; _canvas.height = 32; }
    const ctx = _canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const draw = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      ctx.fillStyle = '#FF4D6D';
      ctx.beginPath(); ctx.arc(25, 7, 8, 0, 2*Math.PI); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), 25, 7);
      link.href = _canvas.toDataURL();
    };
    img.onload = draw;
    img.onerror = () => { ctx.clearRect(0,0,32,32); draw(); };
    img.src = _origFav + '?t=' + Date.now();
  } catch {}
}
let _origTitle = null;
function updateTitle(count) {
  if (typeof document === 'undefined') return;
  if (!_origTitle) _origTitle = document.title.replace(/^\(\d+\)\s*/,'');
  document.title = count > 0 ? `(${count}) ${_origTitle}` : _origTitle;
}

function timeAgo(iso) {
  const m = Math.floor((Date.now()-new Date(iso))/60000);
  if (m < 1) return 'just now';
  if (m < 60) return m+'m ago';
  const h = Math.floor(m/60);
  if (h < 24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

// ── Main ──────────────────────────────────────────────────────
export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifs,   setNotifs]   = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [permState,setPermState]= useState('default');

  const sinceRef   = useRef(null);
  const panelRef   = useRef(null);
  const pollRef    = useRef(null);
  const prevCount  = useRef(0);
  const swRef      = useRef(null);

  // ── Register Service Worker ───────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then(reg => {
      swRef.current = reg;
      console.log('[SW] registered');
    }).catch(e => console.log('[SW] failed', e));

    // Listen for messages FROM service worker (new notifs while tab inactive)
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'NEW_NOTIFICATION') {
        const n = e.data.notification;
        const count = e.data.unread || 0;
        setNotifs(prev => {
          const ids = new Set(prev.map(x=>x.id));
          return ids.has(n.id) ? prev : [n, ...prev].slice(0,60);
        });
        if (count > prevCount.current) {
          playSound();
          setUnread(count);
          prevCount.current = count;
        }
      }
    });
  }, []);

  // ── Push permission ───────────────────────────────────────
  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermState(Notification.permission);
    if (Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission().then(p => setPermState(p)), 2000);
    }
  }, []);

  // ── Close on outside click ────────────────────────────────
  useEffect(() => {
    const h = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Favicon / title ───────────────────────────────────────
  useEffect(() => { updateFavicon(unread); updateTitle(unread); }, [unread]);

  // ── Preload audio on first interaction ────────────────────
  useEffect(() => {
    const unlock = () => { initAudio(); };
    window.addEventListener('click', unlock, { once:true });
    window.addEventListener('keydown', unlock, { once:true });
    window.addEventListener('touchstart', unlock, { once:true });
  }, []);

  // ── Fetch all notifs ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setNotifs(Array.isArray(d.notifications) ? d.notifications : []);
      const cnt = d.unread || 0;
      setUnread(cnt); prevCount.current = cnt;
    } catch {}
    setLoading(false);
  }, []);

  // ── In-page poll every 4s ─────────────────────────────────
  const poll = useCallback(async () => {
    if (!sinceRef.current) return;
    try {
      const since = sinceRef.current;
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since));
      if (!r.ok) return;
      const d = await r.json();
      sinceRef.current = new Date().toISOString();
      const newOnes = Array.isArray(d.notifications) ? d.notifications : [];
      const newCount = d.unread || 0;
      if (newOnes.length > 0) {
        setNotifs(prev => {
          const ids = new Set(prev.map(n=>n.id));
          const fresh = newOnes.filter(n=>!ids.has(n.id));
          return fresh.length ? [...fresh,...prev].slice(0,60) : prev;
        });
        if (newCount > prevCount.current) {
          playSound();
          newOnes.forEach(n => showOSNotif(n.title, n.body, n.id));
        }
        setUnread(newCount); prevCount.current = newCount;
      } else if (newCount !== prevCount.current) {
        setUnread(newCount); prevCount.current = newCount;
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    sinceRef.current = new Date(Date.now()-30000).toISOString();
    fetchAll();
    pollRef.current = setInterval(poll, 4000);

    // Tell service worker to also start polling (works even in background)
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type:'SET_SESSION', email: session?.user?.email,
        since: sinceRef.current,
      });
    }
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({
        type:'SET_SESSION', email: session?.user?.email,
        since: sinceRef.current,
      });
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, fetchAll, poll]);

  // ── Actions ───────────────────────────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})});
      setUnread(0); prevCount.current = 0;
      setNotifs(prev => prev.map(n=>({...n,read:true})));
    } catch {}
  }
  async function markRead(id) {
    try {
      await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      setNotifs(prev => prev.map(n=>n.id===id?{...n,read:true}:n));
      setUnread(p => { const v=Math.max(0,p-1); prevCount.current=v; return v; });
    } catch {}
  }
  async function dismiss(id,e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n=>n.id===id)?.read===false;
      await fetch('/api/notifications?id='+id,{method:'DELETE'});
      setNotifs(prev=>prev.filter(n=>n.id!==id));
      if (wasUnread) setUnread(p=>{ const v=Math.max(0,p-1); prevCount.current=v; return v; });
    } catch {}
  }
  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      await Promise.all(notifs.map(n=>fetch('/api/notifications?id='+n.id,{method:'DELETE'})));
      setNotifs([]); setUnread(0); prevCount.current=0;
    } catch {}
  }

  const isRinging = unread > 0;

  return (
    <div ref={panelRef} style={{position:'relative',display:'flex',alignItems:'center'}}>

      {/* Bell */}
      <button
        onClick={() => { setOpen(o=>!o); if(!open) fetchAll(); }}
        title={`Notifications${unread>0?' ('+unread+' new)':''}`}
        style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:'6px 8px',borderRadius:10,display:'flex',alignItems:'center',transition:'background .15s'}}
        onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
        onMouseLeave={e=>e.currentTarget.style.background='none'}
      >
        <span style={{fontSize:'1.3rem',lineHeight:1,display:'inline-block',animation:isRinging?'bell-ring 2s ease infinite':'none',color:isRinging?'var(--yellow)':'var(--muted2)'}}>🔔</span>
        {isRinging&&(
          <span style={{position:'absolute',top:0,right:0,background:'#FF4D6D',color:'#fff',fontSize:'.58rem',fontWeight:900,minWidth:17,height:17,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1,boxShadow:'0 0 0 2px var(--surface)',animation:'badge-pulse 1.8s infinite'}}>
            {unread>99?'99+':unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open&&(
        <div className="scale-in" style={{position:'absolute',top:'calc(100% + 10px)',right:0,width:360,maxHeight:'min(540px,82dvh)',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,.6)',zIndex:999,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Header */}
          <div style={{padding:'13px 16px 11px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div style={{fontWeight:800,fontSize:'.9rem',display:'flex',alignItems:'center',gap:8}}>
              🔔 Notifications
              {isRinging&&<span style={{background:'#FF4D6D',color:'#fff',fontSize:'.6rem',fontWeight:700,padding:'2px 7px',borderRadius:20}}>{unread} new</span>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {permState==='default'&&(
                <button onClick={()=>Notification.requestPermission().then(p=>setPermState(p))}
                  style={{fontSize:'.68rem',color:'var(--cyan)',background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.2)',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                  Enable push
                </button>
              )}
              {permState==='denied'&&<span style={{fontSize:'.65rem',color:'var(--orange)'}}>🔕 Blocked</span>}
              {permState==='granted'&&<span style={{fontSize:'.65rem',color:'var(--green)'}}>✅ Push on</span>}
              {isRinging&&(
                <button onClick={markAllRead} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.72rem',color:'var(--purple2)',fontWeight:600,fontFamily:'Inter,sans-serif',padding:0}}>
                  Mark all read
                </button>
              )}
              <button onClick={()=>setOpen(false)} style={{background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,cursor:'pointer',color:'var(--muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.8rem'}}>✕</button>
            </div>
          </div>

          {/* List */}
          <div style={{overflowY:'auto',flex:1}}>
            {loading&&<div style={{padding:'24px',textAlign:'center',color:'var(--muted)',fontSize:'.82rem'}}>⏳ Loading…</div>}
            {!loading&&notifs.length===0&&(
              <div style={{padding:'36px 20px',textAlign:'center',color:'var(--muted)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:10,opacity:.5}}>🔕</div>
                <div style={{fontSize:'.85rem',fontWeight:600,marginBottom:6}}>All caught up!</div>
                <div style={{fontSize:'.75rem',lineHeight:1.6,color:'var(--muted2)'}}>
                  When tasks are assigned, completed, or follow-ups are sent, everyone gets notified here with a sound — even on other tabs.
                </div>
              </div>
            )}
            {notifs.map(n=>(
              <div key={n.id} onClick={()=>markRead(n.id)}
                style={{padding:'11px 15px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:n.read?'transparent':'rgba(124,92,252,.07)',transition:'background .15s',display:'flex',gap:11,alignItems:'flex-start'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(124,92,252,.07)'}>
                <div style={{width:36,height:36,borderRadius:10,background:n.read?'rgba(255,255,255,.05)':'rgba(124,92,252,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.05rem',flexShrink:0}}>
                  {TYPE_EMOJI[n.type]||TYPE_EMOJI.default}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'.82rem',fontWeight:n.read?500:700,color:'var(--text)',marginBottom:3,lineHeight:1.35}}>{n.title}</div>
                  <div style={{fontSize:'.74rem',color:'var(--muted2)',lineHeight:1.45,marginBottom:4}}>{n.body}</div>
                  <div style={{fontSize:'.65rem',color:'var(--muted)'}}>{timeAgo(n.created_at)}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,flexShrink:0}}>
                  {!n.read&&<div style={{width:7,height:7,borderRadius:'50%',background:'var(--purple)',marginTop:3}}/>}
                  <button onClick={e=>dismiss(n.id,e)} title="Dismiss" style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:'.8rem',padding:2,lineHeight:1,opacity:.5}}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {notifs.length>0&&(
            <div style={{padding:'9px 16px',borderTop:'1px solid var(--border)',flexShrink:0,display:'flex',justifyContent:'center'}}>
              <button onClick={clearAll} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.72rem',color:'var(--muted)',fontFamily:'Inter,sans-serif'}}>Clear all</button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes bell-ring {
          0%,100%{transform:rotate(0)}
          8%{transform:rotate(-18deg)}
          16%{transform:rotate(18deg)}
          24%{transform:rotate(-12deg)}
          32%{transform:rotate(12deg)}
          40%{transform:rotate(0)}
        }
        @keyframes badge-pulse {
          0%,100%{box-shadow:0 0 0 2px var(--surface)}
          50%{box-shadow:0 0 0 4px rgba(255,77,109,.35)}
        }
      `}</style>
    </div>
  );
}
