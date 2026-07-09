import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const TYPE_EMOJI = {
  task_created:    '📋',
  task_assigned:   '👤',
  task_moved:      '⚡',
  task_edited:     '✏️',
  task_deleted:    '🗑',
  followup_created:'📩',
  followup_done:   '✅',
  client_created:  '🏢',
  client_updated:  '🏢',
  client_deleted:  '🏢',
  default:         '🔔',
};

// ── Read notification settings from localStorage ───────────────
function getSettings() {
  try {
    const s = localStorage.getItem('ys_notif_settings');
    return s ? JSON.parse(s) : {};
  } catch(e) { return {}; }
}

// ── Audio singleton ─────────────────────────────────────────────
let _audio = null;
let _unlocked = false;
if (typeof window !== 'undefined') {
  ['click','keydown','touchstart','touchend'].forEach(ev =>
    window.addEventListener(ev, () => { _unlocked = true; }, { passive:true })
  );
}
function playSound() {
  const settings = getSettings();
  if (settings.soundEnabled === false) return; // respect sound toggle
  if (!_unlocked) return;
  try {
    if (!_audio) { _audio = new Audio('/notification.mp3'); _audio.preload = 'auto'; }
    _audio.volume = Math.min(1, (settings.volume || 90) / 100);
    _audio.currentTime = 0;
    _audio.play().catch(() => { _audio = null; });
  } catch(e) { _audio = null; }
}

// ── Favicon badge ───────────────────────────────────────────────
// Draws a red dot or count on the favicon when there are unread notifications
let _originalFavicon = null;
function updateFavicon(count) {
  if (typeof document === 'undefined') return;
  try {
    // Get or cache original favicon
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }

    if (count === 0) {
      // Restore original
      link.href = _originalFavicon || '/favicon.ico';
      return;
    }

    // Draw on a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Draw original favicon
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      // Red badge circle
      ctx.beginPath();
      ctx.arc(26, 6, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF4D6D';
      ctx.fill();
      // Count text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), 26, 6);
      // Update favicon
      if (!_originalFavicon) _originalFavicon = link.href;
      link.href = canvas.toDataURL('image/png');
    };
    img.onerror = () => {
      // If favicon load fails, just draw a red circle
      ctx.beginPath();
      ctx.arc(26, 6, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF4D6D';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), 26, 6);
      link.href = canvas.toDataURL('image/png');
    };
    img.src = _originalFavicon || '/favicon-32.png';
  } catch(e) {}
}

// ── Page title badge ────────────────────────────────────────────
let _originalTitle = null;
function updateTitle(count) {
  if (typeof document === 'undefined') return;
  if (!_originalTitle) _originalTitle = document.title.replace(/^\(\d+\) /, '');
  document.title = count > 0 ? `(${count}) ${_originalTitle}` : _originalTitle;
}

// ── Browser push notification ───────────────────────────────────
function sendPush(title, body, tag) {
  const settings = getSettings();
  if (settings.pushEnabled === false) return;
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon:  '/favicon-32.png',
      badge: '/favicon-32.png',
      tag,
      requireInteraction: false,
      silent: false,
    });
    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000);
  } catch(e) {}
}

function timeAgo(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ── Main component ──────────────────────────────────────────────
export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifs,    setNotifs]    = useState([]);
  const [unread,    setUnread]    = useState(0);
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [permState, setPermState] = useState('default');

  const sinceRef   = useRef(null);
  const panelRef   = useRef(null);
  const pollRef    = useRef(null);
  const prevUnread = useRef(0);

  // Request push permission & set perm state
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermState(Notification.permission);
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setPermState(p));
    }
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const h = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Update favicon + title whenever unread count changes
  useEffect(() => {
    updateFavicon(unread);
    updateTitle(unread);
  }, [unread]);

  // Fetch all notifications (on panel open)
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setNotifs(Array.isArray(d.notifications) ? d.notifications : []);
      const cnt = d.unread || 0;
      setUnread(cnt);
      prevUnread.current = cnt;
    } catch(e) {}
    setLoading(false);
  }, []);

  // Poll every 5 seconds for new notifications
  const poll = useCallback(async () => {
    try {
      const since = sinceRef.current;
      if (!since) return;

      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since));
      if (!r.ok) return;
      const d = await r.json();

      sinceRef.current = new Date().toISOString();

      const newOnes  = Array.isArray(d.notifications) ? d.notifications : [];
      const newCount = d.unread || 0;

      if (newOnes.length > 0) {
        // Merge into list
        setNotifs(prev => {
          const ids   = new Set(prev.map(n => n.id));
          const fresh = newOnes.filter(n => !ids.has(n.id));
          return fresh.length === 0 ? prev : [...fresh, ...prev].slice(0, 60);
        });
        setUnread(newCount);

        // If genuinely new (count went up) — alert the user
        if (newCount > prevUnread.current) {
          playSound();
          newOnes.forEach(n => sendPush(n.title, n.body, n.id));
        }

        prevUnread.current = newCount;
      } else if (newCount !== prevUnread.current) {
        setUnread(newCount);
        prevUnread.current = newCount;
      }
    } catch(e) {}
  }, []);

  // Start polling when authenticated — every 5 seconds
  useEffect(() => {
    if (status !== 'authenticated') return;
    // Start 30s in the past to catch recent notifications
    sinceRef.current = new Date(Date.now() - 30000).toISOString();
    fetchAll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, fetchAll, poll]);

  // ── Actions ─────────────────────────────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ all:true }) });
      setUnread(0); prevUnread.current = 0;
      setNotifs(prev => prev.map(n => ({ ...n, read:true })));
    } catch(e) {}
  }

  async function markRead(id) {
    try {
      await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }) });
      setNotifs(prev => prev.map(n => n.id===id ? {...n,read:true} : n));
      setUnread(prev => { const v=Math.max(0,prev-1); prevUnread.current=v; return v; });
    } catch(e) {}
  }

  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n=>n.id===id)?.read===false;
      await fetch('/api/notifications?id='+id, { method:'DELETE' });
      setNotifs(prev => prev.filter(n=>n.id!==id));
      if (wasUnread) setUnread(prev => { const v=Math.max(0,prev-1); prevUnread.current=v; return v; });
    } catch(e) {}
  }

  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      await Promise.all(notifs.map(n => fetch('/api/notifications?id='+n.id,{method:'DELETE'})));
      setNotifs([]); setUnread(0); prevUnread.current=0;
    } catch(e) {}
  }

  const isRinging = unread > 0;

  return (
    <div ref={panelRef} style={{ position:'relative', display:'flex', alignItems:'center' }}>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => { if (!o) fetchAll(); return !o; }); }}
        title={`Notifications${unread>0?' ('+unread+' unread)':''}`}
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:10, color: isRinging ? 'var(--yellow)' : 'var(--muted2)', transition:'all .2s', display:'flex', alignItems:'center' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--surface3)'}
        onMouseLeave={e => e.currentTarget.style.background='none'}
      >
        <span style={{ fontSize:'1.3rem', lineHeight:1, display:'inline-block', animation: isRinging ? 'bell-ring 1.5s ease infinite' : 'none' }}>🔔</span>
        {isRinging && (
          <span style={{ position:'absolute', top:0, right:0, background:'var(--red)', color:'#fff', fontSize:'.58rem', fontWeight:900, minWidth:17, height:17, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1, boxShadow:'0 0 0 2px var(--surface)', animation:'pulse 1.5s infinite' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 10px)', right:0, width:340, maxHeight:'min(520px,80dvh)', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,.6)', zIndex:999, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:'.9rem', display:'flex', alignItems:'center', gap:8 }}>
              🔔 Notifications
              {isRinging && <span style={{ background:'var(--red)', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'2px 7px', borderRadius:20 }}>{unread} new</span>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {/* Push permission indicator */}
              {permState === 'denied' && (
                <span title="Browser notifications blocked — enable in browser settings" style={{ fontSize:'.65rem', color:'var(--orange)', cursor:'help' }}>🔕 Blocked</span>
              )}
              {permState === 'default' && (
                <button onClick={() => Notification.requestPermission().then(p=>setPermState(p))} style={{ fontSize:'.65rem', color:'var(--cyan)', background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                  Enable push
                </button>
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
            {loading && <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>⏳ Loading…</div>}
            {!loading && notifs.length === 0 && (
              <div style={{ padding:'36px 20px', textAlign:'center', color:'var(--muted)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:10, opacity:.5 }}>🔕</div>
                <div style={{ fontSize:'.85rem', fontWeight:600, marginBottom:6 }}>No notifications yet</div>
                <div style={{ fontSize:'.75rem', lineHeight:1.6 }}>You'll hear a sound when tasks are assigned, moved, or anything changes in the app</div>
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id} onClick={() => markRead(n.id)}
                style={{ padding:'11px 15px', borderBottom:'1px solid var(--border)', cursor:'pointer', background: n.read ? 'transparent' : 'rgba(124,92,252,.07)', transition:'background .15s', display:'flex', gap:11, alignItems:'flex-start' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background=n.read?'transparent':'rgba(124,92,252,.07)'}>
                <div style={{ width:34, height:34, borderRadius:10, background: n.read ? 'rgba(255,255,255,.05)' : 'rgba(124,92,252,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>
                  {TYPE_EMOJI[n.type] || TYPE_EMOJI.default}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.8rem', fontWeight: n.read ? 500 : 700, color:'var(--text)', marginBottom:3, lineHeight:1.35 }}>{n.title}</div>
                  <div style={{ fontSize:'.73rem', color:'var(--muted2)', lineHeight:1.4, marginBottom:4 }}>{n.body}</div>
                  <div style={{ fontSize:'.64rem', color:'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, flexShrink:0 }}>
                  {!n.read && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--purple)', marginTop:3 }}/>}
                  <button onClick={e=>dismiss(n.id,e)} title="Dismiss" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.75rem', padding:2, lineHeight:1, opacity:.5 }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{ padding:'9px 16px', borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', justifyContent:'center' }}>
              <button onClick={clearAll} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--muted)', fontFamily:'Inter,sans-serif' }}>Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* Bell ring animation */}
      <style>{`
        @keyframes bell-ring {
          0%,100% { transform: rotate(0deg); }
          10%      { transform: rotate(-15deg); }
          20%      { transform: rotate(15deg); }
          30%      { transform: rotate(-10deg); }
          40%      { transform: rotate(10deg); }
          50%      { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
