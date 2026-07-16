import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { Avatar, MEMBER_COLORS } from '../components/UI';

async function api(url, method='GET', body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

function fullTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}

const SPACE_COLORS = ['#00AC47','#1A73E8','#EA4335','#FBBC04','#9C27B0','#FF6D00','#00BCD4','#E91E63'];

export default function Chat() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const userId   = session?.user?.id;
  const userName = session?.user?.name || session?.user?.email || 'You';
  const isAdmin  = session?.user?.role === 'admin';

  const [spaces,       setSpaces]       = useState([]);
  const [activeSpace,  setActiveSpace]  = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [members,      setMembers]      = useState([]);
  const [allMembers,   setAllMembers]   = useState([]);
  const [text,         setText]         = useState('');
  const [sending,      setSending]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [newSpace,     setNewSpace]     = useState(false);
  const [spaceName,    setSpaceName]    = useState('');
  const [selectedUsers,setSelectedUsers]= useState([]);
  const [manageOpen,   setManageOpen]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [mediaFile,    setMediaFile]    = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);

  const sinceRef  = useRef(null);
  const pollRef   = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);

  // Load spaces + members
  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([api('/api/chat'), api('/api/members')]).then(([s, m]) => {
      setSpaces(Array.isArray(s) ? s : []);
      setAllMembers(Array.isArray(m) ? m : []);
      setLoading(false);
    });
  }, [status]);

  // Open a space
  const openSpace = useCallback(async (space) => {
    setActiveSpace(space);
    setMessages([]);
    setManageOpen(false);
    setLoadingMsgs(true);
    if (pollRef.current) clearInterval(pollRef.current);

    const [msgs, mems] = await Promise.all([
      api('/api/chat?room=' + space.id),
      api('/api/chat?members=' + space.id),
    ]);
    setMessages(Array.isArray(msgs) ? msgs : []);
    setMembers(Array.isArray(mems) ? mems : []);
    setLoadingMsgs(false);
    sinceRef.current = new Date().toISOString();

    // Poll for new messages every 3s
    pollRef.current = setInterval(async () => {
      if (!sinceRef.current) return;
      const newMsgs = await api('/api/chat?room=' + space.id + '&since=' + encodeURIComponent(sinceRef.current));
      sinceRef.current = new Date().toISOString();
      if (Array.isArray(newMsgs) && newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
      }
    }, 3000);

    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Send message
  async function send() {
    const content = text.trim();
    if (!content && !mediaFile) return;
    if (!activeSpace) return;
    setSending(true);

    let media_url = null, media_type = null;
    if (mediaFile) {
      media_url  = mediaFile.data;
      media_type = mediaFile.type;
      setMediaFile(null);
    }

    const msg = await api('/api/chat', 'POST', {
      room_id: activeSpace.id, content: content || null, media_url, media_type,
    });
    setSending(false);
    if (!msg.error) {
      const fullMsg = { ...msg, user_name: userName, user_image: session?.user?.image };
      setMessages(prev => { const ids = new Set(prev.map(m=>m.id)); return ids.has(fullMsg.id)?prev:[...prev,fullMsg]; });
      setText('');
      api('/api/chat').then(s => setSpaces(Array.isArray(s)?s:[]));
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8*1024*1024) { alert('Max 8MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
      setMediaFile({ data: ev.target.result, type, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Create space
  async function createSpace() {
    if (!spaceName.trim()) return;
    const allIds = [...new Set([userId, ...selectedUsers])];
    const room = await api('/api/chat', 'POST', {
      type: 'create_room', name: spaceName.trim(), memberIds: allIds,
    });
    if (!room.error) {
      const spaces = await api('/api/chat');
      setSpaces(Array.isArray(spaces) ? spaces : []);
      setNewSpace(false); setSpaceName(''); setSelectedUsers([]);
      openSpace(room);
    }
  }

  async function deleteSpace(id) {
    if (!confirm('Delete this space?')) return;
    await api('/api/chat?room=' + id, 'DELETE');
    setActiveSpace(null); setMessages([]);
    api('/api/chat').then(s => setSpaces(Array.isArray(s)?s:[]));
  }

  // Group consecutive messages by same sender
  function groupMsgs(msgs) {
    const groups = [];
    let cur = null;
    msgs.forEach(m => {
      const key = m.user_id + '|' + (m.created_at ? String(m.created_at).slice(0,16) : '');
      if (!cur || cur.key !== key) {
        cur = { key, user_id:m.user_id, user_name:m.user_name, user_image:m.user_image, msgs:[] };
        groups.push(cur);
      }
      cur.msgs.push(m);
    });
    return groups;
  }

  const filteredSpaces = spaces.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <Layout noPadding>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'calc(100dvh - 60px)', gap:12, color:'var(--muted2)', fontSize:'.9rem' }}>
        <div style={{ animation:'spin 1s linear infinite', fontSize:'1.5rem' }}>⟳</div> Loading spaces…
      </div>
    </Layout>
  );

  return (
    <Layout noPadding>
      <div style={{ display:'flex', height:'calc(100dvh - 60px)', overflow:'hidden', fontFamily:'Google Sans, Inter, Arial, sans-serif' }}>

        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <div style={{
          width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
          background:'#1a1a2a', borderRight:'1px solid rgba(255,255,255,.08)',
          display:'flex', flexDirection:'column', flexShrink:0,
          transition:'width .2s, min-width .2s', overflow:'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{ padding:'16px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:'1.15rem', fontWeight:800, color:'#fff' }}>💬 Chat</div>
            </div>
            <button onClick={() => setNewSpace(true)}
              style={{ background:'#1A73E8', border:'none', borderRadius:20, padding:'6px 14px', color:'#fff', fontSize:'.75rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              + New space
            </button>
          </div>

          {/* Search */}
          <div style={{ padding:'0 12px 12px' }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9aa0a6', fontSize:'.85rem' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search spaces"
                style={{ width:'100%', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:'8px 12px 8px 32px', fontSize:'.82rem', color:'#e8eaed', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.background='rgba(255,255,255,.12)'}
                onBlur={e => e.target.style.background='rgba(255,255,255,.08)'}
              />
            </div>
          </div>

          {/* Spaces list */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {/* Shortcuts */}
            <div style={{ padding:'4px 8px 2px 16px', fontSize:'.7rem', fontWeight:600, color:'#9aa0a6', textTransform:'uppercase', letterSpacing:'.08em' }}>Shortcuts</div>
            {[{ id:'home', name:'Home', icon:'🏠' }, { id:'mentions', name:'Mentions', icon:'@' }].map(item => (
              <button key={item.id}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'8px 16px', background:'transparent', border:'none', cursor:'pointer', color:'#e8eaed', fontFamily:'inherit', fontSize:'.85rem', textAlign:'left' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.06)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.85rem', flexShrink:0 }}>{item.icon}</span>
                {item.name}
              </button>
            ))}

            {/* Direct messages */}
            <div style={{ padding:'12px 8px 2px 16px', fontSize:'.7rem', fontWeight:600, color:'#9aa0a6', textTransform:'uppercase', letterSpacing:'.08em' }}>Direct messages</div>
            {allMembers.filter(m => m.id !== userId).slice(0,5).map((m, i) => {
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
              return (
                <button key={m.id}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'8px 16px', background:'transparent', border:'none', cursor:'pointer', color:'#e8eaed', fontFamily:'inherit', fontSize:'.85rem', textAlign:'left' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.06)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <Avatar name={m.name||m.email} image={m.image} size={28} color={color}/>
                    <div style={{ position:'absolute', bottom:0, right:0, width:8, height:8, borderRadius:'50%', background:'#00AC47', border:'1.5px solid #1a1a2a' }}/>
                  </div>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name||m.email?.split('@')[0]}</span>
                </button>
              );
            })}

            {/* Spaces */}
            <div style={{ padding:'12px 8px 2px 16px', fontSize:'.7rem', fontWeight:600, color:'#9aa0a6', textTransform:'uppercase', letterSpacing:'.08em' }}>Spaces</div>
            {filteredSpaces.length === 0 && (
              <div style={{ padding:'16px', fontSize:'.8rem', color:'#9aa0a6', textAlign:'center', lineHeight:1.6 }}>
                No spaces yet.<br/>Create one for each brand!
              </div>
            )}
            {filteredSpaces.map((space, i) => {
              const isActive = activeSpace?.id === space.id;
              const color = SPACE_COLORS[space.name.charCodeAt(0) % SPACE_COLORS.length];
              return (
                <button key={space.id} onClick={() => openSpace(space)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'8px 16px', background: isActive ? 'rgba(26,115,232,.25)' : 'transparent', border:'none', cursor:'pointer', color: isActive ? '#fff' : '#e8eaed', fontFamily:'inherit', fontSize:'.85rem', textAlign:'left', transition:'background .15s' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background='rgba(255,255,255,.06)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background='transparent'; }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.75rem', flexShrink:0 }}>
                    {space.name.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight: isActive ? 700 : 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{space.name}</div>
                    {space.last_message && <div style={{ fontSize:'.72rem', color:'#9aa0a6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{space.last_message}</div>}
                  </div>
                  {space.msg_count > 0 && <span style={{ fontSize:'.65rem', color:'#9aa0a6' }}>{space.msg_count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MAIN CHAT AREA ──────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#0d0d1a', minWidth:0 }}>

          {/* No space selected */}
          {!activeSpace && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, color:'#9aa0a6', padding:40, textAlign:'center' }}>
              <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#1A73E8,#00AC47)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem' }}>💬</div>
              <div>
                <div style={{ fontWeight:700, fontSize:'1.2rem', color:'#e8eaed', marginBottom:8 }}>Welcome to Chat</div>
                <div style={{ fontSize:'.87rem', lineHeight:1.7, maxWidth:360 }}>
                  Select a space from the sidebar to start chatting, or create a new space for each of your brand clients.
                </div>
              </div>
              <button onClick={() => setNewSpace(true)}
                style={{ padding:'11px 24px', background:'#1A73E8', border:'none', borderRadius:24, color:'#fff', fontSize:'.9rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                + Create your first space
              </button>
              {/* Brand space suggestions */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', maxWidth:500 }}>
                {['Fattoush', 'BeWAXed', 'Sewaro Craft', 'Scale Up', 'Your Socials Team'].map(name => (
                  <button key={name} onClick={() => { setSpaceName(name); setNewSpace(true); }}
                    style={{ padding:'6px 14px', background:'rgba(26,115,232,.15)', border:'1px solid rgba(26,115,232,.3)', borderRadius:20, color:'#8ab4f8', fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active space */}
          {activeSpace && (
            <>
              {/* Space header */}
              <div style={{ padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'#111122' }}>
                {/* Mobile back */}
                <button onClick={() => setSidebarOpen(true)} style={{ display:'none', background:'none', border:'none', color:'#9aa0a6', cursor:'pointer', fontSize:'1.2rem', padding:4 }} className="mobile-back">←</button>
                <div style={{ width:36, height:36, borderRadius:10, background:SPACE_COLORS[activeSpace.name.charCodeAt(0) % SPACE_COLORS.length], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'.9rem', flexShrink:0 }}>
                  {activeSpace.name.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.95rem', color:'#e8eaed' }}>{activeSpace.name}</div>
                  <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>{members.length} members</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setManageOpen(o=>!o)}
                    style={{ background:'none', border:'1px solid rgba(255,255,255,.15)', borderRadius:8, padding:'5px 12px', color:'#9aa0a6', cursor:'pointer', fontSize:'.78rem', fontFamily:'inherit' }}>
                    ⚙️ Manage
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteSpace(activeSpace.id)}
                      style={{ background:'rgba(234,67,53,.15)', border:'1px solid rgba(234,67,53,.3)', borderRadius:8, padding:'5px 10px', color:'#EA4335', cursor:'pointer', fontSize:'.78rem' }}>
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column' }}>
                {loadingMsgs && <div style={{ textAlign:'center', color:'#9aa0a6', padding:24 }}>Loading messages…</div>}
                {!loadingMsgs && messages.length === 0 && (
                  <div style={{ textAlign:'center', color:'#9aa0a6', padding:'40px 0' }}>
                    <div style={{ fontSize:'2rem', marginBottom:10 }}>👋</div>
                    <div style={{ fontSize:'.88rem' }}>No messages yet. Say hello!</div>
                  </div>
                )}
                {groupMsgs(messages).map((group, gi) => {
                  const isMe = group.user_id === userId;
                  const memberIdx = allMembers.findIndex(m => m.id === group.user_id);
                  const color = MEMBER_COLORS[memberIdx >= 0 ? memberIdx % MEMBER_COLORS.length : 0];
                  return (
                    <div key={group.key} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom:16 }}>
                      {/* Sender name + avatar */}
                      {!isMe && (
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, paddingLeft:4 }}>
                          <Avatar name={group.user_name||'?'} image={group.user_image} size={24} color={color}/>
                          <span style={{ fontSize:'.75rem', fontWeight:700, color }}>{group.user_name}</span>
                          <span style={{ fontSize:'.67rem', color:'#9aa0a6' }}>{timeLabel(group.msgs[0]?.created_at)}</span>
                        </div>
                      )}
                      {/* Message bubbles */}
                      {group.msgs.map((msg, mi) => (
                        <div key={msg.id} style={{ display:'flex', flexDirection: isMe?'row-reverse':'row', alignItems:'flex-end', gap:6, marginBottom:3, maxWidth:'72%' }}>
                          <div style={{
                            background: isMe ? '#1A73E8' : '#1e1e2e',
                            color: '#e8eaed',
                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            padding:'9px 14px',
                            maxWidth:'100%', wordBreak:'break-word',
                          }}>
                            {/* Media */}
                            {msg.media_url && msg.media_type === 'image' && (
                              <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.media_url} alt="" style={{ maxWidth:'100%', maxHeight:240, borderRadius:10, display:'block', marginBottom: msg.content?8:0 }}/>
                              </a>
                            )}
                            {msg.media_url && msg.media_type === 'video' && (
                              <video controls style={{ maxWidth:'100%', maxHeight:200, borderRadius:10, display:'block', marginBottom: msg.content?8:0 }}>
                                <source src={msg.media_url}/>
                              </video>
                            )}
                            {msg.media_url && msg.media_type === 'file' && (
                              <a href={msg.media_url} download style={{ display:'flex', alignItems:'center', gap:8, color: isMe?'rgba(255,255,255,.85)':'#8ab4f8', textDecoration:'none', fontSize:'.82rem', padding:'4px 0' }}>
                                📎 Download file
                              </a>
                            )}
                            {msg.content && <div style={{ fontSize:'.87rem', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{msg.content}</div>}
                            <div style={{ fontSize:'.63rem', opacity:.55, marginTop:4, textAlign:'right' }}>{fullTime(msg.created_at)}</div>
                          </div>
                          {/* Delete own message */}
                          {isMe && mi === group.msgs.length-1 && (
                            <button onClick={() => {
                              if (confirm('Delete?')) {
                                api('/api/chat?msg='+msg.id,'DELETE');
                                setMessages(p => p.filter(m=>m.id!==msg.id));
                              }
                            }} style={{ background:'none', border:'none', color:'#9aa0a6', cursor:'pointer', fontSize:'.72rem', padding:2, opacity:.4 }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Media preview */}
              {mediaFile && (
                <div style={{ padding:'8px 20px', background:'#111122', borderTop:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', gap:12 }}>
                  {mediaFile.type==='image' && <img src={mediaFile.data} style={{ height:56, borderRadius:8, objectFit:'cover' }}/>}
                  {mediaFile.type!=='image' && <div style={{ background:'rgba(255,255,255,.08)', borderRadius:8, padding:'8px 12px', fontSize:'.78rem', color:'#9aa0a6' }}>📎 {mediaFile.name}</div>}
                  <span style={{ flex:1, fontSize:'.75rem', color:'#9aa0a6' }}>Ready to send</span>
                  <button onClick={() => setMediaFile(null)} style={{ background:'rgba(234,67,53,.15)', border:'none', borderRadius:8, padding:'5px 10px', color:'#EA4335', cursor:'pointer', fontSize:'.78rem' }}>✕ Remove</button>
                </div>
              )}

              {/* Input */}
              <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,.08)', display:'flex', gap:10, alignItems:'flex-end', flexShrink:0, background:'#111122' }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:10, padding:'9px 12px', color:'#9aa0a6', cursor:'pointer', fontSize:'1rem', flexShrink:0, lineHeight:1 }}
                  title="Attach file">
                  📎
                  <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.zip" style={{ display:'none' }} onChange={handleFile}/>
                </button>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={`Message ${activeSpace.name}…`}
                  rows={1}
                  style={{ flex:1, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:24, padding:'10px 16px', fontSize:'.87rem', color:'#e8eaed', fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5, maxHeight:120, overflowY:'auto' }}
                  onFocus={e => e.target.style.borderColor='#1A73E8'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,.12)'}
                  onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                />
                <button onClick={send} disabled={sending||(!text.trim()&&!mediaFile)}
                  style={{ background:'#1A73E8', border:'none', borderRadius:10, padding:'9px 16px', color:'#fff', cursor: sending||(!text.trim()&&!mediaFile)?'default':'pointer', fontSize:'1rem', flexShrink:0, lineHeight:1, opacity: sending||(!text.trim()&&!mediaFile)?.45:1, transition:'opacity .15s' }}>
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── MANAGE PANEL (right side) ────────────────────── */}
        {activeSpace && manageOpen && (
          <div style={{ width:280, background:'#111122', borderLeft:'1px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, color:'#e8eaed', fontSize:'.92rem' }}>{activeSpace.name}</div>
              <button onClick={() => setManageOpen(false)} style={{ background:'none', border:'none', color:'#9aa0a6', cursor:'pointer', fontSize:'.9rem' }}>✕</button>
            </div>
            {/* Members */}
            <div style={{ padding:'14px 18px' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:'#9aa0a6', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Members ({members.length})</div>
              {members.map((m, i) => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <Avatar name={m.name||m.email} image={m.image} size={32} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.83rem', fontWeight:600, color:'#e8eaed' }}>{m.name||m.email?.split('@')[0]}</div>
                    <div style={{ fontSize:'.7rem', color:'#9aa0a6' }}>{m.job_title||m.role}</div>
                  </div>
                  {isAdmin && m.id !== userId && (
                    <button onClick={async () => {
                      await api('/api/chat','PATCH',{room_id:activeSpace.id,remove_user:m.id});
                      const mems = await api('/api/chat?members='+activeSpace.id);
                      setMembers(Array.isArray(mems)?mems:[]);
                    }} style={{ background:'rgba(234,67,53,.12)', border:'none', borderRadius:6, padding:'3px 8px', color:'#EA4335', cursor:'pointer', fontSize:'.7rem' }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
            {/* Add member */}
            {isAdmin && (
              <div style={{ padding:'0 18px 18px', borderTop:'1px solid rgba(255,255,255,.06)', paddingTop:14 }}>
                <div style={{ fontSize:'.7rem', fontWeight:700, color:'#9aa0a6', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Add member</div>
                {allMembers.filter(m => !members.some(mem=>mem.id===m.id)).map((m,i) => (
                  <button key={m.id} onClick={async () => {
                    await api('/api/chat','PATCH',{room_id:activeSpace.id,add_user:m.id});
                    const mems = await api('/api/chat?members='+activeSpace.id);
                    setMembers(Array.isArray(mems)?mems:[]);
                  }} style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'7px 10px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', marginBottom:6, transition:'background .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(26,115,232,.15)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}>
                    <Avatar name={m.name||m.email} image={m.image} size={26} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                    <span style={{ fontSize:'.81rem', color:'#e8eaed', fontWeight:500 }}>{m.name||m.email?.split('@')[0]}</span>
                    <span style={{ marginLeft:'auto', fontSize:'.7rem', color:'#8ab4f8', fontWeight:600 }}>+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CREATE SPACE MODAL ──────────────────────────────── */}
      {newSpace && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) { setNewSpace(false); setSpaceName(''); setSelectedUsers([]); } }}>
          <div style={{ background:'#1e1e2e', borderRadius:16, width:'100%', maxWidth:480, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.6)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:800, fontSize:'1rem', color:'#e8eaed' }}>Create a space</div>
              <button onClick={() => { setNewSpace(false); setSpaceName(''); setSelectedUsers([]); }} style={{ background:'none', border:'none', color:'#9aa0a6', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <input
                value={spaceName} onChange={e => setSpaceName(e.target.value)}
                placeholder="Space name (e.g. Fattoush, BeWAXed)"
                style={{ width:'100%', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, padding:'11px 14px', fontSize:'.9rem', color:'#e8eaed', fontFamily:'inherit', outline:'none', marginBottom:16, boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor='#1A73E8'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.15)'}
              />
              <div style={{ fontSize:'.75rem', fontWeight:600, color:'#9aa0a6', marginBottom:10, textTransform:'uppercase', letterSpacing:'.08em' }}>Add people</div>
              <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {allMembers.filter(m=>m.id!==userId).map((m,i) => {
                  const sel = selectedUsers.includes(m.id);
                  return (
                    <label key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background: sel?'rgba(26,115,232,.18)':'rgba(255,255,255,.04)', border:`1px solid ${sel?'#1A73E8':'rgba(255,255,255,.08)'}`, cursor:'pointer', transition:'all .15s' }}>
                      <input type="checkbox" checked={sel} onChange={e => {
                        if (e.target.checked) setSelectedUsers(p=>[...p,m.id]);
                        else setSelectedUsers(p=>p.filter(id=>id!==m.id));
                      }} style={{ accentColor:'#1A73E8', width:16, height:16 }}/>
                      <Avatar name={m.name||m.email} image={m.image} size={30} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                      <div>
                        <div style={{ fontSize:'.85rem', fontWeight:600, color:'#e8eaed' }}>{m.name||m.email?.split('@')[0]}</div>
                        <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>{m.job_title||m.role}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {selectedUsers.length > 0 && <div style={{ fontSize:'.75rem', color:'#8ab4f8', marginTop:8, fontWeight:600 }}>{selectedUsers.length} people selected</div>}
            </div>
            <div style={{ padding:'0 24px 20px', display:'flex', gap:10 }}>
              <button onClick={() => { setNewSpace(false); setSpaceName(''); setSelectedUsers([]); }}
                style={{ flex:1, padding:'10px', background:'rgba(255,255,255,.08)', border:'none', borderRadius:10, color:'#e8eaed', fontSize:'.88rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={createSpace} disabled={!spaceName.trim()}
                style={{ flex:2, padding:'10px', background: spaceName.trim()?'#1A73E8':'rgba(26,115,232,.3)', border:'none', borderRadius:10, color:'#fff', fontSize:'.88rem', fontWeight:700, cursor: spaceName.trim()?'pointer':'default', fontFamily:'inherit' }}>
                Create space 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
