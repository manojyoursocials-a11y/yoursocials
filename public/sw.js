// Your Socials OS — Service Worker v3
// Handles: Web Push notifications + background polling

const VAPID_PUBLIC = 'BJksSkC9PcN_58qBiwEjZc460b6BR2L3fKpEmCW5S0W9qW7cFrfomcg74GIRZi79fHZfuDt_NXZfp0sEiq4m6ds';
const POLL_MS      = 10000;

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// ── Web Push received (works even when browser closed on mobile) ──
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 Your Socials', {
      body:    data.body   || '',
      icon:    data.icon   || '/favicon-32.png',
      badge:   data.badge  || '/favicon-32.png',
      tag:     data.tag    || 'ys-push',
      silent:  false,
      vibrate: [200, 100, 200],
      data:    { url: '/' },
    })
  );
});

// ── Notification click ──────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// ── Background polling (fallback when Web Push isn't available) ──
let pollTimer = null;
let lastSince = null;

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'START') { lastSince = e.data.since; startPolling(); }
  if (e.data.type === 'STOP')  { stopPolling(); }
  if (e.data.type === 'UPDATE_SINCE') lastSince = e.data.since;
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, POLL_MS);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function poll() {
  if (!lastSince) return;
  try {
    const r = await fetch('/api/notifications?since=' + encodeURIComponent(lastSince), { credentials:'include' });
    if (!r.ok) return;
    const d     = await r.json();
    const fresh = Array.isArray(d.notifications) ? d.notifications : [];
    if (!fresh.length) return;

    lastSince = new Date().toISOString();
    const allClients = await clients.matchAll({ type:'window', includeUncontrolled:true });
    const anyFocused = allClients.some(c => c.focused);

    for (const n of fresh) {
      // Tell all open tabs
      allClients.forEach(c => c.postMessage({ type:'NEW_NOTIF', notification:n, unread:d.unread }));
      // OS popup when no tab is focused
      if (!anyFocused) {
        await self.registration.showNotification(n.title, {
          body:    n.body,
          icon:    '/favicon-32.png',
          badge:   '/favicon-32.png',
          tag:     n.id,
          silent:  false,
          vibrate: [200, 100, 200],
          data:    { url:'/' },
        });
      }
    }
  } catch(e) {}
}
