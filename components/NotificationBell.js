import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const TYPE_EMOJI = {
  task_created:   '📋',
  task_assigned:  '👤',
  task_moved:     '⚡',
  task_edited:    '✏️',
  task_deleted:   '🗑',
  followup_created:'📩',
  followup_done:  '✅',
  client_created: '🏢',
  client_updated: '🏢',
  client_deleted: '🏢',
  default:        '🔔',
};

// Audio context singleton — only created after user interaction
let _audio = null;
let _userInteracted = false;

// Track user interaction to unlock audio
if (typeof window !== 'undefined') {
  const unlock = () => { _userInteracted = true; };
  window.addEventListener('click', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
}

async function playSound() {
  try {
    if (!_userInteracted) return; // can't play before interaction
    if (!_audio) {
      _audio = new Audio('/notification.mp3');
      _audio.volume = 0.85;
      _audio.preload = 'auto';
    }
    _audio.currentTime = 0;
    await _audio.play();
  } catch (e) {
    // Reset on error so next attempt creates fresh instance
    _audio = null;
  }
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

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifs,   setNotifs]   = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);

  // Use a timestamp 30 seconds in the past on first load
  // so we catch any notifications created very recently
  const sinceRef  = useRef(null);
  const panelRef  = useRef(null);
  const pollRef   = useRef(null);
  const prevUnread = useRef(0);

  // Ask for browser notification permission once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch ALL notifications (called on panel open and on first load)
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setNotifs(Array.isArray(d.notifications) ? d.notifications : []);
      setUnread(d.unread || 0);
      prevUnread.current = d.unread || 0;
    } catch (e) {}
    setLoading(false);
  }, []);

  // Poll every 6 seconds for NEW notifications
  const poll = useCallback(async () => {
    try {
      const since = sinceRef.current;
      if (!since) return; // not ready yet
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since));
      if (!r.ok) return;
      const d = await r.json();

      // Update sinceRef to now
      sinceRef.current = new Date().toISOString();

      const newOnes = Array.isArray(d.notifications) ? d.notifications : [];
      const newUnread = d.unread || 0;

      // There are NEW notifications since last poll
      if (newOnes.length > 0) {
        // Add them to the top of the list
        setNotifs(prev => {
          const existing = new Set(prev.map(n => n.id));
          const fresh = newOnes.filter(n => !existing.has(n.id));
          if (fresh.length === 0) return prev;
          return [...fresh, ...prev].slice(0, 50);
        });
        setUnread(newUnread);

        // Play sound only if unread count increased
        if (newUnread > prevUnread.current) {
          playSound();

          // Browser OS-level push notification
          newOnes.forEach(n => {
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(n.title, {
                  body:  n.body,
                  icon:  '/favicon-32.png',
                  tag:   n.id,
                  requireInteraction: false,
                });
              }
            } catch (e) {}
          });
        }

        prevUnread.current = newUnread;
      } else if (newUnread !== prevUnread.current) {
        // Unread count changed (e.g. marked read on another tab)
        setUnread(newUnread);
        prevUnread.current = newUnread;
      }
    } catch (e) {}
  }, []);

  // Start polling when authenticated
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Set sinceRef to 30 seconds ago so we catch very recent notifications
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    sinceRef.current = thirtySecondsAgo;

    // Load all existing notifications first
    fetchAll();

    // Then poll for new ones every 6 seconds
    pollRef.current = setInterval(poll, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, fetchAll, poll]);

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setUnread(0);
      prevUnread.current = 0;
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch(e) {}
  }

  async function markRead(id) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
      prevUnread.current = Math.max(0, prevUnread.current - 1);
    } catch(e) {}
  }

  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n => n.id === id)?.read === false;
      await fetch('/api/notifications?id=' + id, { method: 'DELETE' });
      setNotifs(prev => prev.filter(n => n.id !== id));
      if (wasUnread) {
        setUnread(prev => Math.max(0, prev - 1));
        prevUnread.current = Math.max(0, prevUnread.current - 1);
      }
    } catch(e) {}
  }

  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      // Delete all one by one
      for (const n of notifs) {
        await fetch('/api/notifications?id=' + n.id, { method: 'DELETE' });
      }
      setNotifs([]);
      setUnread(0);
      prevUnread.current = 0;
    } catch(e) {}
  }

  return (
    <div ref={panelRef} style={{ position:'relative', display:'flex', alignItems:'center' }}>

      {/* 🔔 Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchAll(); }}
        title="Notifications"
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:10, color: unread > 0 ? 'var(--yellow)' : 'var(--muted2)', transition:'color .15s', display:'flex', alignItems:'center' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--surface3)'}
        onMouseLeave={e => e.currentTarget.style.background='none'}
      >
        <span style={{ fontSize:'1.3rem', lineHeight:1 }}>🔔</span>
        {unread > 0 && (
          <span style={{ position:'absolute', top:0, right:0, background:'var(--red)', color:'#fff', fontSize:'.58rem', fontWeight:900, minWidth:17, height:17, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1, boxShadow:'0 0 0 2px var(--surface)', animation:'pulse 2s infinite' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 10px)', right:0, width:340, maxHeight:'min(480px, 80dvh)', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:16, boxShadow:'0 16px 60px rgba(0,0,0,.5)', zIndex:999, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:'.9rem', display:'flex', alignItems:'center', gap:8 }}>
              🔔 Notifications
              {unread > 0 && (
                <span style={{ background:'var(--red)', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'2px 7px', borderRadius:20 }}>{unread} new</span>
              )}
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--purple2)', fontWeight:600, fontFamily:'Inter,sans-serif', padding:0 }}>
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:6, width:26, height:26, cursor:'pointer', color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.8rem' }}>✕</button>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {loading && (
              <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>
                <div style={{ marginBottom:8 }}>⏳</div>Loading…
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div style={{ padding:'36px 20px', textAlign:'center', color:'var(--muted)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:10, opacity:.6 }}>🔕</div>
                <div style={{ fontSize:'.85rem', fontWeight:600, marginBottom:5 }}>No notifications yet</div>
                <div style={{ fontSize:'.75rem', lineHeight:1.5 }}>You'll hear a sound and see a badge when tasks are assigned or moved to the next stage</div>
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id}
                onClick={() => { markRead(n.id); }}
                style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', background: n.read ? 'transparent' : 'rgba(124,92,252,.07)', transition:'background .15s', display:'flex', gap:11, alignItems:'flex-start' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(124,92,252,.07)'}
              >
                {/* Type icon */}
                <div style={{ width:36, height:36, borderRadius:10, background: n.read ? 'rgba(255,255,255,.05)' : 'rgba(124,92,252,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>
                  {TYPE_EMOJI[n.type] || TYPE_EMOJI.default}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.8rem', fontWeight: n.read ? 500 : 700, color:'var(--text)', marginBottom:3, lineHeight:1.35 }}>{n.title}</div>
                  <div style={{ fontSize:'.73rem', color:'var(--muted2)', lineHeight:1.45, marginBottom:4 }}>{n.body}</div>
                  <div style={{ fontSize:'.66rem', color:'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, flexShrink:0 }}>
                  {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--purple)', marginTop:2 }}/>}
                  <button
                    onClick={e => dismiss(n.id, e)}
                    title="Dismiss"
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.78rem', padding:2, lineHeight:1, opacity:.55 }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{ padding:'9px 16px', borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', justifyContent:'center' }}>
              <button onClick={clearAll} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--muted)', fontFamily:'Inter,sans-serif' }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
