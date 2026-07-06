import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

const TYPE_EMOJI = {
  task_assigned: '📋',
  task_moved:    '⚡',
  default:       '🔔',
};

// Notification sound using Web Audio API
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Two-tone chime
    [[880, 0], [1100, 0.12], [1320, 0.25]].forEach(([freq, delay]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.4);
    });
  } catch(e) {}
}

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifs,   setNotifs]   = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const sinceRef   = useRef(new Date().toISOString());
  const panelRef   = useRef(null);
  const pollRef    = useRef(null);
  const permRef    = useRef(false);

  // Request browser push permission once
  useEffect(() => {
    if (!permRef.current && 'Notification' in window && Notification.permission === 'default') {
      permRef.current = true;
      Notification.requestPermission();
    }
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch all notifications (on open)
  async function fetchAll() {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      const d = await r.json();
      setNotifs(d.notifications || []);
      setUnread(d.unread || 0);
    } catch(e) {}
    setLoading(false);
  }

  // Poll for NEW notifications every 8 seconds
  const poll = useCallback(async () => {
    try {
      const since = sinceRef.current;
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since));
      const d = await r.json();
      sinceRef.current = new Date().toISOString();
      const newOnes = d.notifications || [];
      if (newOnes.length > 0) {
        setUnread(d.unread || 0);
        setNotifs(prev => {
          const ids = new Set(prev.map(n => n.id));
          return [...newOnes.filter(n => !ids.has(n.id)), ...prev].slice(0, 50);
        });
        // Play sound for each new notification
        playNotifSound();
        // Browser push notification
        newOnes.forEach(n => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(n.title, {
              body: n.body,
              icon: '/logo.png',
              badge: '/logo.png',
              tag: n.id,
            });
          }
        });
      } else {
        setUnread(d.unread || 0);
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    poll(); // immediate first poll
    pollRef.current = setInterval(poll, 8000);
    return () => clearInterval(pollRef.current);
  }, [status, poll]);

  async function markAllRead() {
    await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ all:true }) });
    setUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, read:true })));
  }

  async function markRead(id) {
    await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }) });
    setNotifs(prev => prev.map(n => n.id===id ? {...n,read:true} : n));
    setUnread(prev => Math.max(0, prev-1));
  }

  async function deleteNotif(id, e) {
    e.stopPropagation();
    await fetch('/api/notifications?id='+id, { method:'DELETE' });
    setNotifs(prev => prev.filter(n => n.id!==id));
  }

  function handleOpen() {
    setOpen(o => {
      if (!o) fetchAll();
      return !o;
    });
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  return (
    <div ref={panelRef} style={{ position:'relative' }}>
      {/* Bell button */}
      <button onClick={handleOpen}
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:10, color: unread > 0 ? 'var(--yellow)' : 'var(--muted2)', transition:'all .15s', display:'flex', alignItems:'center' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--surface3)'}
        onMouseLeave={e => e.currentTarget.style.background='none'}
        title="Notifications">
        <span style={{ fontSize:'1.25rem', lineHeight:1 }}>🔔</span>
        {unread > 0 && (
          <span style={{ position:'absolute', top:2, right:2, background:'var(--red)', color:'#fff', fontSize:'.58rem', fontWeight:800, minWidth:16, height:16, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1 }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:340, maxHeight:480, background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:16, boxShadow:'var(--shadow-lg)', zIndex:500, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Header */}
          <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:'.9rem' }}>Notifications {unread > 0 && <span style={{ background:'var(--red)', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'1px 6px', borderRadius:20, marginLeft:6 }}>{unread}</span>}</div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--purple2)', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {loading && <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>Loading…</div>}
            {!loading && notifs.length === 0 && (
              <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--muted)' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>🔕</div>
                <div style={{ fontSize:'.82rem' }}>No notifications yet</div>
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id} onClick={() => { markRead(n.id); setOpen(false); }}
                style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', background: n.read ? 'transparent' : 'rgba(124,92,252,.06)', transition:'background .15s', display:'flex', gap:12, alignItems:'flex-start' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background=n.read?'transparent':'rgba(124,92,252,.06)'}>
                {/* Icon */}
                <div style={{ width:34, height:34, borderRadius:10, background: n.read ? 'var(--surface3)' : 'rgba(124,92,252,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>
                  {TYPE_EMOJI[n.type] || TYPE_EMOJI.default}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.8rem', fontWeight: n.read ? 500 : 700, color:'var(--text)', marginBottom:3, lineHeight:1.3 }}>{n.title}</div>
                  <div style={{ fontSize:'.73rem', color:'var(--muted2)', lineHeight:1.4 }}>{n.body}</div>
                  <div style={{ fontSize:'.67rem', color:'var(--muted)', marginTop:4 }}>{timeAgo(n.created_at)}</div>
                </div>
                {/* Unread dot + delete */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                  {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--purple)' }}/>}
                  <button onClick={e => deleteNotif(n.id, e)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.75rem', padding:2, lineHeight:1 }}
                    title="Dismiss">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
