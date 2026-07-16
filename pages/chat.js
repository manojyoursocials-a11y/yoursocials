import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';

const SPACES = [
  { name: 'Fattoush SM Marketing',   color: '#00AC47', initial: 'F' },
  { name: 'beWAXed',                 color: '#9C27B0', initial: 'b' },
  { name: 'Sewaro Craft Salon',      color: '#EA4335', initial: 'S' },
  { name: 'Tip & Toe – Chennai',     color: '#FF6D00', initial: 'T' },
  { name: 'Sagar Rehab',             color: '#1A73E8', initial: 'S' },
  { name: 'Scale Up',                color: '#FBBC04', initial: 'S' },
  { name: 'ARC Foods and Beverages', color: '#00BCD4', initial: 'A' },
  { name: 'Your Socials',            color: '#E91E63', initial: 'Y' },
  { name: 'FactoryFeed Daily Sync',  color: '#795548', initial: 'F' },
  { name: 'FactoryFeed Social Media',color: '#607D8B', initial: 'F' },
  { name: 'Reports, Leave & Attendance', color: '#FF5722', initial: 'R' },
  { name: 'MY PERSONAL SPACE',       color: '#FFC107', initial: 'M' },
];

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const chatWindowRef = useRef(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [googleAccount, setGoogleAccount] = useState('');
  const [showAccountInput, setShowAccountInput] = useState(false);
  const [accountInput, setAccountInput] = useState('');
  const [activeSpace, setActiveSpace] = useState(null);
  const [view, setView] = useState('spaces'); // spaces | dm | files

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    // Load saved account
    const saved = localStorage.getItem('ys_google_account');
    if (saved) setGoogleAccount(saved);
  }, [status]);

  function openChat(spaceName) {
    const url = 'https://chat.google.com';
    setActiveSpace(spaceName || null);
    if (chatWindowRef.current && !chatWindowRef.current.closed) {
      chatWindowRef.current.focus();
      chatWindowRef.current.location.href = url;
      return;
    }
    const w = Math.floor(window.screen.width * 0.55);
    const h = window.screen.height;
    const left = window.screen.width - w;
    chatWindowRef.current = window.open(
      url, 'google-chat-window',
      `width=${w},height=${h},left=${left},top=0,toolbar=no,menubar=no,location=yes`
    );
    if (chatWindowRef.current) {
      setWindowOpen(true);
      const check = setInterval(() => {
        if (chatWindowRef.current?.closed) {
          clearInterval(check); setWindowOpen(false); setActiveSpace(null);
        }
      }, 800);
    }
  }

  function switchAccount() {
    const w = window.open(
      'https://accounts.google.com/AccountChooser?continue=https://chat.google.com',
      'google-account', 'width=500,height=600,left=400,top=80'
    );
    // After they switch, update what we show
    const t = setInterval(() => {
      if (w?.closed) { clearInterval(t); setShowAccountInput(true); }
    }, 800);
  }

  function saveAccount() {
    const val = accountInput.trim();
    if (!val) return;
    setGoogleAccount(val);
    localStorage.setItem('ys_google_account', val);
    setShowAccountInput(false);
    setAccountInput('');
  }

  function focusChat() {
    if (chatWindowRef.current && !chatWindowRef.current.closed) chatWindowRef.current.focus();
  }
  function closeChat() {
    if (chatWindowRef.current && !chatWindowRef.current.closed) chatWindowRef.current.close();
    setWindowOpen(false); setActiveSpace(null);
  }

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">

        {/* ── TOP BAR ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#00AC47,#1A73E8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem' }}>💬</div>
            <div>
              <h2 style={{ fontWeight:900, fontSize:'1.1rem', margin:0 }}>Google Chat</h2>
              <p style={{ fontSize:'.75rem', color:'var(--muted2)', margin:0 }}>All your spaces and messages — managed from here</p>
            </div>
          </div>

          {/* Account + controls — top right */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {/* Google account badge */}
            {googleAccount && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:20 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#1A73E8,#00AC47)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'.7rem', fontWeight:800 }}>
                  {googleAccount[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--text)', lineHeight:1 }}>{googleAccount}</div>
                  <div style={{ fontSize:'.62rem', color:'#00AC47', lineHeight:1.4 }}>● Google Account</div>
                </div>
                <button onClick={switchAccount}
                  style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.7rem', padding:'2px 6px', borderRadius:6, fontFamily:'Inter,sans-serif' }}
                  title="Switch account">⇄</button>
              </div>
            )}
            {!googleAccount && (
              <button onClick={() => setShowAccountInput(true)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', background:'#fff', border:'1.5px solid #dadce0', borderRadius:20, cursor:'pointer', fontFamily:'Inter,sans-serif', fontSize:'.8rem', fontWeight:600, color:'#3c4043' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={16} height={16} alt="" onError={e=>e.target.style.display='none'}/>
                Set Google Account
              </button>
            )}

            {/* Window controls */}
            {windowOpen ? (
              <>
                <button onClick={focusChat}
                  style={{ padding:'7px 14px', background:'rgba(0,172,71,.15)', border:'1px solid rgba(0,172,71,.3)', borderRadius:9, color:'#00AC47', cursor:'pointer', fontSize:'.8rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                  ● Focus Window
                </button>
                <button onClick={closeChat}
                  style={{ padding:'7px 12px', background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.25)', borderRadius:9, color:'#EA4335', cursor:'pointer', fontSize:'.8rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>✕</button>
              </>
            ) : (
              <button onClick={() => openChat()}
                style={{ padding:'8px 20px', background:'linear-gradient(135deg,#00AC47,#1A73E8)', border:'none', borderRadius:10, color:'#fff', cursor:'pointer', fontSize:'.85rem', fontWeight:700, fontFamily:'Inter,sans-serif' }}>
                💬 Open Google Chat
              </button>
            )}
          </div>
        </div>

        {/* Account input modal */}
        {showAccountInput && (
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:'.8rem', fontWeight:600, marginBottom:6 }}>Your Google email</div>
              <input value={accountInput} onChange={e=>setAccountInput(e.target.value)}
                placeholder="manoj@yoursocials.in"
                onKeyDown={e=>e.key==='Enter'&&saveAccount()}
                style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'9px 12px', fontSize:'.85rem', color:'var(--text)', fontFamily:'Inter,sans-serif', outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'flex', gap:8, paddingTop:20 }}>
              <button onClick={saveAccount}
                style={{ padding:'9px 18px', background:'#1A73E8', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:'.82rem', fontWeight:700, fontFamily:'Inter,sans-serif' }}>Save</button>
              <button onClick={()=>{setShowAccountInput(false);setAccountInput('');}}
                style={{ padding:'9px 14px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--muted2)', cursor:'pointer', fontSize:'.82rem', fontFamily:'Inter,sans-serif' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Status bar */}
        {windowOpen && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'rgba(0,172,71,.07)', border:'1px solid rgba(0,172,71,.2)', borderRadius:10, marginBottom:16 }}>
            <span style={{ color:'#00AC47', fontSize:'.85rem' }}>✅</span>
            <span style={{ fontSize:'.82rem', color:'var(--muted2)' }}>
              Google Chat is open{activeSpace ? ` → ${activeSpace}` : ''}. Click any space to jump there.
            </span>
            <a href="https://chat.google.com" target="_blank" rel="noopener noreferrer"
              style={{ marginLeft:'auto', fontSize:'.75rem', color:'var(--purple2)', fontWeight:600, textDecoration:'none' }}>
              ↗ Full screen
            </a>
          </div>
        )}

        {/* ── VIEW TABS ── */}
        <div style={{ display:'flex', gap:4, marginBottom:18, background:'var(--surface2)', padding:4, borderRadius:10, border:'1px solid var(--border)', width:'fit-content' }}>
          {[['spaces','🏢 Spaces'],['dm','💬 Direct Messages'],['tools','⚙️ Tools']].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:'6px 16px', borderRadius:7, border:'none', background:view===v?'var(--surface)':' transparent', color:view===v?'var(--text)':' var(--muted2)', fontSize:'.8rem', fontWeight:view===v?700:500, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:view===v?'var(--shadow)':' none' }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── SPACES VIEW ── */}
        {view === 'spaces' && (
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Your Spaces — click to open</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
              {SPACES.map(space => (
                <button key={space.name} onClick={() => openChat(space.name)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', transition:'all .15s', position:'relative' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=space.color;e.currentTarget.style.background=space.color+'11';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--surface2)';}}>
                  {activeSpace===space.name&&windowOpen&&(
                    <div style={{ position:'absolute', top:8, right:8, width:8, height:8, borderRadius:'50%', background:'#00AC47' }}/>
                  )}
                  <div style={{ width:40, height:40, borderRadius:10, background:space.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.92rem', flexShrink:0 }}>
                    {space.initial}
                  </div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{space.name}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:2 }}>Click to open ↗</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DM VIEW ── */}
        {view === 'dm' && (
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Direct Messages</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
              {['Karishma','Siva Dharshini','BOJARAJAN T','Yuvani','lopes_yoursocials'].map((name,i) => {
                const colors = ['#E91E63','#00AC47','#FF6D00','#9C27B0','#1A73E8'];
                return (
                  <button key={name} onClick={() => openChat(name)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', transition:'all .15s' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=colors[i%colors.length];e.currentTarget.style.background=colors[i%colors.length]+'11';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--surface2)';}}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:colors[i%colors.length], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.85rem', flexShrink:0, position:'relative' }}>
                      {name[0]}
                      <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'#00AC47', border:'2px solid var(--surface2)' }}/>
                    </div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'.85rem' }}>{name}</div>
                      <div style={{ fontSize:'.7rem', color:'var(--muted2)' }}>Send message ↗</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TOOLS VIEW ── */}
        {view === 'tools' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 22px' }}>
              <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:6 }}>🔄 Switch Google Account</div>
              <div style={{ fontSize:'.8rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:14 }}>
                Currently: <strong style={{ color:'var(--text)' }}>{googleAccount || 'No account set'}</strong><br/>
                Click below to switch to a different Google account for Chat.
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button onClick={switchAccount}
                  style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'9px 20px', background:'#fff', border:'1.5px solid #dadce0', borderRadius:9, cursor:'pointer', fontFamily:'Google Sans,Inter,sans-serif', fontSize:'.85rem', fontWeight:600, color:'#3c4043' }}>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="" onError={e=>e.target.style.display='none'}/>
                  Switch Google Account
                </button>
                <button onClick={() => setShowAccountInput(true)}
                  style={{ padding:'9px 16px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, cursor:'pointer', fontSize:'.82rem', color:'var(--muted2)', fontFamily:'Inter,sans-serif' }}>
                  ✏️ Edit saved account
                </button>
              </div>
            </div>

            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 22px' }}>
              <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:6 }}>🖥️ Window Management</div>
              <div style={{ fontSize:'.8rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:14 }}>
                Google Chat opens in a separate window. Use snap layout to view both side by side.
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={() => openChat()}
                  style={{ padding:'9px 18px', background:'linear-gradient(135deg,#00AC47,#1A73E8)', border:'none', borderRadius:9, color:'#fff', cursor:'pointer', fontSize:'.82rem', fontWeight:700, fontFamily:'Inter,sans-serif' }}>
                  💬 Open Chat Window
                </button>
                {windowOpen && (
                  <button onClick={focusChat}
                    style={{ padding:'9px 16px', background:'rgba(0,172,71,.15)', border:'1px solid rgba(0,172,71,.3)', borderRadius:9, color:'#00AC47', cursor:'pointer', fontSize:'.82rem', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                    ● Bring to Front
                  </button>
                )}
                {windowOpen && (
                  <button onClick={closeChat}
                    style={{ padding:'9px 16px', background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.25)', borderRadius:9, color:'#EA4335', cursor:'pointer', fontSize:'.82rem', fontFamily:'Inter,sans-serif' }}>
                    ✕ Close Window
                  </button>
                )}
              </div>
            </div>

            <div style={{ background:'rgba(26,115,232,.06)', border:'1px solid rgba(26,115,232,.2)', borderRadius:12, padding:'14px 18px' }}>
              <div style={{ fontWeight:700, fontSize:'.82rem', color:'#8ab4f8', marginBottom:8 }}>💡 Snap side by side</div>
              <div style={{ fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.7 }}>
                <strong>Windows:</strong> Press Win+← on this window, then click the Chat window to snap it right.<br/>
                <strong>Mac:</strong> Green dot → Tile Window to Left of Screen → pick Chat for the right.
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
