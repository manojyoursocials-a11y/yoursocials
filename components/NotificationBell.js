import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const TYPE_EMOJI = {
  task_created:'📋', task_assigned:'👤', task_moved:'⚡',
  task_edited:'✏️',  task_deleted:'🗑',  followup_created:'📩',
  followup_done:'✅', client_created:'🏢', client_updated:'🏢',
  client_deleted:'🏢', default:'🔔',
};

// ── Sound — plays MP3 using a reliable method ──────────────────
let _primed = false;

function primeAudio() {
  if (_primed) return;
  _primed = true;
  try {
    const a = new Audio('/notification.mp3');
    a.volume = 0.001;
    const p = a.play();
    if (p) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  } catch(e) {}
}

function playNotificationSound() {
  try {
    const s = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
    if (s.soundEnabled === false) return;
    const vol = Math.min(1, (s.volume || 90) / 100);
    const audio = new Audio('/notification.mp3');
    audio.volume = vol;
    audio.play().catch(() => {});
  } catch(e) {}
}

// ── OS Desktop Popup (like Google Chat in screenshot) ──────────
function showDesktopPopup(title, body, tag) {
  try {
    const s = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
    if (s.pushEnabled === false) return;
  } catch(e) {}
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon:  '/favicon-32.png',
      badge: '/favicon-32.png',
      tag:   tag || 'ys-os',
      requireInteraction: false,
      silent: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => { try { n.close(); } catch(e) {} }, 6000);
  } catch(e) { console.log('Push err:', e); }
}

// ── Favicon red badge ──────────────────────────────────────────
function setFaviconBadge(count) {
  if (typeof document === 'undefined') return;
  try {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    if (count === 0) { link.href = '/favicon.ico'; return; }
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      ctx.fillStyle = '#FF4D6D';
      ctx.beginPath(); ctx.arc(25, 7, 8, 0, 2*Math.PI); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), 25, 7);
      link.href = c.toDataURL();
    };
    img.onerror = () => { link.href = '/favicon.ico'; };
    img.src = '/favicon-32.png';
  } catch(e) {}
}

function setTabTitle(count) {
  if (typeof document === 'undefined') return;
  const base = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = count > 0 ? `(${count}) ${base}` : base;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── Component ──────────────────────────────────────────────────
export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifs,    setNotifs]    = useState([]);
  const [unread,    setUnread]    = useState(0);
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [permState, setPermState] = useState('default');

  const sinceRef  = useRef(null);
  const panelRef  = useRef(null);
  const timerRef  = useRef(null);
  const prevCount = useRef(0);

  // ── Ask for push permission immediately ───────────────────
  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermState(Notification.permission);
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setPermState(p));
    }
  }, []);

  // ── Prime audio on any user interaction ───────────────────
  useEffect(() => {
    const events = ['click','keydown','touchstart','mousedown','scroll'];
    events.forEach(ev => window.addEventListener(ev, primeAudio, { once: true, passive: true }));
    return () => events.forEach(ev => window.removeEventListener(ev, primeAudio));
  }, []);

  // ── Close on outside click ────────────────────────────────
  useEffect(() => {
    const h = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Update favicon + title when unread changes ────────────
  useEffect(() => {
    setFaviconBadge(unread);
    setTabTitle(unread);
  }, [unread]);

  // ── Fetch all (on open) ───────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setNotifs(Array.isArray(d.notifications) ? d.notifications : []);
      const cnt = d.unread || 0;
      setUnread(cnt);
      prevCount.current = cnt;
    } catch(e) {}
    setLoading(false);
  }, []);

  // ── Core poll — runs every 4 seconds ─────────────────────
  const poll = useCallback(async () => {
    if (!sinceRef.current) return;
    try {
      const since = sinceRef.current;
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since));
      if (!r.ok) return;
      const d = await r.json();

      // Move pointer forward
      sinceRef.current = new Date().toISOString();

      const fresh    = Array.isArray(d.notifications) ? d.notifications : [];
      const newCount = d.unread || 0;

      if (fresh.length > 0) {
        // Add to list (prepend, deduplicated)
        setNotifs(prev => {
          const ids = new Set(prev.map(n => n.id));
          const add = fresh.filter(n => !ids.has(n.id));
          return add.length ? [...add, ...prev].slice(0, 60) : prev;
        });

        // Only alert if count actually went up
        if (newCount > prevCount.current) {
          playNotificationSound();
          fresh.forEach(n => showDesktopPopup(n.title, n.body, n.id));
        }

        setUnread(newCount);
        prevCount.current = newCount;
      } else if (newCount !== prevCount.current) {
        setUnread(newCount);
        prevCount.current = newCount;
      }
    } catch(e) {}
  }, []);

  // ── Start / stop polling ──────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;
    // Go back 60 seconds to catch anything recent
    sinceRef.current = new Date(Date.now() - 60000).toISOString();
    fetchAll();
    timerRef.current = setInterval(poll, 4000);
    return () => clearInterval(timerRef.current);
  }, [status]);

  // ── Actions ───────────────────────────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ all: true }) });
      setUnread(0); prevCount.current = 0;
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch(e) {}
  }

  async function markOne(id) {
    try {
      await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }) });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(p => { const v = Math.max(0, p-1); prevCount.current = v; return v; });
    } catch(e) {}
  }

  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n => n.id === id)?.read === false;
      await fetch('/api/notifications?id=' + id, { method:'DELETE' });
      setNotifs(prev => prev.filter(n => n.id !== id));
      if (wasUnread) setUnread(p => { const v = Math.max(0, p-1); prevCount.current = v; return v; });
    } catch(e) {}
  }

  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      await Promise.all(notifs.map(n => fetch('/api/notifications?id=' + n.id, { method:'DELETE' })));
      setNotifs([]); setUnread(0); prevCount.current = 0;
    } catch(e) {}
  }

  const isRinging = unread > 0;

  return (
    <div ref={panelRef} style={{ position:'relative', display:'flex', alignItems:'center' }}>

      {/* Bell button */}
      <button
        onClick={() => { const next = !open; setOpen(next); if (next) fetchAll(); }}
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:10, display:'flex', alignItems:'center', transition:'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
        title="Notifications"
      >
        <span style={{
          fontSize: '1.3rem', lineHeight: 1,
          display: 'inline-block',
          color: isRinging ? 'var(--yellow)' : 'var(--muted2)',
          animation: isRinging ? 'ys-bell 2s ease infinite' : 'none',
        }}>🔔</span>

        {isRinging && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#FF4D6D', color: '#fff',
            fontSize: '.58rem', fontWeight: 900,
            minWidth: 17, height: 17, borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
            boxShadow: '0 0 0 2px var(--surface)',
            animation: 'ys-pulse 1.8s infinite',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 360, maxHeight: 'min(540px,82dvh)',
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.65)',
          zIndex: 999, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:'.9rem', display:'flex', alignItems:'center', gap:8 }}>
              🔔 Notifications
              {isRinging && <span style={{ background:'#FF4D6D', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'2px 7px', borderRadius:20 }}>{unread} new</span>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {permState === 'default' && (
                <button onClick={() => Notification.requestPermission().then(p => setPermState(p))}
                  style={{ fontSize:'.68rem', color:'#60A5FA', background:'rgba(96,165,250,.1)', border:'1px solid rgba(96,165,250,.25)', borderRadius:6, padding:'3px 9px', cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:700 }}>
                  Enable popup
                </button>
              )}
              {permState === 'denied' && (
                <span title="Blocked in browser settings" style={{ fontSize:'.65rem', color:'var(--orange)' }}>🔕 Blocked</span>
              )}
              {permState === 'granted' && (
                <span style={{ fontSize:'.65rem', color:'var(--green)' }}>✅ Popup on</span>
              )}
              {isRinging && (
                <button onClick={markAllRead} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--purple2)', fontWeight:600, fontFamily:'Inter,sans-serif', padding:0 }}>
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:6, width:26, height:26, cursor:'pointer', color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.8rem' }}>✕</button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {loading && <div style={{ padding:'28px', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>⏳ Loading…</div>}

            {!loading && notifs.length === 0 && (
              <div style={{ padding:'40px 24px', textAlign:'center', color:'var(--muted)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:10, opacity:.5 }}>🔕</div>
                <div style={{ fontSize:'.88rem', fontWeight:600, marginBottom:8 }}>No notifications yet</div>
                <div style={{ fontSize:'.76rem', color:'var(--muted2)', lineHeight:1.7 }}>
                  When someone creates a task, changes status, or completes a follow-up, everyone on the team gets notified here — with a popup and sound, even on other browser tabs.
                </div>
              </div>
            )}

            {notifs.map(n => (
              <div key={n.id}
                onClick={() => markOne(n.id)}
                style={{ padding:'11px 15px', borderBottom:'1px solid var(--border)', cursor:'pointer', background: n.read ? 'transparent' : 'rgba(124,92,252,.08)', display:'flex', gap:11, alignItems:'flex-start', transition:'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(124,92,252,.08)'}
              >
                <div style={{ width:36, height:36, borderRadius:10, background: n.read ? 'rgba(255,255,255,.05)' : 'rgba(124,92,252,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.05rem', flexShrink:0 }}>
                  {TYPE_EMOJI[n.type] || TYPE_EMOJI.default}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.82rem', fontWeight: n.read ? 500 : 700, lineHeight:1.35, marginBottom:3 }}>{n.title}</div>
                  <div style={{ fontSize:'.74rem', color:'var(--muted2)', lineHeight:1.45, marginBottom:4 }}>{n.body}</div>
                  <div style={{ fontSize:'.64rem', color:'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, flexShrink:0 }}>
                  {!n.read && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--purple)', marginTop:3 }}/>}
                  <button onClick={e => dismiss(n.id, e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.8rem', padding:2, opacity:.55 }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {notifs.length > 0 && (
            <div style={{ padding:'9px 16px', borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', justifyContent:'center' }}>
              <button onClick={clearAll} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--muted)', fontFamily:'Inter,sans-serif' }}>Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes ys-bell {
          0%,100%{transform:rotate(0)}
          8%{transform:rotate(-20deg)}
          16%{transform:rotate(20deg)}
          24%{transform:rotate(-13deg)}
          32%{transform:rotate(13deg)}
          40%{transform:rotate(0)}
        }
        @keyframes ys-pulse {
          0%,100%{box-shadow:0 0 0 2px var(--surface)}
          50%{box-shadow:0 0 0 4px rgba(255,77,109,.4)}
        }
      `}</style>
    </div>
  );
}
