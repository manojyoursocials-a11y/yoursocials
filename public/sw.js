// Your Socials OS — Service Worker
// Polls for notifications every 10 seconds even when ALL tabs are minimized or hidden

const POLL_INTERVAL = 10000;
let pollTimer = null;
let lastSince  = null;

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// App sends us login signal via postMessage
self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'START') {
    lastSince = e.data.since || new Date(Date.now() - 60000).toISOString();
    startPolling();
  }
  if (e.data.type === 'STOP') stopPolling();
  if (e.data.type === 'UPDATE_SINCE') lastSince = e.data.since;
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, POLL_INTERVAL);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function poll() {
  if (!lastSince) return;
  try {
    const url = '/api/notifications?since=' + encodeURIComponent(lastSince);
    const res  = await fetch(url, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();

    const fresh = Array.isArray(data.notifications) ? data.notifications : [];
    if (fresh.length === 0) return;

    lastSince = new Date().toISOString();

    // Check if any tab is currently focused
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const anyFocused = allClients.some(c => c.focused);

    for (const n of fresh) {
      // Always notify all open tabs (for in-app toast + sound)
      for (const c of allClients) {
        c.postMessage({ type: 'NEW_NOTIF', notification: n, unread: data.unread });
      }

      // Show OS popup when no tab is focused (user is in Adobe / other app)
      if (!anyFocused) {
        await self.registration.showNotification(n.title, {
          body:   n.body,
          icon:   '/favicon-32.png',
          badge:  '/favicon-32.png',
          tag:    n.id,
          silent: false,
          data:   { url: '/' },
        });
      }
    }
  } catch(e) {}
}

// Clicking the OS popup focuses / opens the app
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
