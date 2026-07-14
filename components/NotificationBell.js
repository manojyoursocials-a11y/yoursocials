import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const EMOJI = {
  task_created:'📋', task_assigned:'👤', task_moved:'⚡',
  task_edited:'✏️', task_deleted:'🗑', followup_created:'📩',
  followup_done:'✅', client_created:'🏢', client_updated:'🏢',
  client_deleted:'🏢',
};

// ── Sound ─────────────────────────────────────────────────────
let audioCtx = null;
let audioBuf = null;

function playSound() {
  try {
    const cfg = JSON.parse(localStorage.getItem('ys_notif_settings') || '{}');
    if (cfg.soundEnabled === false) return;
    const vol = (cfg.volume || 90) / 100;

    if (audioBuf && audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const src  = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      src.buffer      = audioBuf;
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start(0);
      return;
    }
    // Fallback: plain Audio element
    const a = new Audio('/notification.mp3');
    a.volume = vol;
    a.play().catch(() => {});
  } catch(e) {}
}

async function loadAudio() {
  if (audioBuf) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const res = await fetch('/notification.mp3');
    const buf = await res.arrayBuffer();
    audioBuf  = await audioCtx.decodeAudioData(buf);
  } catch(e) {}
}

// ── OS popup ──────────────────────────────────────────────────
function showOSPopup(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body, icon: '/favicon-32.png', tag: tag || 'ys', silent: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  } catch(e) {}
}

// ── Favicon badge ─────────────────────────────────────────────
function setFaviconBadge(count) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (count === 0) {
    link.href = '/favicon.ico';
    document.title = document.title.replace(/^\(\d+\)\s*/, '');
    return;
  }
  // Badge on favicon
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32);
    // Red circle
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath(); ctx.arc(24, 8, 9, 0, 2 * Math.PI); ctx.fill();
    // Count text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(count > 9 ? '9+' : String(count), 24, 8);
    link.href = canvas.toDataURL('image/png');
  };
  img.src = '/favicon-32.png';
  // Tab title
  const base = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = `(${count}) ${base}`;
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

  // Use a ref for since so poll always reads the latest value
  const since     = useRef(null);
  const prevCount = useRef(0);
  const panelRef  = useRef(null);

  // ── Init on mount ─────────────────────────────────────────
  useEffect(() => {
    // Push permission
    if ('Notification' in window) {
      setPerm(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => setPerm(p));
      }
    }
    // Load audio buffer on first gesture
    const loadOnGesture = () => loadAudio();
    ['click','keydown','touchstart'].forEach(e =>
      window.addEventListener(e, loadOnGesture, { once: true, passive: true })
    );
    // Try loading immediately
    loadAudio();

    // Close on outside click
    const handleOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Favicon updates ───────────────────────────────────────
  useEffect(() => { setFaviconBadge(unread); }, [unread]);

  // ── Add a toast ───────────────────────────────────────────
  function addToast(n) {
    const key = n.id + Date.now();
    setToasts(prev => [...prev.slice(-2), { ...n, _key: key }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t._key !== key)), 5000);
  }

  // ── Fetch ALL notifications (on open or first load) ───────
  async function fetchAll() {
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
  }

  // ── Poll for new notifications ────────────────────────────
  async function checkNew() {
    if (!since.current) return;
    try {
      const url = '/api/notifications?since=' + encodeURIComponent(since.current);
      const r   = await fetch(url);
      if (!r.ok) return;
      const d = await r.json();

      // Advance the since pointer BEFORE processing
      since.current = new Date().toISOString();

      const fresh    = Array.isArray(d.notifications) ? d.notifications : [];
      const newCount = typeof d.unread === 'number' ? d.unread : 0;

      if (fresh.length > 0) {
        // Merge new notifications at top of list
        setNotifs(prev => {
          const existing = new Set(prev.map(n => n.id));
          const toAdd    = fresh.filter(n => !existing.has(n.id));
          return toAdd.length > 0 ? [...toAdd, ...prev].slice(0, 60) : prev;
        });

        // Alert user only if count genuinely increased
        if (newCount > prevCount.current) {
          playSound();
          fresh.forEach(n => {
            addToast(n);
            showOSPopup(n.title, n.body, n.id);
          });
        }
        setUnread(newCount);
        prevCount.current = newCount;
      } else {
        // Even if no new notifs, update unread count if it changed
        if (newCount !== prevCount.current) {
          setUnread(newCount);
          prevCount.current = newCount;
        }
      }
    } catch(e) {}
  }

  // ── Start polling when authenticated ──────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Set since to 2 minutes ago on first start to catch anything recent
    since.current = new Date(Date.now() - 120000).toISOString();

    // Load all existing notifs
    fetchAll();

    // Poll every 4 seconds
    const timer = setInterval(checkNew, 4000);
    return () => clearInterval(timer);
  }, [status]); // eslint-disable-line

  // ── Mark all read ─────────────────────────────────────────
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

  // ── Mark one read ─────────────────────────────────────────
  async function markOne(id) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(p => Math.max(0, p - 1));
      prevCount.current = Math.max(0, prevCount.current - 1);
    } catch(e) {}
  }

  // ── Dismiss one ───────────────────────────────────────────
  async function dismiss(id, e) {
    e.stopPropagation();
    try {
      const wasUnread = notifs.find(n => n.id === id)?.read === false;
      await fetch('/api/notifications?id=' + id, { method: 'DELETE' });
      setNotifs(p => p.filter(n => n.id !== id));
      if (wasUnread) {
        setUnread(p => Math.max(0, p - 1));
        prevCount.current = Math.max(0, prevCount.current - 1);
      }
    } catch(e) {}
  }

  // ── Clear all ─────────────────────────────────────────────
  async function clearAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      await Promise.all(notifs.map(n =>
        fetch('/api/notifications?id=' + n.id, { method: 'DELETE' })
      ));
      setNotifs([]); setUnread(0); prevCount.current = 0;
    } catch(e) {}
  }

  const ringing = unread > 0;

  return (
    <>
      {/* ── In-app toast popups (bottom-right, like Google Chat) ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 999999,
        display: 'flex', flexDirection: 'column-reverse', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t._key} style={{
            background: '#fff', color: '#202124', borderRadius: 10,
            boxShadow: '0 4px 28px rgba(0,0,0,.25)', padding: '14px 16px',
            minWidth: 300, maxWidth: 380, display: 'flex', gap: 12,
            alignItems: 'flex-start', animation: 'ys-slidein .3s ease',
            pointerEvents: 'auto', cursor: 'default',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg,#7C5CFC,#FF5FA0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', flexShrink: 0,
            }}>
              {EMOJI[t.type] || '🔔'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.87rem', marginBottom: 4, fontFamily: 'Arial,sans-serif', color: '#202124' }}>
                {t.title}
              </div>
              <div style={{ fontSize: '.8rem', color: '#5f6368', lineHeight: 1.45, fontFamily: 'Arial,sans-serif' }}>
                {t.body}
              </div>
              <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: 6, fontFamily: 'Arial,sans-serif' }}>
                yoursocials.vercel.app
              </div>
            </div>
            <button
              onClick={() => setToasts(p => p.filter(x => x._key !== t._key))}
              style={{ background: 'none', border: 'none', color: '#9aa0a6', cursor: 'pointer', fontSize: '1rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
            >✕</button>
          </div>
        ))}
      </div>

      {/* ── Bell + dropdown ── */}
      <div ref={panelRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => { setOpen(o => !o); if (!open) fetchAll(); }}
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 10, display: 'flex', alignItems: 'center' }}
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
              background: '#FF4D6D', color: '#fff', fontSize: '.58rem',
              fontWeight: 900, minWidth: 17, height: 17, borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', lineHeight: 1,
              boxShadow: '0 0 0 2px var(--surface)',
              animation: 'ys-pulse 1.8s infinite',
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 360, maxHeight: 'min(540px,82dvh)',
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.65)',
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
                  <button onClick={() => Notification.requestPermission().then(p => setPerm(p))}
                    style={{ fontSize: '.68rem', color: '#60A5FA', background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.3)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: 700 }}>
                    Enable popup
                  </button>
                )}
                {perm === 'denied'  && <span style={{ fontSize: '.65rem', color: 'var(--orange)' }}>🔕 Blocked</span>}
                {perm === 'granted' && <span style={{ fontSize: '.65rem', color: 'var(--green)' }}>✅ Popups on</span>}
                {ringing && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.72rem', color: 'var(--purple2)', fontWeight: 600, fontFamily: 'Inter,sans-serif', padding: 0 }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem' }}>✕</button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: '.82rem' }}>⏳ Loading…</div>}
              {!loading && notifs.length === 0 && (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: .4 }}>🔕</div>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>All caught up!</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted2)', lineHeight: 1.7 }}>
                    When tasks are created, moved or completed — everyone sees a popup here and in the bottom-right corner.
                  </div>
                </div>
              )}
              {notifs.map(n => (
                <div key={n.id}
                  onClick={() => markOne(n.id)}
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
          @keyframes ys-bell  { 0%,100%{transform:rotate(0)} 8%{transform:rotate(-20deg)} 16%{transform:rotate(20deg)} 24%{transform:rotate(-13deg)} 32%{transform:rotate(13deg)} 40%{transform:rotate(0)} }
          @keyframes ys-pulse { 0%,100%{box-shadow:0 0 0 2px var(--surface)} 50%{box-shadow:0 0 0 4px rgba(255,77,109,.4)} }
          @keyframes ys-slidein { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
        `}</style>
      </div>
    </>
  );
}
