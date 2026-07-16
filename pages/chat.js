import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';

export default function ChatPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [view, setView] = useState('embed'); // embed | setup
  const [chatUrl, setChatUrl] = useState('');
  const [spaceUrl, setSpaceUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    // Load saved space URL from localStorage
    const saved = localStorage.getItem('ys_gchat_space');
    if (saved) { setSpaceUrl(saved); setChatUrl(saved); }
  }, []);

  function saveAndOpen() {
    if (!spaceUrl.trim()) return;
    // Convert chat.google.com URL to embeddable URL
    let url = spaceUrl.trim();
    // Direct rooms work via iframe when logged in to Google
    localStorage.setItem('ys_gchat_space', url);
    setChatUrl(url);
    setSaved(true);
    setView('embed');
  }

  const isAdmin = session?.user?.role === 'admin';

  return (
    <Layout>
      <div style={{ display:'flex', flexDirection:'column', height:'calc(100dvh - 80px)', gap:0 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:10, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#00AC47,#00832D)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>💬</div>
            <div>
              <h2 style={{ fontWeight:900, fontSize:'1.1rem', margin:0 }}>Google Chat</h2>
              <p style={{ fontSize:'.75rem', color:'var(--muted2)', margin:0 }}>Team communication — inside Your Socials OS</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => setView(view === 'embed' ? 'setup' : 'embed')}
              style={{ padding:'7px 14px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, color:'var(--muted2)', cursor:'pointer', fontSize:'.8rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
              ⚙️ {view === 'embed' ? 'Settings' : 'Back to Chat'}
            </button>
            {chatUrl && (
              <a href="https://chat.google.com" target="_blank" rel="noopener noreferrer"
                style={{ padding:'7px 14px', background:'rgba(0,172,71,.12)', border:'1px solid rgba(0,172,71,.3)', borderRadius:9, color:'#00AC47', cursor:'pointer', fontSize:'.8rem', fontWeight:600, fontFamily:'Inter,sans-serif', textDecoration:'none' }}>
                ↗ Open in Google Chat
              </a>
            )}
          </div>
        </div>

        {/* Setup panel */}
        {view === 'setup' && (
          <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:40 }}>
            <div style={{ width:'100%', maxWidth:560 }}>

              {/* How it works */}
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 24px', marginBottom:20 }}>
                <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#00AC47,#00832D)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem' }}>💬</span>
                  How to connect Google Chat
                </div>
                {[
                  ['1', 'Open Google Chat', 'Go to chat.google.com and sign in with your Google Workspace account (manoj@yoursocials.in)'],
                  ['2', 'Create or open a Space', 'Create a team space for "Your Socials Team" or open an existing one'],
                  ['3', 'Copy the Space URL', 'The URL in your browser address bar looks like: https://chat.google.com/room/XXXXXX/...'],
                  ['4', 'Paste it below', 'Paste the URL here — the chat will open inside this app for everyone'],
                ].map(([num, title, desc]) => (
                  <div key={num} style={{ display:'flex', gap:14, marginBottom:16 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(0,172,71,.15)', color:'#00AC47', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.8rem', fontWeight:800, flexShrink:0 }}>{num}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:3 }}>{title}</div>
                      <div style={{ fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* URL input */}
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 24px', marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:10 }}>Google Chat Space URL</div>
                <input
                  value={spaceUrl}
                  onChange={e => setSpaceUrl(e.target.value)}
                  placeholder="https://chat.google.com/room/XXXXXXXXXX"
                  style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:10, padding:'11px 14px', fontSize:'.85rem', color:'var(--text)', fontFamily:'Inter,sans-serif', outline:'none', boxSizing:'border-box', marginBottom:12 }}
                  onFocus={e => e.target.style.borderColor='#00AC47'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,.13)'}
                />
                <button
                  onClick={saveAndOpen}
                  style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#00AC47,#00832D)', border:'none', borderRadius:10, color:'#fff', fontSize:'.9rem', fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                  💬 Open Google Chat in App
                </button>
              </div>

              {/* Alternative */}
              <div style={{ background:'rgba(0,172,71,.06)', border:'1px solid rgba(0,172,71,.2)', borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontWeight:700, fontSize:'.82rem', color:'#00AC47', marginBottom:6 }}>💡 Quick option — No setup needed</div>
                <div style={{ fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:10 }}>
                  Click the button below to open the full Google Chat directly. Everyone on your team needs to be signed in to Google with their work email.
                </div>
                <button
                  onClick={() => { setSpaceUrl('https://chat.google.com'); saveAndOpen(); }}
                  style={{ padding:'8px 18px', background:'rgba(0,172,71,.15)', border:'1px solid rgba(0,172,71,.35)', borderRadius:8, color:'#00AC47', cursor:'pointer', fontSize:'.82rem', fontWeight:700, fontFamily:'Inter,sans-serif' }}>
                  Open All of Google Chat →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Embedded chat */}
        {view === 'embed' && chatUrl && (
          <div style={{ flex:1, borderRadius:14, overflow:'hidden', border:'1px solid var(--border)', background:'#fff', position:'relative' }}>
            <iframe
              ref={iframeRef}
              src={chatUrl}
              style={{ width:'100%', height:'100%', border:'none', display:'block' }}
              allow="camera; microphone; notifications"
              title="Google Chat"
            />
          </div>
        )}

        {/* Empty state — no URL set yet */}
        {view === 'embed' && !chatUrl && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:40 }}>
            <div style={{ width:80, height:80, borderRadius:20, background:'linear-gradient(135deg,#00AC47,#00832D)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.5rem' }}>💬</div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:'1.2rem', marginBottom:8 }}>Connect Google Chat</div>
              <div style={{ fontSize:'.85rem', color:'var(--muted2)', lineHeight:1.7, maxWidth:420, marginBottom:24 }}>
                Bring your team communication inside Your Socials OS. Use Google Chat Spaces for all your brand discussions, file sharing and client conversations — right here alongside your tasks and calendar.
              </div>
              <button
                onClick={() => setView('setup')}
                style={{ padding:'12px 28px', background:'linear-gradient(135deg,#00AC47,#00832D)', border:'none', borderRadius:12, color:'#fff', fontSize:'.95rem', fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                ⚙️ Set Up Google Chat
              </button>
            </div>

            {/* Feature highlights */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, width:'100%', maxWidth:700, marginTop:8 }}>
              {[
                ['💬','Team Spaces','Create separate spaces per brand — Fattoush, BeWAXed, etc.'],
                ['📁','File Sharing','Share images, videos and docs directly in chat'],
                ['🔔','Notifications','Get Google Chat notifications alongside app notifications'],
                ['📱','Works on Mobile','Same chat available on phone via Google Chat app'],
              ].map(([icon,title,desc]) => (
                <div key={title} style={{ padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12 }}>
                  <div style={{ fontSize:'1.4rem', marginBottom:8 }}>{icon}</div>
                  <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:4 }}>{title}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted2)', lineHeight:1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
