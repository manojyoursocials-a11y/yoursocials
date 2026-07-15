import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const ICONS = {
  task_created:'📋', task_assigned:'👤', task_moved:'⚡',
  task_edited:'✏️', task_deleted:'🗑', followup_created:'📩',
  followup_done:'✅', client_created:'🏢', client_updated:'🏢', client_deleted:'🏢',
};

// ── Sound ─────────────────────────────────────────────────────
// Simple approach: always create a new Audio and play it.
// Browsers allow this once user has interacted with the page.
function playNotifSound() {
  try {
    const cfg = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
    if (cfg.soundEnabled === false) return;
    const vol = (cfg.volume ?? 90) / 100;
    const audio = new Audio('/notification.mp3');
    audio.volume = Math.min(1, vol);
    audio.play().catch(() => {
      // If autoplay blocked, try via user gesture simulation
      document.addEventListener('click', function once() {
        document.removeEventListener('click', once);
        const a2 = new Audio('/notification.mp3');
        a2.volume = Math.min(1, vol);
        a2.play().catch(() => {});
      }, { once: true });
    });
  } catch(e) {}
}

// ── OS Desktop notification popup ────────────────────────────
function sendOSNotif(title, body, tag) {
  if (typeof window === 'undefined') return;
  const cfg = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
  if (cfg.pushEnabled === false) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon:  '/favicon-32.png',
      badge: '/favicon-32.png',
      tag:   tag || 'ys-notif',
      requireInteraction: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 7000);
  } catch(e) {}
}

// ── Favicon red badge ─────────────────────────────────────────
function setFaviconBadge(count) {
  if (typeof document === 'undefined') return;
  // Update tab title
  const rawTitle = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = count > 0 ? `(${count}) ${rawTitle}` : rawTitle;

  // Update favicon
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (count === 0) { link.href = '/favicon.ico'; return; }

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 32, 32);
    // Red circle
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath(); ctx.arc(24, 8, 9, 0, 2 * Math.PI); ctx.fill();
    // Count text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(count > 9 ? '9+' : String(count), 24, 8);
    link.href = canvas.toDataURL('image/png');
  };
  img.src = '/favicon-32.png';
}

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.floor(m / 60) + 'h ago';
  return Math.floor(m / 1440) + 'd ago';
}

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifs,  setNotifs]  = useState([]);
  const [unread,  setUnread]  = useState(0);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [perm,    setPerm]    = useState('default');
  const [toasts,  setToasts]  = useState([]); // in-app popup queue

  const sinceRef  = useRef(null);
  const prevCount = useRef(0);
  const panelRef  = useRef(null);
  const timerRef  = useRef(null);
  const swRef     = useRef(null);

  // ── ONE-TIME INIT ─────────────────────────────────────────
  useEffect(() => {
    // 1. Request OS notification permission immediately
    if ('Notification' in window) {
      setPerm(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => setPerm(p));
      }
    }

    // 2. Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => { swRef.current = reg; })
        .catch(e => {});

      // Listen for messages from SW (notifications found while tab inactive)
      navigator.serviceWorker.addEventListener('message', onSWMessage);
    }

    // 3. Close dropdown on outside click
    const handleOutside = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      navigator.serviceWorker?.removeEventListener('message', onSWMessage);
    };
  }, []);

  // ── ON SW MESSAGE ─────────────────────────────────────────
  function onSWMessage(e) {
    if (e.data?.type !== 'NEW_NOTIF') return;
    const n     = e.data.notification;
    const count = e.data.unread || 0;
    mergeNotification(n, count);
  }

  // ── FAVICON SYNC ─────────────────────────────────────────
  useEffect(() => { setFaviconBadge(unread); }, [unread]);

  // ── MERGE ONE NEW NOTIFICATION ────────────────────────────
  function mergeNotification(n, count) {
    setNotifs(prev => {
      const ids = new Set(prev.map(x => x.id));
      return ids.has(n.id) ? prev : [n, ...prev].slice(0, 60);
    });

    if (count > prevCount.current) {
      // 1. Sound
      playNotifSound();
      // 2. In-app toast popup
      showToast(n);
      // 3. OS popup (if tab not focused OR permission granted)
      sendOSNotif(n.title, n.body, n.id);
    }

    setUnread(count);
    prevCount.current = count;
  }

  // ── IN-APP TOAST ──────────────────────────────────────────
  function showToast(n) {
    const key = n.id + '_' + Date.now();
    setToasts(prev => [...prev.slice(-2), { ...n, _key: key }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t._key !== key)), 6000);
  }

  // ── FETCH ALL NOTIFICATIONS ───────────────────────────────
  async function fetchAll() {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      const notifList = Array.isArray(d.notifications) ? d.notifications : [];
      setNotifs(notifList);
      const cnt = d.unread || 0;
      setUnread(cnt);
      prevCount.current = cnt;
    } catch(e) {}
    setLoading(false);
  }

  // ── POLL EVERY 4 SECONDS ─────────────────────────────────
  async function pollOnce() {
    if (!sinceRef.current) return;
    try {
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(sinceRef.current));
      if (!r.ok) return;
      const d = await r.json();

      // Advance since pointer
      sinceRef.current = new Date().toISOString();

      const fresh = Array.isArray(d.notifications) ? d.notifications : [];
      const count = typeof d.unread === 'number' ? d.unread : 0;

      if (fresh.length > 0) {
        // ALWAYS play sound + show toasts when there are NEW notifications
        // (regardless of prevCount — the since pointer guarantees these are new)
        playNotifSound();
        fresh.forEach(n => {
          showToast(n);
          sendOSNotif(n.title, n.body, n.id);
        });

        // Add to notification list
        setNotifs(prev => {
          const ids = new Set(prev.map(n => n.id));
          const add = fresh.filter(n => !ids.has(n.id));
          return add.length ? [...add, ...prev].slice(0, 60) : prev;
        });
        setUnread(count);
        prevCount.current = count;

        // Sync SW pointer
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_SINCE', since: sinceRef.current });
        }
      } else if (count !== prevCount.current) {
        setUnread(count);
        prevCount.current = count;
      }
    } catch(e) {}
  }

  // ── START POLLING WHEN LOGGED IN ──────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Go back 5 minutes to catch anything recent
    sinceRef.current = new Date(Date.now() - 300000).toISOString();

    // Load all existing notifications
    fetchAll();

    // Start polling every 4 seconds
    timerRef.current = setInterval(pollOnce, 4000);

    // Tell service worker to start polling too
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({ type: 'START', since: sinceRef.current });
    });

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]); // eslint-disable-line

  // ── MARK ALL READ ─────────────────────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setUnread(0); prevCount.current = 0;
      setNotifs(p => p.map(n => ({ ...n, read: true })));
    } catch(e) {}
  }

  async function markOne(id) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(p => { const v = Math.max(0, p - 1); prevCount.current = v; return v; });
    } catch(e) {}
  }

  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n => n.id === id)?.read === false;
      await fetch('/api/notifications?id=' + id, { method: 'DELETE' });
      setNotifs(p => p.filter(n => n.id !== id));
      if (wasUnread) setUnread(p => { const v = Math.max(0, p - 1); prevCount.current = v; return v; });
    } catch(e) {}
  }

  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      await Promise.all(notifs.map(n => fetch('/api/notifications?id=' + n.id, { method: 'DELETE' })));
      setNotifs([]); setUnread(0); prevCount.current = 0;
    } catch(e) {}
  }

  const ringing = unread > 0;

  return (
    <>
      {/* ── TOAST POPUPS ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 2147483647,
        display: 'flex', flexDirection: 'column-reverse', gap: 10,
        maxWidth: 380, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t._key} style={{
            background: '#ffffff', borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.06)',
            padding: '14px 16px', display: 'flex', gap: 12,
            alignItems: 'flex-start', pointerEvents: 'auto',
            animation: 'ys-in .25s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#7C5CFC,#FF5FA0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.15rem',
            }}>
              {ICONS[t.type] || '🔔'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.87rem', color: '#111', marginBottom: 3, lineHeight: 1.3 }}>
                {t.title}
              </div>
              <div style={{ fontSize: '.8rem', color: '#555', lineHeight: 1.45 }}>
                {t.body}
              </div>
              <div style={{ fontSize: '.7rem', color: '#999', marginTop: 5 }}>
                yoursocials.vercel.app
              </div>
            </div>
            <button
              onClick={() => setToasts(p => p.filter(x => x._key !== t._key))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
            >✕</button>
          </div>
        ))}
      </div>

      {/* ── BELL ── */}
      <div ref={panelRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => { setOpen(o => !o); if (!open) fetchAll(); }}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 10, display: 'flex', alignItems: 'center', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{
            fontSize: '1.3rem', lineHeight: 1, display: 'inline-block',
            color: ringing ? 'var(--yellow)' : 'var(--muted2)',
            animation: ringing ? 'ys-bell 2s ease infinite' : 'none',
          }}>🔔</span>
          {ringing && (
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

        {/* ── DROPDOWN ── */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 360, maxHeight: 'min(540px, 82dvh)',
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,.6)',
            zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔔 Notifications
                {ringing && <span style={{ background: '#FF4D6D', color: '#fff', fontSize: '.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{unread} new</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {perm === 'default' && (
                  <button
                    onClick={() => Notification.requestPermission().then(p => setPerm(p))}
                    style={{ fontSize: '.68rem', color: '#60A5FA', background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.3)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                    Allow popups
                  </button>
                )}
                {perm === 'denied'  && <span style={{ fontSize: '.65rem', color: 'var(--orange)' }}>🔕 Blocked</span>}
                {perm === 'granted' && <span style={{ fontSize: '.65rem', color: 'var(--green)' }}>✅ Popups on</span>}
                {ringing && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.72rem', color: 'var(--purple2)', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem' }}>✕</button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>⏳ Loading…</div>
              )}
              {!loading && notifs.length === 0 && (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: .4 }}>🔕</div>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>All caught up!</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted2)', lineHeight: 1.7 }}>
                    Actions like creating tasks, moving them, or completing follow-ups will notify all team members here with a popup + sound.
                  </div>
                </div>
              )}
              {notifs.map(n => (
                <div key={n.id}
                  onClick={() => markOne(n.id)}
                  style={{
                    padding: '11px 15px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: n.read ? 'transparent' : 'rgba(124,92,252,.08)',
                    display: 'flex', gap: 11, alignItems: 'flex-start',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(124,92,252,.08)'}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', background: n.read ? 'rgba(255,255,255,.05)' : 'rgba(124,92,252,.18)' }}>
                    {ICONS[n.type] || '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: n.read ? 500 : 700, lineHeight: 1.35, marginBottom: 3 }}>{n.title}</div>
                    <div style={{ fontSize: '.74rem', color: 'var(--muted2)', lineHeight: 1.45, marginBottom: 4 }}>{n.body}</div>
                    <div style={{ fontSize: '.64rem', color: 'var(--muted)' }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)', marginTop: 3 }}/>}
                    <button onClick={e => dismiss(n.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '.8rem', padding: 2, opacity: .55 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {notifs.length > 0 && (
              <div style={{ padding: '9px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <button onClick={clearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'inherit' }}>Clear all</button>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes ys-bell  { 0%,100%{transform:rotate(0)} 8%{transform:rotate(-20deg)} 16%{transform:rotate(20deg)} 24%{transform:rotate(-13deg)} 32%{transform:rotate(13deg)} 40%{transform:rotate(0)} }
          @keyframes ys-pulse { 0%,100%{box-shadow:0 0 0 2px var(--surface)} 50%{box-shadow:0 0 0 4px rgba(255,77,109,.4)} }
          @keyframes ys-in    { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        `}</style>
      </div>
    </>
  );
}
