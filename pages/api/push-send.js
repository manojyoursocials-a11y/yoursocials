// Send a Web Push notification to all subscribers or specific user
// Uses VAPID — no third-party service needed
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BJksSkC9PcN_58qBiwEjZc460b6BR2L3fKpEmCW5S0W9qW7cFrfomcg74GIRZi79fHZfuDt_NXZfp0sEiq4m6ds';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'samjMBRAL9D54uarXgsdOt2gbxwct38CEaka-pKhpXI';
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:admin@yoursocials.in';

// Build a signed VAPID JWT manually (no external dependency)
async function buildVapidAuth(endpoint) {
  const url      = new URL(endpoint);
  const audience = url.origin;
  const now      = Math.floor(Date.now() / 1000);
  const exp      = now + 12 * 3600;

  const header  = btoa(JSON.stringify({ typ:'JWT', alg:'ES256' })).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const payload = btoa(JSON.stringify({ aud: audience, exp, sub: VAPID_EMAIL })).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const msg     = header + '.' + payload;

  // Import private key
  const privBytes = Buffer.from(VAPID_PRIVATE, 'base64url');
  const keyData   = { kty:'EC', crv:'P-256', d: VAPID_PRIVATE,
    x: VAPID_PUBLIC.slice(2, 45), y: VAPID_PUBLIC.slice(45) };

  const key = await crypto.subtle.importKey(
    'raw',
    privBytes,
    { name:'ECDSA', namedCurve:'P-256' },
    false, ['sign']
  ).catch(() => null);

  if (!key) return null;

  const sig    = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, Buffer.from(msg));
  const sigB64 = Buffer.from(sig).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');

  return `vapid t=${msg}.${sigB64},k=${VAPID_PUBLIC}`;
}

async function sendOnePush(sub, payload) {
  try {
    const body    = JSON.stringify(payload);
    // Encrypt payload for the subscriber using their keys
    // Simple approach: use the Push API without encryption for now (plaintext)
    const auth    = await buildVapidAuth(sub.endpoint);
    if (!auth) return false;

    const r = await fetch(sub.endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': auth,
        'TTL':           '86400',
      },
      body,
    });
    return r.ok || r.status === 201;
  } catch(e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { title, body, userId } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const db   = getDb();
  const subs = userId ? await db.getPushSubscriptions(userId) : await db.getAllPushSubscriptions();

  const payload = { title, body: body || '', icon: '/favicon-32.png', badge: '/favicon-32.png' };
  let sent = 0, failed = 0;

  for (const sub of subs) {
    const ok = await sendOnePush(sub, payload);
    if (ok) sent++; else failed++;
  }

  return res.json({ ok: true, sent, failed, total: subs.length });
}
