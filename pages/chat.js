import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { Avatar, Spinner, MEMBER_COLORS } from '../components/UI';

async function gchat(endpoint, method='GET', body) {
  const r = await fetch('/api/google-chat?endpoint=' + encodeURIComponent(endpoint), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function timeAgo(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm';
  if (m < 1440) return Math.floor(m/60) + 'h';
  return Math.floor(m/1440) + 'd';
}

function fullTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}

export default function Chat() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isGoogleSignedIn = !!(session?.googleAccessToken);
  const hasAppSession    = status === 'authenticated';

  const [spaces,      setSpaces]      = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [members,     setMembers]     = useState([]);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [spaceError,  setSpaceError]  = useState('');
  const [loadMsgs,    setLoadMsgs]    = useState(false);
  const [view,        setView]        = useState('spaces');
  const [search,      setSearch]      = useState('');
  const [mediaFile,   setMediaFile]   = useState(null);

  const sinceRef  = useRef(null);
  const pollRef   = useRef(null);
  const bottomRef = useRef(null);
  const fileRef   = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  // Load Google Chat spaces when Google signed in
  const loadSpaces = useCallback(async () => {
    if (!isGoogleSignedIn) return;
    setLoading(true);
    try {
      // Load all spaces — no filter so we get everything
      const d = await gchat('spaces?pageSize=100');
      console.log('[Chat] spaces response:', JSON.stringify(d));
      if (d.spaces) {
        setSpaces(d.spaces);
      } else if (d.error) {
        console.error('[Chat] spaces error:', d.error);
        setSpaceError(d.error?.message || d.error?.status || JSON.stringify(d.error));
      }
    } catch(e) {}
    setLoading(false);
  }, [isGoogleSignedIn]);

  useEffect(() => { if (isGoogleSignedIn) loadSpaces(); }, [isGoogleSignedIn, loadSpaces]);

  // Open a space and load messages
  async function openSpace(space) {
    setActiveSpace(space);
    setMessages([]);
    setLoadMsgs(true);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const name = space.name; // e.g. "spaces/XXXX"
      const d = await gchat(name + '/messages?pageSize=50&orderBy=createTime');
      setMessages(Array.isArray(d.messages) ? d.messages.reverse() : []);
    } catch(e) {}
    setLoadMsgs(false);

    sinceRef.current = new Date().toISOString();
    pollRef.current = setInterval(async () => {
      if (!sinceRef.current || !space?.name) return;
      try {
        const filter = encodeURIComponent('createTime > "' + sinceRef.current + '"');
        const d = await gchat(space.name + '/messages?filter=' + filter + '&orderBy=createTime');
        sinceRef.current = new Date().toISOString();
        if (d.messages?.length) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.name));
            return [...prev, ...d.messages.filter(m => !ids.has(m.name))];
          });
        }
      } catch(e) {}
    }, 5000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Send message
  async function send() {
    const content = text.trim();
    if (!content && !mediaFile) return;
    if (!activeSpace) return;
    setSending(true);
    try {
      const msg = await gchat(activeSpace.name + '/messages', 'POST', {
        text: content || undefined,
      });
      if (msg.name) {
        setMessages(prev => [...prev, msg]);
        setText('');
      }
    } catch(e) {}
    setSending(false);
    inputRef.current?.focus();
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const allSpaces = spaces.filter(s =>
    s.spaceType !== 'DIRECT_MESSAGE' && s.type !== 'DIRECT_MESSAGE'
  );
  const allDMs = spaces.filter(s =>
    s.spaceType === 'DIRECT_MESSAGE' || s.type === 'DIRECT_MESSAGE' ||
    s.spaceType === 'DIRECT_MESSAGE' || (s.singleUserBotDm === true)
  );
  const filteredSpaces = (search
    ? allSpaces.filter(s => (s.displayName || s.name).toLowerCase().includes(search.toLowerCase()))
    : allSpaces
  );

  const SPACE_COLORS = ['#00AC47','#1A73E8','#EA4335','#FBBC04','#9C27B0','#FF6D00','#00BCD4','#E91E63','#795548','#607D8B'];

  function spaceColor(name) {
    let hash = 0;
    for (let i = 0; i < (name||'').length; i++) hash = name.charCodeAt(i) + ((hash<<5)-hash);
    return SPACE_COLORS[Math.abs(hash) % SPACE_COLORS.length];
  }

  if (status === 'loading') return null;
  if (!hasAppSession) return null;

  // ── NOT SIGNED IN TO GOOGLE ────────────────────────────────
  if (!isGoogleSignedIn) {
    return (
      <Layout>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:28, textAlign:'center', padding:'0 20px' }}>
          {/* Header */}
          <div>
            <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#00AC47,#1A73E8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', margin:'0 auto 16px' }}>💬</div>
            <h2 style={{ fontWeight:900, fontSize:'1.4rem', marginBottom:8 }}>Google Chat</h2>
            <p style={{ fontSize:'.9rem', color:'var(--muted2)', lineHeight:1.7, maxWidth:420, margin:'0 auto' }}>
              Sign in with your Google account to access all your Spaces and Direct Messages — Fattoush, BeWAXed, Sewaro and more — right here inside Your Socials OS.
            </p>
          </div>

          {/* Sign in button */}
          <button
            onClick={() => signIn('google', { callbackUrl: '/chat' })}
            style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 28px', background:'#fff', border:'2px solid #dadce0', borderRadius:14, cursor:'pointer', fontFamily:'Google Sans, Inter, sans-serif', fontSize:'1rem', fontWeight:600, color:'#3c4043', boxShadow:'0 2px 12px rgba(0,0,0,.12)', transition:'box-shadow .2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.18)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,.12)'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          {/* What you'll see */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10, maxWidth:600, width:'100%' }}>
            {['Fattoush SM Marketing','beWAXed','Sewaro Craft Salon','Tip & Toe – Chennai','Scale Up','Sagar Rehab'].map((name,i) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10 }}>
                <div style={{ width:28, height:28, borderRadius:7, background:SPACE_COLORS[i%SPACE_COLORS.length], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.72rem', flexShrink:0 }}>{name[0]}</div>
                <span style={{ fontSize:'.78rem', color:'var(--muted2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6 }}>
            Your messages stay in Google. We only read them to show here.
          </p>
        </div>
      </Layout>
    );
  }

  // ── SIGNED IN TO GOOGLE ────────────────────────────────────
  return (
    <Layout noPadding>
      <div style={{ display:'flex', height:'calc(100dvh - 60px)', overflow:'hidden', fontFamily:'Google Sans, Inter, Arial, sans-serif' }}>

        {/* ── SIDEBAR ───────────────────────────────────────── */}
        <div style={{ width:280, minWidth:280, background:'#111827', borderRight:'1px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', flexShrink:0 }}>

          {/* Account badge */}
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#1A73E8,#00AC47)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, flexShrink:0 }}>
                {(session?.user?.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'.82rem', fontWeight:700, color:'#e8eaed', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session?.user?.name || 'Google User'}</div>
                <div style={{ fontSize:'.7rem', color:'#00AC47' }}>● {session?.user?.email}</div>
              </div>
              <button onClick={() => signIn('google', { callbackUrl:'/chat' })}
                title="Switch account"
                style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:6, padding:'4px 8px', color:'#9aa0a6', cursor:'pointer', fontSize:'.7rem', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                Switch
              </button>
            </div>

            {/* Search */}
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9aa0a6', fontSize:'.82rem' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search spaces"
                style={{ width:'100%', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:'7px 12px 7px 30px', fontSize:'.82rem', color:'#e8eaed', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}/>
            </div>
          </div>

          {/* Nav tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,.08)', flexShrink:0 }}>
            {[['spaces','Spaces'],['dm','DMs']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ flex:1, padding:'10px', background:'transparent', border:'none', color: view===v ? '#8ab4f8' : '#9aa0a6', fontSize:'.78rem', fontWeight: view===v ? 700 : 500, cursor:'pointer', fontFamily:'inherit', borderBottom: view===v ? '2px solid #1A73E8' : '2px solid transparent' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Space / DM list */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {loading && (
              <div style={{ padding:'24px', textAlign:'center', color:'#9aa0a6' }}>
                <Spinner size={20}/><div style={{ marginTop:8, fontSize:'.8rem' }}>Loading…</div>
              </div>
            )}

            {!loading && view === 'spaces' && (
              <>
                {filteredSpaces.length === 0 && !spaceError && (
                  <div style={{ padding:'20px 16px', fontSize:'.8rem', color:'#9aa0a6', textAlign:'center', lineHeight:1.6 }}>
                    No spaces found.<br/>
                    <a href="https://chat.google.com" target="_blank" rel="noopener noreferrer" style={{ color:'#8ab4f8' }}>Open Google Chat ↗</a><br/>to create spaces.
                  </div>
                )}
                {spaceError && (
                  <div style={{ padding:'16px', fontSize:'.75rem', color:'#EA4335', lineHeight:1.7, background:'rgba(234,67,53,.06)', margin:'8px', borderRadius:8, border:'1px solid rgba(234,67,53,.2)' }}>
                    <div style={{ fontWeight:700, marginBottom:4 }}>⚠️ Could not load spaces</div>
                    <div style={{ color:'#9aa0a6', marginBottom:8 }}>{spaceError}</div>
                    <div style={{ color:'#9aa0a6', fontSize:'.7rem', lineHeight:1.6 }}>
                      Fix: In Google Cloud Console → APIs &amp; Services → Enable <strong style={{ color:'#e8eaed' }}>Google Chat API</strong>. Then sign out and sign in again.
                    </div>
                    <button onClick={() => { setSpaceError(''); loadSpaces(); }}
                      style={{ marginTop:8, padding:'5px 12px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:6, color:'#e8eaed', cursor:'pointer', fontSize:'.72rem', fontFamily:'inherit' }}>
                      Retry
                    </button>
                  </div>
                )}
                {filteredSpaces.map(space => {
                  const name  = space.displayName || space.name;
                  const color = spaceColor(name);
                  const isActive = activeSpace?.name === space.name;
                  return (
                    <button key={space.name} onClick={() => openSpace(space)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background: isActive ? 'rgba(26,115,232,.2)' : 'transparent', border:'none', cursor:'pointer', color:'#e8eaed', fontFamily:'inherit', fontSize:'.85rem', textAlign:'left', transition:'background .12s' }}
                      onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='rgba(255,255,255,.06)'; }}
                      onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent'; }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.78rem', flexShrink:0 }}>
                        {name.slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight: isActive?700:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'.84rem' }}>{name}</div>
                        {space.memberCount && <div style={{ fontSize:'.68rem', color:'#9aa0a6' }}>{space.memberCount} members</div>}
                      </div>
                      {isActive && <div style={{ width:6, height:6, borderRadius:'50%', background:'#1A73E8', flexShrink:0 }}/>}
                    </button>
                  );
                })}
              </>
            )}

            {!loading && view === 'dm' && (
              <div style={{ padding:'8px 0' }}>
                <div style={{ padding:'6px 16px', fontSize:'.68rem', fontWeight:700, color:'#9aa0a6', textTransform:'uppercase', letterSpacing:'.1em' }}>Direct Messages</div>
                {spaces.filter(s => s.spaceType === 'DIRECT_MESSAGE' || s.type === 'DIRECT_MESSAGE').map(dm => {
                  const name = dm.displayName || 'Direct Message';
                  const color = spaceColor(name);
                  const isActive = activeSpace?.name === dm.name;
                  return (
                    <button key={dm.name} onClick={() => openSpace(dm)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background: isActive ? 'rgba(26,115,232,.2)' : 'transparent', border:'none', cursor:'pointer', color:'#e8eaed', fontFamily:'inherit', fontSize:'.85rem', textAlign:'left' }}
                      onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='rgba(255,255,255,.06)'; }}
                      onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent'; }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.78rem', flexShrink:0 }}>
                        {name[0]?.toUpperCase()}
                      </div>
                      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
                    </button>
                  );
                })}
                {spaces.filter(s => s.spaceType === 'DIRECT_MESSAGE' || s.type === 'DIRECT_MESSAGE').length === 0 && (
                  <div style={{ padding:'16px', fontSize:'.8rem', color:'#9aa0a6', textAlign:'center' }}>No DMs found</div>
                )}
              </div>
            )}
          </div>

          {/* Sign out Google */}
          <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,.08)', flexShrink:0 }}>
            <button onClick={() => signOut({ callbackUrl:'/chat' })}
              style={{ width:'100%', padding:'8px', background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.2)', borderRadius:8, color:'#EA4335', cursor:'pointer', fontSize:'.78rem', fontWeight:600, fontFamily:'inherit' }}>
              Sign out of Google
            </button>
          </div>
        </div>

        {/* ── MAIN AREA ─────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#0f1117', minWidth:0 }}>

          {/* No space selected */}
          {!activeSpace && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'#9aa0a6', padding:40, textAlign:'center' }}>
              <div style={{ fontSize:'3rem' }}>💬</div>
              <div style={{ fontWeight:700, fontSize:'1rem', color:'#e8eaed' }}>Select a space to start</div>
              <div style={{ fontSize:'.84rem', lineHeight:1.7, maxWidth:360 }}>
                Choose a space from the sidebar. Your messages are loaded directly from Google Chat.
              </div>
            </div>
          )}

          {/* Active space */}
          {activeSpace && (
            <>
              {/* Header */}
              <div style={{ padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'#111827' }}>
                <div style={{ width:36, height:36, borderRadius:9, background:spaceColor(activeSpace.displayName||activeSpace.name), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.9rem', flexShrink:0 }}>
                  {(activeSpace.displayName||activeSpace.name).slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.95rem', color:'#e8eaed' }}>{activeSpace.displayName || activeSpace.name}</div>
                  <div style={{ fontSize:'.7rem', color:'#9aa0a6' }}>{messages.length} messages loaded</div>
                </div>
                <a href={'https://chat.google.com/room/' + activeSpace.name?.split('/')[1]} target="_blank" rel="noopener noreferrer"
                  style={{ padding:'5px 12px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#9aa0a6', textDecoration:'none', fontSize:'.75rem', fontWeight:600, fontFamily:'inherit' }}>
                  ↗ Open in Google Chat
                </a>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                {loadMsgs && (
                  <div style={{ textAlign:'center', color:'#9aa0a6', padding:24 }}><Spinner size={20}/></div>
                )}
                {!loadMsgs && messages.length === 0 && (
                  <div style={{ textAlign:'center', color:'#9aa0a6', padding:'40px 0', fontSize:'.88rem' }}>No messages yet</div>
                )}
                {messages.map((msg, i) => {
                  const isMe    = msg.sender?.name?.includes(session?.user?.email?.replace('@','_').replace('.','_'));
                  const name    = msg.sender?.displayName || 'Unknown';
                  const content = msg.text || msg.formattedText || '';
                  const prevMsg = messages[i-1];
                  const showSender = !prevMsg || prevMsg.sender?.name !== msg.sender?.name;
                  return (
                    <div key={msg.name || i} style={{ marginBottom: showSender ? 14 : 4 }}>
                      {showSender && (
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:spaceColor(name), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.72rem', flexShrink:0 }}>
                            {name[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize:'.78rem', fontWeight:700, color:'#e8eaed' }}>{name}</span>
                          <span style={{ fontSize:'.66rem', color:'#9aa0a6' }}>{msg.createTime ? fullTime(msg.createTime) : ''}</span>
                        </div>
                      )}
                      <div style={{ paddingLeft: showSender ? 0 : 36, display:'flex', flexDirection:'column', gap:4 }}>
                        {content && (
                          <div style={{ background:'rgba(255,255,255,.06)', borderRadius:12, padding:'9px 14px', display:'inline-block', maxWidth:'75%', fontSize:'.86rem', lineHeight:1.5, color:'#e8eaed', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                            {content}
                          </div>
                        )}
                        {/* Attachments */}
                        {msg.attachment?.map((att, ai) => (
                          <div key={ai} style={{ background:'rgba(255,255,255,.06)', borderRadius:10, padding:'8px 12px', display:'inline-flex', alignItems:'center', gap:8, fontSize:'.8rem', color:'#8ab4f8' }}>
                            📎 {att.displayName || 'Attachment'}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,.08)', display:'flex', gap:10, alignItems:'flex-end', flexShrink:0, background:'#111827' }}>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={`Message ${activeSpace.displayName || 'this space'}…`}
                  rows={1}
                  style={{ flex:1, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:24, padding:'10px 16px', fontSize:'.87rem', color:'#e8eaed', fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto' }}
                  onFocus={e => e.target.style.borderColor='#1A73E8'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,.12)'}
                  onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                />
                <button onClick={send} disabled={sending || !text.trim()}
                  style={{ background: text.trim() ? '#1A73E8' : 'rgba(26,115,232,.3)', border:'none', borderRadius:10, padding:'9px 16px', color:'#fff', cursor: text.trim() ? 'pointer' : 'default', fontSize:'1rem', flexShrink:0, lineHeight:1, transition:'background .15s' }}>
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
