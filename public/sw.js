// Your Socials OS — Service Worker for push notifications
// Handles background push delivery even when app tab is not active

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Handle push events from server (future: Web Push API)
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'Your Socials', {
      body:  data.body  || '',
      icon:  '/favicon-32.png',
      badge: '/favicon-32.png',
      tag:   data.tag   || 'ys-notif',
      data:  { url: '/' },
      requireInteraction: false,
    })
  );
});

// Clicking the notification focuses/opens the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// ── Polling via Service Worker (key feature) ──────────────────
// Even when all app tabs are in background, this worker checks for
// new notifications every 15 seconds and shows them via showNotification

let pollInterval = null;
let authToken    = null; // stored by app when user logs in
let lastSince    = null;
let userEmail    = null;

// App sends us the session cookie / credentials via postMessage
self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SET_SESSION') {
    userEmail = e.data.email;
    lastSince = e.data.since || new Date(Date.now() - 30000).toISOString();
    startPolling();
  }
  if (e.data.type === 'STOP_POLLING') {
    stopPolling();
  }
  if (e.data.type === 'PLAY_SOUND') {
    // App asks SW to trigger sound via notification
    self.registration.showNotification(e.data.title, {
      body:  e.data.body,
      icon:  '/favicon-32.png',
      badge: '/favicon-32.png',
      tag:   e.data.tag || 'ys-sound',
      silent: false,
    });
  }
});

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(checkNotifications, 15000);
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
}

async function checkNotifications() {
  if (!lastSince) return;
  try {
    const url = '/api/notifications?since=' + encodeURIComponent(lastSince);
    const r   = await fetch(url, { credentials: 'include' });
    if (!r.ok) return;
    const d = await r.json();
    lastSince = new Date().toISOString();
    const newOnes = Array.isArray(d.notifications) ? d.notifications : [];
    if (!newOnes.length) return;

    // Check if any app window is focused
    const allClients = await clients.matchAll({ type:'window', includeUncontrolled:true });
    const anyFocused = allClients.some(c => c.focused);

    // Show OS notification for each new one
    for (const n of newOnes) {
      if (!anyFocused) {
        // Tab not focused — show OS push popup
        await self.registration.showNotification(n.title, {
          body:    n.body,
          icon:    '/favicon-32.png',
          badge:   '/favicon-32.png',
          tag:     n.id,
          silent:  false,
          data:    { url: '/', notifId: n.id },
        });
      }
      // Always tell open windows to play sound + update badge
      for (const c of allClients) {
        c.postMessage({ type:'NEW_NOTIFICATION', notification: n, unread: d.unread });
      }
    }
  } catch(err) {}
}
