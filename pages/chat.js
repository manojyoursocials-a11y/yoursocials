import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const chatWindowRef = useRef(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [account, setAccount] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  function openChat(url) {
    if (chatWindowRef.current && !chatWindowRef.current.closed) {
      chatWindowRef.current.focus();
      chatWindowRef.current.location.href = url || 'https://chat.google.com';
      return;
    }
    // Open Google Chat as a popup window sized to half the screen
    const w = Math.floor(window.screen.width * 0.55);
    const h = window.screen.height;
    const left = window.screen.width - w;
    chatWindowRef.current = window.open(
      url || 'https://chat.google.com',
      'google-chat-window',
      `width=${w},height=${h},left=${left},top=0,toolbar=no,menubar=no,location=yes,status=no`
    );
    if (chatWindowRef.current) {
      setWindowOpen(true);
      const check = setInterval(() => {
        if (chatWindowRef.current?.closed) {
          clearInterval(check);
          setWindowOpen(false);
        }
      }, 1000);
    }
  }

  function switchAccount() {
    openChat('https://accounts.google.com/AccountChooser?continue=https://chat.google.com');
  }

  function closeChat() {
    if (chatWindowRef.current && !chatWindowRef.current.closed) {
      chatWindowRef.current.close();
    }
    setWindowOpen(false);
  }

  const SPACES = [
    { name: 'Fattoush SM Marketing', color: '#00AC47', initial: 'F', url: 'https://chat.google.com' },
    { name: 'beWAXed',               color: '#9C27B0', initial: 'b', url: 'https://chat.google.com' },
    { name: 'Sewaro Craft Salon',    color: '#EA4335', initial: 'S', url: 'https://chat.google.com' },
    { name: 'Tip & Toe – Chennai',   color: '#FF6D00', initial: 'T', url: 'https://chat.google.com' },
    { name: 'Sagar Rehab',           color: '#1A73E8', initial: 'S', url: 'https://chat.google.com' },
    { name: 'Scale Up',              color: '#FBBC04', initial: 'S', url: 'https://chat.google.com' },
    { name: 'ARC Foods and Beverages', color: '#00BCD4', initial: 'A', url: 'https://chat.google.com' },
    { name: 'Your Socials',          color: '#E91E63', initial: 'Y', url: 'https://chat.google.com' },
  ];

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:'linear-gradient(135deg,#00AC47,#1A73E8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem' }}>💬</div>
            <div>
              <h2 style={{ fontWeight:900, fontSize:'1.15rem', margin:0 }}>Google Chat</h2>
              <p style={{ fontSize:'.78rem', color:'var(--muted2)', margin:0 }}>Opens in a separate window alongside this app</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {windowOpen && (
              <>
                <button onClick={switchAccount}
                  style={{ padding:'8px 16px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:9, color:'var(--muted2)', cursor:'pointer', fontSize:'.82rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                  🔄 Switch Account
                </button>
                <button onClick={() => chatWindowRef.current?.focus()}
                  style={{ padding:'8px 16px', background:'rgba(0,172,71,.15)', border:'1px solid rgba(0,172,71,.3)', borderRadius:9, color:'#00AC47', cursor:'pointer', fontSize:'.82rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                  ● Focus Chat Window
                </button>
                <button onClick={closeChat}
                  style={{ padding:'8px 16px', background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.25)', borderRadius:9, color:'#EA4335', cursor:'pointer', fontSize:'.82rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                  ✕ Close
                </button>
              </>
            )}
            {!windowOpen && (
              <button onClick={() => openChat()}
                style={{ padding:'9px 22px', background:'linear-gradient(135deg,#00AC47,#1A73E8)', border:'none', borderRadius:10, color:'#fff', cursor:'pointer', fontSize:'.88rem', fontWeight:700, fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', gap:8 }}>
                💬 Open Google Chat
              </button>
            )}
          </div>
        </div>

        {/* Status banner */}
        {windowOpen && (
          <div style={{ background:'rgba(0,172,71,.08)', border:'1px solid rgba(0,172,71,.2)', borderRadius:12, padding:'12px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:'1rem' }}>✅</span>
            <div>
              <div style={{ fontWeight:700, fontSize:'.88rem', color:'#00AC47' }}>Google Chat is open</div>
              <div style={{ fontSize:'.78rem', color:'var(--muted2)' }}>It's running in a separate window. Click any space below to jump straight to it, or click "Focus Chat Window" to bring it to front.</div>
            </div>
          </div>
        )}

        {/* Quick launch grid */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:14 }}>Your Spaces — click to open</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
            {SPACES.map(space => (
              <button key={space.name} onClick={() => openChat(space.url)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = space.color; e.currentTarget.style.background = space.color + '11'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)'; }}>
                <div style={{ width:38, height:38, borderRadius:10, background:space.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.9rem', flexShrink:0 }}>
                  {space.initial}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.85rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{space.name}</div>
                  <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:2 }}>Click to open in Google Chat</div>
                </div>
                <span style={{ marginLeft:'auto', fontSize:'.75rem', color:space.color, flexShrink:0 }}>↗</span>
              </button>
            ))}
          </div>
        </div>

        {/* Switch account section */}
        <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 22px', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:6 }}>🔄 Switch Google Account</div>
          <div style={{ fontSize:'.8rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:14 }}>
            If you need to use a different Google account for Google Chat, click below. A window will open for you to switch accounts — your changes apply to the chat window.
          </div>
          <button onClick={switchAccount}
            style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'9px 20px', background:'#fff', border:'1.5px solid #dadce0', borderRadius:9, cursor:'pointer', fontFamily:'Google Sans, Inter, sans-serif', fontSize:'.85rem', fontWeight:600, color:'#3c4043' }}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="" onError={e=>e.target.style.display='none'}/>
            Switch Google Account
          </button>
        </div>

        {/* How to use tip */}
        <div style={{ background:'rgba(26,115,232,.06)', border:'1px solid rgba(26,115,232,.2)', borderRadius:12, padding:'14px 18px' }}>
          <div style={{ fontWeight:700, fontSize:'.82rem', color:'#8ab4f8', marginBottom:8 }}>💡 Pro tip — snap windows side by side</div>
          <div style={{ fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.7 }}>
            On Windows: drag Your Socials to the left half of screen (Win+← key) and Google Chat window snaps to the right half automatically.<br/>
            On Mac: hover over the green dot on either window → choose "Tile Window to Left/Right of Screen".
          </div>
        </div>
      </div>
    </Layout>
  );
}
