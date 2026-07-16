// Proxy Google Chat API calls server-side using stored access token
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const token = session.googleAccessToken;
  if (!token) return res.status(403).json({ error: 'No Google access token. Please sign in with Google first.' });

  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const BASE = 'https://chat.googleapis.com/v1';
  const url  = BASE + '/' + endpoint;

  try {
    const r = await fetch(url, {
      method: req.method === 'GET' ? 'GET' : req.method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
