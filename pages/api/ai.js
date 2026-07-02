import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';

const SYSTEM = `You are the AI Operations Manager for "Your Socials OS", a project management tool for a creative social media agency in Chennai, India. You help teams:
- Break large tasks into clear subtasks with time estimates
- Predict deadline risks
- Suggest which team members should collaborate
- Draft professional client follow-up messages (WhatsApp/email)
- Detect bottlenecks
- Write task checklists
Be concise, warm, practical. Never blame individuals — frame everything as support.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, system } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: system || SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.json({ text: data.content?.[0]?.text ?? '' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
