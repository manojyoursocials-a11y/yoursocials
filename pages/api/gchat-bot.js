// Google Chat Bot webhook
// This endpoint receives messages from Google Chat and responds with
// task info, follow-ups, and team updates directly inside Google Chat

import { getDb } from '../../lib/db';

// Verify the request is from Google Chat
function verifyGoogle(req) {
  // In production Google sends a Bearer token — for now accept all POST
  return req.method === 'POST';
}

// Build a Google Chat card for a task
function taskCard(task) {
  const status = { todo:'📋 To Do', inprogress:'⚡ In Progress', review:'👁 Under Review', done:'✅ Done' }[task.status] || task.status;
  const priority = { P1:'🔴 P1', P2:'🟠 P2', P3:'🟡 P3', P4:'🟢 P4' }[task.priority] || task.priority;
  return {
    header: { title: task.title, subtitle: status + ' · ' + priority },
    sections: [{
      widgets: [
        task.client_name ? { textParagraph: { text: '🏢 ' + task.client_name } } : null,
        task.deadline    ? { textParagraph: { text: '⏰ Due: ' + String(task.deadline).slice(0,10) } } : null,
        task.owner_name  ? { textParagraph: { text: '👤 ' + task.owner_name } } : null,
        {
          buttons: [{
            textButton: {
              text: 'Open Your Socials OS',
              onClick: { openLink: { url: 'https://yoursocials.vercel.app/tasks' } }
            }
          }]
        }
      ].filter(Boolean)
    }]
  };
}

// Build summary card
function summaryCard(tasks, followups) {
  const todo       = tasks.filter(t => t.status === 'todo').length;
  const inprogress = tasks.filter(t => t.status === 'inprogress').length;
  const review     = tasks.filter(t => t.status === 'review').length;
  const done       = tasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at) > new Date(Date.now() - 86400000)).length;
  const overdue    = tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date()).length;
  const pendingFu  = followups.filter(f => f.status !== 'sent').length;

  return {
    header: { title: '📊 Your Socials OS — Daily Update', subtitle: new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }) },
    sections: [{
      widgets: [
        { textParagraph: { text: `📋 *To Do:* ${todo}   ⚡ *In Progress:* ${inprogress}   👁 *Review:* ${review}` } },
        { textParagraph: { text: `✅ *Done today:* ${done}   ❗ *Overdue:* ${overdue}   📩 *Follow-ups pending:* ${pendingFu}` } },
        {
          buttons: [
            { textButton: { text: '📋 Tasks', onClick: { openLink: { url: 'https://yoursocials.vercel.app/tasks' } } } },
            { textButton: { text: '📩 Follow-ups', onClick: { openLink: { url: 'https://yoursocials.vercel.app/followups' } } } },
            { textButton: { text: '🏆 Leaderboard', onClick: { openLink: { url: 'https://yoursocials.vercel.app/leaderboard' } } } },
          ]
        }
      ]
    }]
  };
}

export default async function handler(req, res) {
  if (!verifyGoogle(req)) return res.status(403).json({ error: 'Forbidden' });

  const db   = getDb();
  const body = req.body;
  const type = body?.type;
  const text = (body?.message?.text || body?.message?.argumentText || '').toLowerCase().trim();

  // Bot added to a space
  if (type === 'ADDED_TO_SPACE') {
    return res.json({
      text: `👋 *Your Socials OS* is now connected to this space!\n\nType any of these commands:\n• \`/tasks\` — see active tasks\n• \`/today\` — today's summary\n• \`/overdue\` — overdue tasks\n• \`/followups\` — pending follow-ups\n• \`/leaderboard\` — team coin rankings\n• \`/help\` — show this menu\n\nAll task updates will also be posted here automatically. 🚀`
    });
  }

  // Slash commands or text
  if (type === 'MESSAGE') {
    try {
      const tasks     = await db.getTasks();
      const followups = await db.getFollowups?.() || [];
      const members   = await db.getUsers();

      // /today or /summary
      if (text.includes('/today') || text.includes('/summary') || text === 'today' || text === 'summary') {
        const card = summaryCard(tasks, followups);
        return res.json({ cards: [card] });
      }

      // /tasks or /active
      if (text.includes('/tasks') || text.includes('/active') || text === 'tasks') {
        const active = tasks.filter(t => t.status !== 'done').slice(0, 8);
        if (!active.length) return res.json({ text: '✅ No active tasks right now!' });
        return res.json({
          text: `*${active.length} active tasks:*`,
          cards: active.slice(0, 5).map(taskCard)
        });
      }

      // /overdue
      if (text.includes('/overdue') || text === 'overdue') {
        const overdue = tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date());
        if (!overdue.length) return res.json({ text: '✅ No overdue tasks! Great work 🎉' });
        return res.json({
          text: `⚠️ *${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}:*`,
          cards: overdue.slice(0, 5).map(taskCard)
        });
      }

      // /followups
      if (text.includes('/followups') || text.includes('/followup') || text === 'followups') {
        const pending = followups.filter(f => f.status !== 'sent').slice(0, 8);
        if (!pending.length) return res.json({ text: '✅ All follow-ups are done!' });
        const lines = pending.map(f => `• *${f.subject}* — due ${String(f.due_date || '').slice(0,10) || 'no date'}`).join('\n');
        return res.json({ text: `📩 *${pending.length} pending follow-ups:*\n${lines}\n\n<https://yoursocials.vercel.app/followups|Open Follow-ups →>` });
      }

      // /leaderboard
      if (text.includes('/leaderboard') || text === 'leaderboard') {
        const top = members.sort((a,b) => (b.coins||0) - (a.coins||0)).slice(0, 5);
        const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
        const lines = top.map((m,i) => `${medals[i]} *${m.name || m.email}* — ${m.coins || 0} 🪙`).join('\n');
        return res.json({ text: `🏆 *Team Leaderboard*\n\n${lines}\n\n<https://yoursocials.vercel.app/leaderboard|View full leaderboard →>` });
      }

      // /help or anything else
      return res.json({
        text: `*Your Socials OS Commands:*\n• \`/today\` — daily summary\n• \`/tasks\` — active tasks\n• \`/overdue\` — overdue tasks\n• \`/followups\` — pending follow-ups\n• \`/leaderboard\` — team rankings\n\n🔗 <https://yoursocials.vercel.app|Open Your Socials OS>`
      });

    } catch(e) {
      console.error('GChat bot error:', e.message);
      return res.json({ text: '⚠️ Could not fetch data: ' + e.message });
    }
  }

  // Bot removed
  if (type === 'REMOVED_FROM_SPACE') {
    return res.status(200).end();
  }

  return res.json({ text: 'Hello from Your Socials OS! 👋' });
}
