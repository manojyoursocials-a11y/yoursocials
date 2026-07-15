import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const EMOJI = {
  task_created:'📋', task_assigned:'👤', task_moved:'⚡',
  task_edited:'✏️',  task_deleted:'🗑',  followup_created:'📩',
  followup_done:'✅', client_created:'🏢', client_updated:'🏢',
  client_deleted:'🏢',
};

// ─── Sound — multiple fallback strategies ──────────────────
// Strategy: keep a pre-loaded Audio element ready, play on demand.
// AudioContext is used as fallback because it handles background tabs better.
let _preloaded = null;
let _ctx = null, _buf = null;

// Call this on first user gesture to unlock audio
function unlockAudio() {
  // Pre-load HTML5 audio element
  if (!_preloaded) {
    _preloaded = new Audio('/notification.mp3');
    _preloaded.preload = 'auto';
    _preloaded.load();
  }
  // Also prime AudioContext
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      fetch('/notification.mp3')
        .then(r => r.arrayBuffer())
        .then(ab => _ctx.decodeAudioData(ab))
        .then(buf => { _buf = buf; })
        .catch(() => {});
    } catch(e) {}
  } else if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
}

function playSound() {
  try {
    const s = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
    if (s.soundEnabled === false) return;
    const vol = Math.min(1, (s.volume || 90) / 100);

    // Try AudioContext first (works in background tabs)
    if (_ctx && _buf && _ctx.state !== 'suspended') {
      const src  = _ctx.createBufferSource();
      const gain = _ctx.createGain();
      src.buffer      = _buf;
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(_ctx.destination);
      src.start(0);
      return;
    }

    // Fallback 1: pre-loaded element
    if (_preloaded) {
      _preloaded.volume = vol;
      _preloaded.currentTime = 0;
      const p = _preloaded.play();
      if (p) { p.catch(() => {}); return; }
    }

    // Fallback 2: fresh Audio element (always works if user has interacted)
    const a = new Audio('/notification.mp3');
    a.volume = vol;
    a.play().catch(() => {});
  } catch(e) {}
}

// ─── OS popup ────────────────────────────────────────────────
function osPopup(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body, icon: '/favicon-32.png', badge: '/favicon-32.png',
      tag: tag || 'ys', silent: false, requireInteraction: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => { try { n.close(); } catch(e) {} }, 6000);
  } catch(e) {}
}

// ─── Favicon badge ───────────────────────────────────────────
let _favLink = null;
function setFavicon(count) {
  if (typeof document === 'undefined') return;
  if (!_favLink) {
    _favLink = document.querySelector("link[rel~='icon']");
    if (!_favLink) { _favLink = document.createElement('link'); _favLink.rel = 'icon'; document.head.appendChild(_favLink); }
  }
  const base = document.title.replace(/^\(\d+\)\s*/, '');
  if (count === 0) { _favLink.href = '/favicon.ico'; document.title = base; return; }
  document.title = `(${count}) ${base}`;
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32);
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath(); ctx.arc(24, 8, 9, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(count > 9 ? '9+' : String(count), 24, 8);
    _favLink.href = canvas.toDataURL('image/png');
  };
  img.src = '/favicon-32.png';
}

function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  return h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago';
}

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifs,  setNotifs]  = useState([]);
  const [unread,  setUnread]  = useState(0);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [perm,    setPerm]    = useState('default');
  const [toasts,  setToasts]  = useState([]);

  const since     = useRef(null);
  const prevCount = useRef(0);
  const panelRef  = useRef(null);

  // ── Handle messages from Service Worker ─────────────────
  function handleSWMessage(event) {
    if (event.data?.type !== 'NEW_NOTIF') return;
    const n     = event.data.notification;
    const count = event.data.unread || 0;

    // Add to list
    setNotifs(prev => {
      const ids = new Set(prev.map(x => x.id));
      return ids.has(n.id) ? prev : [n, ...prev].slice(0, 60);
    });

    // Show in-app toast
    const key = n.id + Date.now();
    setToasts(prev => [...prev.slice(-2), { ...n, _key: key }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t._key !== key)), 5500);

    // Sound + OS popup (if tab is visible)
    if (count > prevCount.current) {
      playSound();
      if (document.visibilityState === 'visible') osPopup(n.title, n.body, n.id);
    }
    setUnread(count);
    prevCount.current = count;
  }

  // ── Init ────────────────────────────────────────────────
  useEffect(() => {
    // Push permission — request immediately
    if ('Notification' in window) {
      setPerm(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => setPerm(p));
      }
    }

    // Load audio on first gesture
    const unlock = () => unlockAudio();
    window.addEventListener('click',      unlock, { once: false, passive: true });
    window.addEventListener('keydown',    unlock, { once: false, passive: true });
    window.addEventListener('touchstart', unlock, { once: false, passive: true });
    unlockAudio(); // try immediately

    // Close panel on outside click
    const outside = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', outside);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW error', e));
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      document.removeEventListener('mousedown', outside);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  // ── Favicon ──────────────────────────────────────────────
  useEffect(() => { setFavicon(unread); }, [unread]);

  // ── Fetch all ────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setNotifs(Array.isArray(d.notifications) ? d.notifications : []);
      const cnt = d.unread || 0;
      setUnread(cnt); prevCount.current = cnt;
    } catch(e) {}
    setLoading(false);
  }

  // ── In-page poll every 4s (while tab is active) ──────────
  async function poll() {
    if (!since.current) return;
    try {
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(since.current));
      if (!r.ok) return;
      const d = await r.json();
      since.current = new Date().toISOString(); // advance pointer

      const fresh = Array.isArray(d.notifications) ? d.notifications : [];
      const count = d.unread || 0;

      if (fresh.length > 0) {
        setNotifs(prev => {
          const ids = new Set(prev.map(n => n.id));
          const add = fresh.filter(n => !ids.has(n.id));
          return add.length ? [...add, ...prev].slice(0, 60) : prev;
        });

        if (count > prevCount.current) {
          playSound();

          // In-app toast for each new notification
          fresh.forEach(n => {
            const key = n.id + Date.now();
            setToasts(prev => [...prev.slice(-2), { ...n, _key: key }]);
            setTimeout(() => setToasts(prev => prev.filter(t => t._key !== key)), 5500);
            // OS popup
            osPopup(n.title, n.body, n.id);
          });
        }
        setUnread(count); prevCount.current = count;

        // Tell SW to advance its pointer too
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_SINCE', since: since.current });
        }
      } else if (count !== prevCount.current) {
        setUnread(count); prevCount.current = count;
      }
    } catch(e) {}
  }

  // ── Start everything when authenticated ──────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Set since 2 minutes back to catch anything recent
    since.current = new Date(Date.now() - 120000).toISOString();

    fetchAll();

    // Start in-page polling
    const timer = setInterval(poll, 4000);

    // Tell Service Worker to start polling too
    const startSW = () => {
      const sw = navigator.serviceWorker?.controller;
      if (sw) {
        sw.postMessage({ type: 'START', since: since.current });
      }
    };
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({ type: 'START', since: since.current });
    });
    startSW();

    return () => clearInterval(timer);
  }, [status]); // eslint-disable-line

  // ── Actions ──────────────────────────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
      setUnread(0); prevCount.current = 0;
      setNotifs(p => p.map(n => ({ ...n, read: true })));
    } catch(e) {}
  }
  async function markOne(id) {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(p => { const v = Math.max(0, p-1); prevCount.current = v; return v; });
    } catch(e) {}
  }
  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n => n.id === id)?.read === false;
      await fetch('/api/notifications?id=' + id, { method: 'DELETE' });
      setNotifs(p => p.filter(n => n.id !== id));
      if (wasUnread) setUnread(p => { const v = Math.max(0, p-1); prevCount.current = v; return v; });
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
      {/* ── In-app toast popups ─────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column-reverse', gap: 10, pointerEvents: 'none', maxWidth: 380 }}>
        {toasts.map(t => (
          <div key={t._key} style={{ background: '#ffffff', color: '#202124', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.22)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'ys-slidein .3s ease', pointerEvents: 'auto' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#FF5FA0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
              {EMOJI[t.type] || '🔔'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.87rem', color: '#202124', marginBottom: 3, fontFamily: 'Arial,sans-serif' }}>{t.title}</div>
              <div style={{ fontSize: '.8rem', color: '#5f6368', lineHeight: 1.45, fontFamily: 'Arial,sans-serif' }}>{t.body}</div>
              <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: 5, fontFamily: 'Arial,sans-serif' }}>yoursocials.vercel.app</div>
            </div>
            <button onClick={() => setToasts(p => p.filter(x => x._key !== t._key))}
              style={{ background: 'none', border: 'none', color: '#9aa0a6', cursor: 'pointer', fontSize: '1rem', padding: 2, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        ))}
      </div>

      {/* ── Bell ──────────────────────────────────────────── */}
      <div ref={panelRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => { setOpen(o => !o); if (!open) fetchAll(); }}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 10, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1, display: 'inline-block', color: ringing ? 'var(--yellow)' : 'var(--muted2)', animation: ringing ? 'ys-bell 2s ease infinite' : 'none' }}>🔔</span>
          {ringing && (
            <span style={{ position: 'absolute', top: 0, right: 0, background: '#FF4D6D', color: '#fff', fontSize: '.58rem', fontWeight: 900, minWidth: 17, height: 17, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1, boxShadow: '0 0 0 2px var(--surface)', animation: 'ys-pulse 1.8s infinite' }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 360, maxHeight: 'min(540px,82dvh)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.65)', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔔 Notifications
                {ringing && <span style={{ background: '#FF4D6D', color: '#fff', fontSize: '.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{unread} new</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {perm === 'default' && (
                  <button onClick={() => Notification.requestPermission().then(p => setPerm(p))}
                    style={{ fontSize: '.68rem', color: '#60A5FA', background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.3)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: 700 }}>
                    Enable popup
                  </button>
                )}
                {perm === 'denied'  && <span style={{ fontSize: '.65rem', color: 'var(--orange)' }}>🔕 Blocked — allow in browser settings</span>}
                {perm === 'granted' && <span style={{ fontSize: '.65rem', color: 'var(--green)' }}>✅ OS popups on</span>}
                {ringing && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.72rem', color: 'var(--purple2)', fontWeight: 600, fontFamily: 'Inter,sans-serif', padding: 0 }}>Mark all read</button>}
                <button onClick={() => setOpen(false)} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem' }}>✕</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>⏳ Loading…</div>}
              {!loading && notifs.length === 0 && (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: .4 }}>🔕</div>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>All caught up!</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted2)', lineHeight: 1.7 }}>When tasks are created, moved or completed, a popup appears here and bottom-right — even when you are in Adobe or another app.</div>
                </div>
              )}
              {notifs.map(n => (
                <div key={n.id} onClick={() => markOne(n.id)}
                  style={{ padding: '11px 15px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(124,92,252,.08)', display: 'flex', gap: 11, alignItems: 'flex-start', transition: 'background .12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(124,92,252,.08)'}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: n.read ? 'rgba(255,255,255,.05)' : 'rgba(124,92,252,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', flexShrink: 0 }}>
                    {EMOJI[n.type] || '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: n.read ? 500 : 700, lineHeight: 1.35, marginBottom: 3 }}>{n.title}</div>
                    <div style={{ fontSize: '.74rem', color: 'var(--muted2)', lineHeight: 1.45, marginBottom: 4 }}>{n.body}</div>
                    <div style={{ fontSize: '.64rem', color: 'var(--muted)' }}>{ago(n.created_at)}</div>
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
                <button onClick={clearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'Inter,sans-serif' }}>Clear all</button>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes ys-bell    { 0%,100%{transform:rotate(0)} 8%{transform:rotate(-20deg)} 16%{transform:rotate(20deg)} 24%{transform:rotate(-13deg)} 32%{transform:rotate(13deg)} 40%{transform:rotate(0)} }
          @keyframes ys-pulse   { 0%,100%{box-shadow:0 0 0 2px var(--surface)} 50%{box-shadow:0 0 0 4px rgba(255,77,109,.4)} }
          @keyframes ys-slidein { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        `}</style>
      </div>
    </>
  );
}
