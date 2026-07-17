// Your Socials OS — Google Chat Bot Webhook
// Google calls this URL when someone messages the bot

import { getDb } from '../../lib/db';

// Google Chat Cards v2 format — required for newer Chat API
function makeCard(header, rows) {
  return {
    cardsV2: [{
      cardId: 'ys-card-' + Date.now(),
      card: {
        header: {
          title:    header.title,
          subtitle: header.subtitle || '',
          imageUrl: 'https://yoursocials.vercel.app/favicon-180.png',
          imageType: 'CIRCLE',
        },
        sections: [{
          widgets: [
            ...rows.map(row => ({ textParagraph: { text: row } })),
            {
              buttonList: {
                buttons: [
                  { text:'📋 Tasks',      onClick:{ openLink:{ url:'https://yoursocials.vercel.app/tasks' } } },
                  { text:'📩 Follow-ups', onClick:{ openLink:{ url:'https://yoursocials.vercel.app/followups' } } },
                  { text:'🏆 Leaderboard',onClick:{ openLink:{ url:'https://yoursocials.vercel.app/leaderboard' } } },
                ]
              }
            }
          ]
        }]
      }
    }]
  };
}

export default async function handler(req, res) {
  // Google Chat only sends POST
  if (req.method !== 'POST') return res.status(200).json({ text: 'OK' });

  const body = req.body || {};
  const type = body.type || '';
  const msgText = (body.message?.text || body.message?.argumentText || '').toLowerCase().trim();
  const slashCmd = body.message?.slashCommand?.commandId;

  console.log('[GChat Bot] type:', type, 'text:', msgText);

  try {
    const db = getDb();

    // ── Bot added to a space ─────────────────────────────
    if (type === 'ADDED_TO_SPACE') {
      return res.status(200).json({
        text: `👋 *Your Socials OS* is now connected!\n\nUse these commands:\n• \`/today\` — Daily summary\n• \`/tasks\` — Active tasks\n• \`/overdue\` — Overdue tasks\n• \`/followups\` — Pending follow-ups\n• \`/leaderboard\` — Team coin rankings\n\nYou'll also get notified here when tasks are created, moved or completed. 🚀\n\n🔗 https://yoursocials.vercel.app`
      });
    }

    // ── Bot removed ──────────────────────────────────────
    if (type === 'REMOVED_FROM_SPACE') {
      return res.status(200).end();
    }

    // ── Incoming message ─────────────────────────────────
    if (type === 'MESSAGE') {
      const tasks     = await db.getTasks().catch(() => []);
      const followups = await db.getFollowups().catch(() => []);
      const members   = await db.getUsers().catch(() => []);

      const active  = tasks.filter(t => t.status !== 'done');
      const overdue = tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date());
      const pending = followups.filter(f => f.status !== 'sent');

      // /today — daily summary
      if (msgText.includes('/today') || msgText.includes('today') || msgText.includes('/summary') || slashCmd === '1') {
        const todo       = tasks.filter(t => t.status === 'todo').length;
        const inprogress = tasks.filter(t => t.status === 'inprogress').length;
        const review     = tasks.filter(t => t.status === 'review').length;
        const doneToday  = tasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at) > new Date(Date.now()-86400000)).length;

        const card = makeCard(
          { title: '📊 Daily Summary', subtitle: new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) },
          [
            `📋 <b>To Do:</b> ${todo}`,
            `⚡ <b>In Progress:</b> ${inprogress}`,
            `👁 <b>Under Review:</b> ${review}`,
            `✅ <b>Done today:</b> ${doneToday}`,
            overdue.length > 0 ? `❗ <b>Overdue:</b> ${overdue.length} task${overdue.length>1?'s':''}` : `✅ <b>No overdue tasks!</b>`,
            `📩 <b>Pending follow-ups:</b> ${pending.length}`,
          ]
        );
        return res.status(200).json(card);
      }

      // /tasks — active tasks
      if (msgText.includes('/tasks') || msgText.includes('tasks') || slashCmd === '2') {
        if (!active.length) return res.status(200).json({ text: '✅ No active tasks right now!' });
        const lines = active.slice(0,10).map(t => {
          const s = { todo:'📋',inprogress:'⚡',review:'👁' }[t.status] || '📋';
          return `${s} <b>${t.title}</b>${t.client_name?' — '+t.client_name:''}${t.deadline?' (due '+String(t.deadline).slice(0,10)+')':''}`;
        });
        if (active.length > 10) lines.push(`<i>...and ${active.length-10} more</i>`);
        const card = makeCard({ title:`📋 Active Tasks (${active.length})` }, lines);
        return res.status(200).json(card);
      }

      // /overdue
      if (msgText.includes('/overdue') || msgText.includes('overdue') || slashCmd === '3') {
        if (!overdue.length) return res.status(200).json({ text: '✅ No overdue tasks! Great work 🎉' });
        const lines = overdue.slice(0,8).map(t =>
          `❗ <b>${t.title}</b>${t.client_name?' — '+t.client_name:''} (due ${String(t.deadline).slice(0,10)})`
        );
        const card = makeCard({ title:`⚠️ Overdue Tasks (${overdue.length})`, subtitle:'These need immediate attention' }, lines);
        return res.status(200).json(card);
      }

      // /followups
      if (msgText.includes('/followup') || msgText.includes('followup') || slashCmd === '4') {
        if (!pending.length) return res.status(200).json({ text: '✅ All follow-ups are done!' });
        const lines = pending.slice(0,8).map(f =>
          `📩 <b>${f.subject}</b>${f.due_date?' — due '+String(f.due_date).slice(0,10):''}`
        );
        const card = makeCard({ title:`📩 Pending Follow-ups (${pending.length})` }, lines);
        return res.status(200).json(card);
      }

      // /leaderboard
      if (msgText.includes('/leaderboard') || msgText.includes('leaderboard') || slashCmd === '5') {
        const top = [...members].sort((a,b)=>(b.coins||0)-(a.coins||0)).slice(0,5);
        const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
        const lines = top.map((m,i) => `${medals[i]} <b>${m.name||m.email}</b> — ${m.coins||0} 🪙`);
        const card = makeCard({ title:'🏆 Team Leaderboard', subtitle:'Top performers this month' }, lines);
        return res.status(200).json(card);
      }

      // Default / help
      return res.status(200).json({
        text: `*Your Socials OS Commands:*\n\n• \`/today\` — Daily task summary\n• \`/tasks\` — All active tasks\n• \`/overdue\` — Overdue tasks\n• \`/followups\` — Pending follow-ups\n• \`/leaderboard\` — Team coin rankings\n\n🔗 https://yoursocials.vercel.app`
      });
    }

    return res.status(200).json({ text: '👋 Hi! Type /today to get started.' });

  } catch(e) {
    console.error('[GChat Bot] Error:', e.message);
    // Always return 200 to Google — never let it timeout
    return res.status(200).json({ text: `⚠️ Error: ${e.message}. Please try again.` });
  }
}

// Required: tell Next.js to parse JSON body
export const config = { api: { bodyParser: true } };
