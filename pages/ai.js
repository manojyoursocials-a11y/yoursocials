import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { TypingDots, sounds, askAI } from '../components/UI';

const QUICK = [
  ['🔴 Detect bottlenecks',       'What bottlenecks might a 5-person creative social media agency have when managing multiple clients?'],
  ['⚠️ Predict deadline risks',    'What types of tasks are most at risk of missing deadlines in a creative agency?'],
  ['👥 Suggest collaborations',    'How should tasks be divided between a content lead, designer, video editor, and copywriter?'],
  ['✉️ Draft client follow-up',    'Draft a warm WhatsApp follow-up to a client awaiting content approval. Under 80 words.'],
  ['🧩 Break down a task',         'Break down "Create Instagram Reel campaign for a salon" into subtasks with time estimates.'],
  ['📅 Monday planning tips',      'Give me a Monday morning planning routine for a 5-person social media agency.'],
  ['🎯 Set weekly OKRs',           'Help me set 3 OKRs for our creative team this week.'],
  ['💡 Improve quality scores',    '5 ways a creative team can improve their content quality scores week over week.'],
];

export default function AI() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const firstName = session?.user?.name?.split(' ')[0] || 'there';
  const [msgs,    setMsgs]    = useState([{ role: 'ai', text: `Hey ${firstName}! 👋 I'm your AI Operations Manager.\n\nI can help you:\n• Break down tasks into subtasks\n• Predict deadline risks\n• Draft client follow-ups\n• Suggest who should work on what\n• Detect team bottlenecks\n\nWhat do you need today?` }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    const r = await askAI(msg);
    setMsgs(m => [...m, { role: 'ai', text: r }]);
    setLoading(false);
    sounds.pop();
  }

  return (
    <Layout>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, height: 'calc(100vh - 110px)' }}>
        {/* Chat panel */}
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#00D4FF,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🤖</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '.9rem' }}>AI Operations Manager</div>
              <div style={{ fontSize: '.7rem', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="live-dot" /> Online
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.role === 'ai' ? 'linear-gradient(135deg,#00D4FF,#7C5CFC)' : 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 700, flexShrink: 0 }}>
                  {m.role === 'ai' ? '🤖' : (session?.user?.name?.[0] || 'Y')}
                </div>
                <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: m.role === 'ai' ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: m.role === 'ai' ? 'rgba(124,92,252,.1)' : 'rgba(124,92,252,.22)', border: '1px solid ' + (m.role === 'ai' ? 'rgba(124,92,252,.2)' : 'rgba(124,92,252,.35)'), fontSize: '.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#00D4FF,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem' }}>🤖</div>
                <div style={{ padding: '10px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(124,92,252,.1)', border: '1px solid rgba(124,92,252,.2)' }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything — break tasks, predict risks, draft messages…"
              style={{ flex: 1, background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', fontSize: '.82rem', color: 'var(--text)', fontFamily: 'Inter,sans-serif', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--purple)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.13)'}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{ background: 'var(--grad1)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: '.9rem', opacity: loading || !input.trim() ? .5 : 1 }}
            >
              →
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16 }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {QUICK.map(([l, p]) => (
                <button
                  key={l}
                  onClick={() => send(p)}
                  style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '.74rem', color: 'var(--muted2)', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter,sans-serif', transition: 'all .18s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple)'; e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted2)'; }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
