// Your Socials OS — Service Worker
// Handles: PWA install, background notification polling, OS push popups

const CACHE    = 'ys-cache-v1';
const POLL_MS  = 10000;

let pollTimer = null;
let lastSince = null;

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Cache key static assets for PWA offline support
self.addEventListener('fetch', e => {
  // Only cache same-origin GET requests for static assets
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // never cache API calls
  if (url.pathname.startsWith('/_next/')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; })
        )
      )
    );
  }
});

// App sends messages to control SW
self.addEventListener('message', e => {
  if (!e.data) return;
  switch(e.data.type) {
    case 'START':
      lastSince = e.data.since || new Date(Date.now() - 60000).toISOString();
      startPolling();
      break;
    case 'STOP':
      stopPolling();
      break;
    case 'UPDATE_SINCE':
      lastSince = e.data.since;
      break;
  }
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
    const r = await fetch('/api/notifications?since=' + encodeURIComponent(lastSince), {
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!r.ok) return;
    const d = await r.json();
    const fresh = Array.isArray(d.notifications) ? d.notifications : [];
    if (!fresh.length) return;

    lastSince = new Date().toISOString();

    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const anyFocused = allClients.some(c => c.focused);

    for (const n of fresh) {
      // Tell all open app tabs about this notification
      for (const c of allClients) {
        c.postMessage({ type: 'NEW_NOTIF', notification: n, unread: d.unread });
      }
      // Show OS popup ONLY when no tab is focused (user in another app like Adobe)
      if (!anyFocused) {
        await self.registration.showNotification(n.title, {
          body:   n.body,
          icon:   '/favicon-32.png',
          badge:  '/favicon-32.png',
          tag:    n.id,
          silent: false,
          vibrate: [200, 100, 200],
          data:   { url: '/' },
        });
      }
    }
  } catch(e) {}
}

// Clicking the OS popup opens/focuses the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
