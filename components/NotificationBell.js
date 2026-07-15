import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const VAPID_PUBLIC = 'BJksSkC9PcN_58qBiwEjZc460b6BR2L3fKpEmCW5S0W9qW7cFrfomcg74GIRZi79fHZfuDt_NXZfp0sEiq4m6ds';

// Convert base64url to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Subscribe this browser to Web Push and save to DB
async function subscribeToPush(registration) {
  try {
    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-save in case user changed
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing),
      });
      return existing;
    }
    // Subscribe
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    return sub;
  } catch(e) {
    console.log('Push subscribe error:', e.message);
    return null;
  }
}

const ICONS = {
  task_created:'📋', task_assigned:'👤', task_moved:'⚡',
  task_edited:'✏️', task_deleted:'🗑', followup_created:'📩',
  followup_done:'✅', client_created:'🏢', client_updated:'🏢', client_deleted:'🏢',
};

function playSound() {
  try {
    const s = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
    if (s.soundEnabled === false) return;
    const vol = Math.min(1, (s.volume ?? 90) / 100);
    const a = new Audio('/notification.mp3');
    a.volume = vol;
    a.play().catch(() => {});
  } catch(e) {}
}

function osPopup(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon:'/favicon-32.png', tag: tag||'ys', silent:false });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 7000);
  } catch(e) {}
}

function setFavicon(count) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) { link = document.createElement('link'); link.rel='icon'; document.head.appendChild(link); }
  const base = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = count > 0 ? `(${count}) ${base}` : base;
  if (count === 0) { link.href = '/favicon.ico'; return; }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width=32; c.height=32;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 32, 32);
    ctx.fillStyle='#FF4D6D'; ctx.beginPath(); ctx.arc(24,8,9,0,2*Math.PI); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 11px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(count>9?'9+':String(count), 24, 8);
    link.href = c.toDataURL();
  };
  img.src = '/favicon-32.png';
}

function ago(iso) {
  const m = Math.floor((Date.now()-new Date(iso))/60000);
  if (m<1) return 'just now'; if (m<60) return m+'m ago';
  const h=Math.floor(m/60); return h<24?h+'h ago':Math.floor(h/24)+'d ago';
}

export default function NotificationBell() {
  const { data:session, status } = useSession();
  const [notifs,  setNotifs]  = useState([]);
  const [unread,  setUnread]  = useState(0);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [perm,    setPerm]    = useState('default');
  const [toasts,  setToasts]  = useState([]);
  const panelRef = useRef(null);
  const sinceRef = useRef(null);
  const seenIds  = useRef(new Set());

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    // Push permission
    if ('Notification' in window) {
      setPerm(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(async p => {
          setPerm(p);
          if (p === 'granted') {
            const reg = await navigator.serviceWorker?.ready;
            if (reg) subscribeToPush(reg);
          }
        });
      }
    }
    // Service worker + Web Push subscription
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async reg => {
        // Subscribe to Web Push (saves endpoint to DB)
        if (Notification.permission === 'granted') {
          await subscribeToPush(reg);
        }
      }).catch(() => {});

      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'NEW_NOTIF') handleNewNotif(e.data.notification, e.data.unread);
      });
    }
    // Outside click
    const out = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  useEffect(() => { setFavicon(unread); }, [unread]);

  // ── Handle a single new notification ─────────────────────
  function handleNewNotif(n, count) {
    if (seenIds.current.has(n.id)) return;
    seenIds.current.add(n.id);

    // Add to list
    setNotifs(prev => [n, ...prev].slice(0, 60));

    // Show toast
    const key = n.id + '_' + Date.now();
    setToasts(prev => [...prev.slice(-2), { ...n, _key: key }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t._key !== key)), 6000);

    // Sound
    playSound();

    // OS popup
    osPopup(n.title, n.body, n.id);

    // Update count
    if (typeof count === 'number') {
      setUnread(count);
    } else {
      setUnread(p => p + 1);
    }
  }

  // ── Fetch all on open ────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      const list = Array.isArray(d.notifications) ? d.notifications : [];
      setNotifs(list);
      list.forEach(n => seenIds.current.add(n.id));
      setUnread(d.unread || 0);
    } catch(e) {}
    setLoading(false);
  }

  // ── Poll every 4 seconds ─────────────────────────────────
  async function poll() {
    if (!sinceRef.current) return;
    try {
      const since = sinceRef.current;
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since));
      if (!r.ok) return;
      const d = await r.json();
      sinceRef.current = new Date().toISOString();
      const fresh = Array.isArray(d.notifications) ? d.notifications : [];
      fresh.forEach(n => handleNewNotif(n, d.unread));
      if (fresh.length === 0 && typeof d.unread === 'number') {
        setUnread(d.unread);
      }
    } catch(e) {}
  }

  // ── Start polling when logged in ─────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;
    sinceRef.current = new Date(Date.now() - 300000).toISOString(); // 5 min back
    fetchAll();
    const timer = setInterval(poll, 4000);
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({ type:'START', since: sinceRef.current });
    });
    return () => clearInterval(timer);
  }, [status]); // eslint-disable-line

  // ── Mark all read ────────────────────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})});
      setUnread(0); setNotifs(p => p.map(n => ({...n,read:true})));
    } catch(e) {}
  }

  async function markOne(id) {
    try {
      await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      setNotifs(p => p.map(n => n.id===id?{...n,read:true}:n));
      setUnread(p => Math.max(0,p-1));
    } catch(e) {}
  }

  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n=>n.id===id)?.read===false;
      await fetch('/api/notifications?id='+id,{method:'DELETE'});
      setNotifs(p=>p.filter(n=>n.id!==id));
      seenIds.current.delete(id);
      if (wasUnread) setUnread(p=>Math.max(0,p-1));
    } catch(e) {}
  }

  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      await Promise.all(notifs.map(n=>fetch('/api/notifications?id='+n.id,{method:'DELETE'})));
      setNotifs([]); setUnread(0); seenIds.current.clear();
    } catch(e) {}
  }

  const ringing = unread > 0;

  return (
    <>
      {/* ── TOAST POPUPS bottom-right ── */}
      <div style={{position:'fixed',bottom:20,right:20,zIndex:2147483647,display:'flex',flexDirection:'column-reverse',gap:10,maxWidth:380,pointerEvents:'none'}}>
        {toasts.map(t => (
          <div key={t._key} style={{background:'#ffffff',borderRadius:12,boxShadow:'0 4px 24px rgba(0,0,0,.2),0 0 0 1px rgba(0,0,0,.06)',padding:'14px 16px',display:'flex',gap:12,alignItems:'flex-start',pointerEvents:'auto',animation:'ys-in .3s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.15rem',flexShrink:0}}>
              {ICONS[t.type]||'🔔'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:'.87rem',color:'#111',marginBottom:4,lineHeight:1.3,fontFamily:'Arial,sans-serif'}}>{t.title}</div>
              <div style={{fontSize:'.8rem',color:'#555',lineHeight:1.45,fontFamily:'Arial,sans-serif'}}>{t.body}</div>
              <div style={{fontSize:'.7rem',color:'#999',marginTop:5,fontFamily:'Arial,sans-serif'}}>yoursocials.vercel.app</div>
            </div>
            <button onClick={()=>setToasts(p=>p.filter(x=>x._key!==t._key))} style={{background:'none',border:'none',cursor:'pointer',color:'#aaa',fontSize:'1rem',padding:'0 2px',lineHeight:1,flexShrink:0}}>✕</button>
          </div>
        ))}
      </div>

      {/* ── BELL ── */}
      <div ref={panelRef} style={{position:'relative',display:'flex',alignItems:'center'}}>
        <button
          onClick={()=>{setOpen(o=>!o);if(!open)fetchAll();}}
          style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:'6px 8px',borderRadius:10,display:'flex',alignItems:'center'}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
          onMouseLeave={e=>e.currentTarget.style.background='none'}
        >
          <span style={{fontSize:'1.3rem',lineHeight:1,display:'inline-block',color:ringing?'var(--yellow)':'var(--muted2)',animation:ringing?'ys-bell 2s ease infinite':'none'}}>🔔</span>
          {ringing&&(
            <span style={{position:'absolute',top:0,right:0,background:'#FF4D6D',color:'#fff',fontSize:'.58rem',fontWeight:900,minWidth:17,height:17,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1,boxShadow:'0 0 0 2px var(--surface)',animation:'ys-pulse 1.8s infinite'}}>
              {unread>99?'99+':unread}
            </span>
          )}
        </button>

        {open&&(
          <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,width:360,maxHeight:'min(540px,82dvh)',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,.6)',zIndex:9999,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'13px 16px 11px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{fontWeight:800,fontSize:'.9rem',display:'flex',alignItems:'center',gap:8}}>
                🔔 Notifications
                {ringing&&<span style={{background:'#FF4D6D',color:'#fff',fontSize:'.6rem',fontWeight:700,padding:'2px 7px',borderRadius:20}}>{unread} new</span>}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {perm==='default'&&<button onClick={()=>Notification.requestPermission().then(p=>setPerm(p))} style={{fontSize:'.68rem',color:'#60A5FA',background:'rgba(96,165,250,.12)',border:'1px solid rgba(96,165,250,.3)',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>Allow popups</button>}
                {perm==='denied'&&<span style={{fontSize:'.65rem',color:'var(--orange)'}}>🔕 Blocked</span>}
                {perm==='granted'&&<span style={{fontSize:'.65rem',color:'var(--green)'}}>✅ Popups on</span>}
                {ringing&&<button onClick={markAllRead} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.72rem',color:'var(--purple2)',fontWeight:600,fontFamily:'inherit',padding:0}}>Mark all read</button>}
                <button onClick={()=>setOpen(false)} style={{background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,cursor:'pointer',color:'var(--muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.8rem'}}>✕</button>
              </div>
            </div>

            <div style={{overflowY:'auto',flex:1}}>
              {loading&&<div style={{padding:'32px',textAlign:'center',color:'var(--muted)',fontSize:'.82rem'}}>⏳ Loading…</div>}
              {!loading&&notifs.length===0&&(
                <div style={{padding:'40px 24px',textAlign:'center'}}>
                  <div style={{fontSize:'2.5rem',marginBottom:10,opacity:.4}}>🔕</div>
                  <div style={{fontSize:'.85rem',fontWeight:600,color:'var(--muted)',marginBottom:8}}>All caught up!</div>
                  <div style={{fontSize:'.75rem',color:'var(--muted2)',lineHeight:1.7}}>When tasks are created, moved or completed — a popup and sound alerts all team members.</div>
                </div>
              )}
              {notifs.map(n=>(
                <div key={n.id} onClick={()=>markOne(n.id)}
                  style={{padding:'11px 15px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:n.read?'transparent':'rgba(124,92,252,.08)',display:'flex',gap:11,alignItems:'flex-start',transition:'background .12s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                  onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(124,92,252,.08)'}
                >
                  <div style={{width:36,height:36,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.05rem',background:n.read?'rgba(255,255,255,.05)':'rgba(124,92,252,.18)'}}>
                    {ICONS[n.type]||'🔔'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'.82rem',fontWeight:n.read?500:700,lineHeight:1.35,marginBottom:3}}>{n.title}</div>
                    <div style={{fontSize:'.74rem',color:'var(--muted2)',lineHeight:1.45,marginBottom:4}}>{n.body}</div>
                    <div style={{fontSize:'.64rem',color:'var(--muted)'}}>{ago(n.created_at)}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,flexShrink:0}}>
                    {!n.read&&<div style={{width:7,height:7,borderRadius:'50%',background:'var(--purple)',marginTop:3}}/>}
                    <button onClick={e=>dismiss(n.id,e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:'.8rem',padding:2,opacity:.55}}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {notifs.length>0&&(
              <div style={{padding:'9px 16px',borderTop:'1px solid var(--border)',flexShrink:0,display:'flex',justifyContent:'center'}}>
                <button onClick={clearAll} style={{background:'none',border:'none',cursor:'pointer',fontSize:'.72rem',color:'var(--muted)',fontFamily:'inherit'}}>Clear all</button>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes ys-bell{0%,100%{transform:rotate(0)}8%{transform:rotate(-20deg)}16%{transform:rotate(20deg)}24%{transform:rotate(-13deg)}32%{transform:rotate(13deg)}40%{transform:rotate(0)}}
          @keyframes ys-pulse{0%,100%{box-shadow:0 0 0 2px var(--surface)}50%{box-shadow:0 0 0 4px rgba(255,77,109,.4)}}
          @keyframes ys-in{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        `}</style>
      </div>
    </>
  );
}
