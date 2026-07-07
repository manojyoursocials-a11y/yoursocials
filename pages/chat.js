import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { Avatar, Btn, Modal, Input, Spinner, toast, MEMBER_COLORS } from '../components/UI';

async function req(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined });
  return r.json();
}

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm';
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

function fullTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
}

const IMAGE_TYPES = ['image/jpeg','image/png','image/gif','image/webp'];
const VIDEO_TYPES = ['video/mp4','video/webm','video/quicktime'];

export default function Chat() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const userId  = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';

  const [rooms,        setRooms]       = useState([]);
  const [activeRoom,   setActiveRoom]  = useState(null);
  const [messages,     setMessages]    = useState([]);
  const [members,      setMembers]     = useState([]);
  const [allMembers,   setAllMembers]  = useState([]);
  const [text,         setText]        = useState('');
  const [sending,      setSending]     = useState(false);
  const [loading,      setLoading]     = useState(true);
  const [loadingMsgs,  setLoadingMsgs] = useState(false);
  const [createModal,  setCreateModal] = useState(false);
  const [manageModal,  setManageModal] = useState(false);
  const [newRoomName,  setNewRoomName] = useState('');
  const [selectedUsers,setSelectedUsers] = useState([]);
  const [mediaPreview, setMediaPreview] = useState(null); // {url, type, file}
  const [showSidebar,  setShowSidebar] = useState(true);

  const sinceRef   = useRef(null);
  const bottomRef  = useRef(null);
  const pollRef    = useRef(null);
  const inputRef   = useRef(null);
  const fileRef    = useRef(null);

  // Load rooms and all members on mount
  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([req('/api/chat'), req('/api/members')]).then(([r, m]) => {
      setRooms(Array.isArray(r) ? r : []);
      setAllMembers(Array.isArray(m) ? m : []);
      setLoading(false);
    });
  }, [status]);

  // Open a room
  const openRoom = useCallback(async (room) => {
    setActiveRoom(room);
    setMessages([]);
    setLoadingMsgs(true);
    if (pollRef.current) clearInterval(pollRef.current);
    sinceRef.current = null;

    const [msgs, mems] = await Promise.all([
      req('/api/chat?room=' + room.id),
      req('/api/chat?members=' + room.id),
    ]);
    setMessages(Array.isArray(msgs) ? msgs : []);
    setMembers(Array.isArray(mems) ? mems : []);
    setLoadingMsgs(false);

    // Set since to now for polling
    sinceRef.current = new Date().toISOString();

    // Poll for new messages every 3 seconds
    pollRef.current = setInterval(async () => {
      if (!sinceRef.current) return;
      const newMsgs = await req('/api/chat?room=' + room.id + '&since=' + encodeURIComponent(sinceRef.current));
      sinceRef.current = new Date().toISOString();
      if (Array.isArray(newMsgs) && newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
      }
    }, 3000);

    // On mobile, hide sidebar when room is open
    if (window.innerWidth < 768) setShowSidebar(false);
  }, []);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  // Send text message
  async function sendMessage() {
    const content = text.trim();
    if (!content && !mediaPreview) return;
    if (!activeRoom) return;
    setSending(true);

    let media_url  = null;
    let media_type = null;

    // Upload media as base64
    if (mediaPreview) {
      media_url  = mediaPreview.url;   // base64 data URL stored directly
      media_type = mediaPreview.type;
      setMediaPreview(null);
    }

    const payload = { room_id: activeRoom.id, content: content || null, media_url, media_type };
    const msg = await req('/api/chat', 'POST', payload);
    setSending(false);
    if (msg.error) { toast.error(msg.error); return; }

    // Optimistic update
    const myMsg = { ...msg, user_name: session?.user?.name, user_image: session?.user?.image };
    setMessages(prev => { const ids = new Set(prev.map(m=>m.id)); return ids.has(myMsg.id)?prev:[...prev,myMsg]; });
    setText('');
    inputRef.current?.focus();

    // Update room list
    req('/api/chat').then(r => setRooms(Array.isArray(r)?r:[]));
  }

  // Handle Enter key
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // File pick
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('File must be under 8MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const isImg = IMAGE_TYPES.includes(file.type);
      const isVid = VIDEO_TYPES.includes(file.type);
      setMediaPreview({ url: ev.target.result, type: isImg ? 'image' : isVid ? 'video' : 'file', name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Create room
  async function createRoom() {
    if (!newRoomName.trim()) { toast.error('Group name required'); return; }
    if (selectedUsers.length === 0) { toast.error('Add at least one member'); return; }
    const r = await req('/api/chat', 'POST', { type:'create_room', name: newRoomName.trim(), memberIds: selectedUsers });
    if (r.error) { toast.error(r.error); return; }
    toast.success('Group created! 🎉');
    setCreateModal(false); setNewRoomName(''); setSelectedUsers([]);
    const rooms = await req('/api/chat');
    setRooms(Array.isArray(rooms) ? rooms : []);
    openRoom(r);
  }

  // Delete room
  async function deleteRoom(room) {
    if (!confirm('Delete "' + room.name + '"? All messages will be lost.')) return;
    await req('/api/chat?room=' + room.id, 'DELETE');
    setActiveRoom(null); setMessages([]);
    req('/api/chat').then(r => setRooms(Array.isArray(r)?r:[]));
    toast.info('Group deleted');
  }

  // Group messages by sender + minute
  function groupMessages(msgs) {
    const groups = [];
    let cur = null;
    msgs.forEach(m => {
      const key = m.user_id + '|' + (m.created_at ? new Date(m.created_at).toISOString().slice(0,16) : '');
      if (!cur || cur.key !== key) {
        cur = { key, user_id:m.user_id, user_name:m.user_name, user_image:m.user_image, msgs:[] };
        groups.push(cur);
      }
      cur.msgs.push(m);
    });
    return groups;
  }

  if (loading) return (
    <Layout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
        <Spinner size={28}/><span style={{color:'var(--muted2)'}}>Loading chat…</span>
      </div>
    </Layout>
  );

  const msgGroups = groupMessages(messages);

  return (
    <Layout>
      <div style={{display:'flex',height:'calc(100dvh - 100px)',gap:0,borderRadius:16,overflow:'hidden',border:'1px solid var(--border)'}}>

        {/* ── LEFT: Room list ───────────────────────── */}
        {(showSidebar || !activeRoom) && (
          <div style={{width:280,minWidth:280,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0}}>
            {/* Header */}
            <div style={{padding:'14px 14px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontWeight:800,fontSize:'.95rem'}}>💬 Chat</div>
              <Btn size="sm" onClick={()=>setCreateModal(true)}>+ Group</Btn>
            </div>

            {/* Room list */}
            <div style={{flex:1,overflowY:'auto'}}>
              {rooms.length === 0 && (
                <div style={{padding:'32px 16px',textAlign:'center',color:'var(--muted)'}}>
                  <div style={{fontSize:'2rem',marginBottom:10}}>💬</div>
                  <div style={{fontSize:'.82rem',fontWeight:600,marginBottom:6}}>No groups yet</div>
                  <div style={{fontSize:'.75rem',marginBottom:16,lineHeight:1.5}}>Create a group and start chatting with your team</div>
                  <Btn size="sm" onClick={()=>setCreateModal(true)}>+ Create Group</Btn>
                </div>
              )}
              {rooms.map((room, i) => {
                const isActive = activeRoom?.id === room.id;
                return (
                  <div key={room.id}
                    onClick={() => openRoom(room)}
                    style={{padding:'11px 14px',cursor:'pointer',background:isActive?'rgba(124,92,252,.12)':'transparent',borderLeft:`3px solid ${isActive?'var(--purple)':'transparent'}`,transition:'all .15s',display:'flex',gap:11,alignItems:'center'}}
                    onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='var(--surface2)'}}
                    onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent'}}>
                    <div style={{width:42,height:42,borderRadius:12,background:`hsl(${(room.name.charCodeAt(0)*7)%360},45%,35%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0,fontWeight:800,color:'#fff'}}>
                      {room.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'.85rem',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{room.name}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {room.last_message || 'No messages yet'}
                      </div>
                    </div>
                    <div style={{fontSize:'.65rem',color:'var(--muted)',flexShrink:0}}>{timeLabel(room.last_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RIGHT: Chat window ────────────────────── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',background:'var(--surface2)',minWidth:0}}>
          {!activeRoom ? (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,color:'var(--muted)',padding:32}}>
              <div style={{fontSize:'3rem'}}>💬</div>
              <div style={{fontWeight:700,fontSize:'1.1rem'}}>Select a group to start chatting</div>
              <div style={{fontSize:'.82rem',opacity:.7}}>Create groups for your team, clients, or projects</div>
              <Btn onClick={()=>setCreateModal(true)}>+ Create Group</Btn>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,flexShrink:0,background:'var(--surface)'}}>
                {/* Back on mobile */}
                <button onClick={()=>setShowSidebar(true)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'1.2rem',padding:4,display:window?.innerWidth<768?'flex':'none',alignItems:'center'}}>←</button>
                <div style={{width:38,height:38,borderRadius:10,background:`hsl(${(activeRoom.name.charCodeAt(0)*7)%360},45%,35%)`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',flexShrink:0}}>
                  {activeRoom.name.slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:'.9rem'}}>{activeRoom.name}</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted)'}}>{members.length} members · {messages.length} messages</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <Btn variant="ghost" size="sm" onClick={()=>setManageModal(true)}>⚙️ Manage</Btn>
                  {isAdmin && <Btn variant="danger" size="sm" onClick={()=>deleteRoom(activeRoom)}>🗑</Btn>}
                </div>
              </div>

              {/* Messages */}
              <div style={{flex:1,overflowY:'auto',padding:'16px 18px',display:'flex',flexDirection:'column',gap:0}}>
                {loadingMsgs && <div style={{display:'flex',justifyContent:'center',padding:24}}><Spinner size={22}/></div>}
                {!loadingMsgs && messages.length===0 && (
                  <div style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                    <div style={{fontSize:'2rem',marginBottom:10}}>👋</div>
                    <div style={{fontSize:'.85rem'}}>No messages yet — say hello!</div>
                  </div>
                )}
                {msgGroups.map((group, gi) => {
                  const isMe = group.user_id === userId;
                  const color = MEMBER_COLORS[allMembers.findIndex(m=>m.id===group.user_id) % MEMBER_COLORS.length] || '#7C5CFC';
                  return (
                    <div key={group.key} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',marginBottom:14}}>
                      {/* Sender info */}
                      {!isMe && (
                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5,paddingLeft:4}}>
                          <Avatar name={group.user_name||'?'} image={group.user_image} size={22} color={color}/>
                          <span style={{fontSize:'.72rem',fontWeight:700,color}}>{group.user_name}</span>
                        </div>
                      )}
                      {/* Message bubbles */}
                      {group.msgs.map((msg, mi) => (
                        <div key={msg.id} style={{display:'flex',alignItems:'flex-end',gap:6,flexDirection:isMe?'row-reverse':'row',marginBottom:3,maxWidth:'75%'}}>
                          <div style={{background:isMe?'var(--purple)':'var(--surface3)',color:isMe?'#fff':'var(--text)',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'9px 14px',maxWidth:'100%',wordBreak:'break-word'}}>
                            {/* Media */}
                            {msg.media_url && msg.media_type === 'image' && (
                              <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.media_url} alt="media" style={{maxWidth:'100%',maxHeight:240,borderRadius:10,display:'block',marginBottom:msg.content?8:0}}/>
                              </a>
                            )}
                            {msg.media_url && msg.media_type === 'video' && (
                              <video controls style={{maxWidth:'100%',maxHeight:200,borderRadius:10,display:'block',marginBottom:msg.content?8:0}}>
                                <source src={msg.media_url}/>
                              </video>
                            )}
                            {msg.media_url && msg.media_type === 'file' && (
                              <a href={msg.media_url} download style={{display:'flex',alignItems:'center',gap:8,color:isMe?'rgba(255,255,255,.85)':'var(--purple2)',textDecoration:'none',fontSize:'.8rem',padding:'4px 0'}}>
                                📎 Download file
                              </a>
                            )}
                            {/* Text */}
                            {msg.content && <div style={{fontSize:'.85rem',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{msg.content}</div>}
                            <div style={{fontSize:'.62rem',opacity:.6,marginTop:4,textAlign:'right'}}>{fullTime(msg.created_at)}</div>
                          </div>
                          {isMe && mi === group.msgs.length-1 && (
                            <button onClick={()=>{ if(confirm('Delete this message?')) req('/api/chat?msg='+msg.id,'DELETE').then(()=>setMessages(p=>p.filter(m=>m.id!==msg.id))); }}
                              style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'.7rem',padding:2,opacity:.4,flexShrink:0}}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Media preview bar */}
              {mediaPreview && (
                <div style={{padding:'8px 18px',background:'var(--surface)',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
                  {mediaPreview.type === 'image' && <img src={mediaPreview.url} style={{height:60,borderRadius:8,objectFit:'cover'}}/>}
                  {mediaPreview.type === 'video' && <div style={{background:'var(--surface3)',borderRadius:8,padding:'8px 12px',fontSize:'.78rem'}}>🎬 {mediaPreview.name}</div>}
                  {mediaPreview.type === 'file'  && <div style={{background:'var(--surface3)',borderRadius:8,padding:'8px 12px',fontSize:'.78rem'}}>📎 {mediaPreview.name}</div>}
                  <div style={{flex:1,fontSize:'.75rem',color:'var(--muted2)'}}>Ready to send</div>
                  <button onClick={()=>setMediaPreview(null)} style={{background:'rgba(255,77,109,.15)',border:'none',borderRadius:8,padding:'5px 10px',color:'var(--red)',cursor:'pointer',fontSize:'.78rem'}}>✕ Remove</button>
                </div>
              )}

              {/* Input area */}
              <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',display:'flex',gap:10,alignItems:'flex-end',flexShrink:0,background:'var(--surface)'}}>
                {/* Attach file */}
                <button onClick={()=>fileRef.current?.click()}
                  style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:10,padding:'9px 12px',color:'var(--muted)',cursor:'pointer',fontSize:'1rem',flexShrink:0,lineHeight:1}}
                  title="Attach image or file">
                  📎
                  <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" style={{display:'none'}} onChange={handleFile}/>
                </button>
                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e=>setText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{flex:1,background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:12,padding:'10px 14px',fontSize:'.85rem',color:'var(--text)',fontFamily:'Inter,sans-serif',resize:'none',outline:'none',lineHeight:1.5,maxHeight:120,overflowY:'auto'}}
                  onFocus={e=>e.target.style.borderColor='var(--purple)'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.13)'}
                  onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                />
                {/* Send */}
                <button onClick={sendMessage} disabled={sending||(!text.trim()&&!mediaPreview)}
                  style={{background:'var(--purple)',border:'none',borderRadius:10,padding:'9px 16px',color:'#fff',cursor:sending?'wait':'pointer',fontSize:'1rem',flexShrink:0,lineHeight:1,opacity:(sending||(!text.trim()&&!mediaPreview))?.5:1,transition:'opacity .15s'}}>
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <Modal open={createModal} onClose={()=>{setCreateModal(false);setNewRoomName('');setSelectedUsers([]);}} title="Create Group" width={440}>
        <Input label="Group Name *" value={newRoomName} onChange={e=>setNewRoomName(e.target.value)} placeholder="e.g. Content Team, Fattoush Project"/>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:8,letterSpacing:'.04em'}}>ADD MEMBERS</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto'}}>
            {allMembers.filter(m=>m.id!==userId).map((m,i)=>{
              const sel = selectedUsers.includes(m.id);
              return (
                <label key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,background:sel?'rgba(124,92,252,.1)':'var(--surface3)',border:`1px solid ${sel?'var(--purple)':'var(--border)'}`,cursor:'pointer',transition:'all .15s'}}>
                  <input type="checkbox" checked={sel} onChange={e=>{ if(e.target.checked) setSelectedUsers(p=>[...p,m.id]); else setSelectedUsers(p=>p.filter(id=>id!==m.id)); }} style={{accentColor:'var(--purple)',width:16,height:16}}/>
                  <Avatar name={m.name||m.email} image={m.image} size={30} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                  <div>
                    <div style={{fontSize:'.83rem',fontWeight:600}}>{m.name||m.email?.split('@')[0]}</div>
                    <div style={{fontSize:'.7rem',color:'var(--muted)'}}>{m.job_title||m.role}</div>
                  </div>
                </label>
              );
            })}
          </div>
          {selectedUsers.length > 0 && <div style={{fontSize:'.72rem',color:'var(--purple2)',marginTop:8,fontWeight:600}}>{selectedUsers.length} member{selectedUsers.length>1?'s':''} selected (+ you)</div>}
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setCreateModal(false);setNewRoomName('');setSelectedUsers([]);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={createRoom} style={{flex:2}}>Create Group 🚀</Btn>
        </div>
      </Modal>

      {/* Manage Group Modal */}
      <Modal open={manageModal} onClose={()=>setManageModal(false)} title={'⚙️ ' + (activeRoom?.name||'Group')} width={420}>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:10,letterSpacing:'.04em'}}>MEMBERS ({members.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto'}}>
            {members.map((m,i)=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'var(--surface3)',borderRadius:10}}>
                <Avatar name={m.name||m.email} image={m.image} size={32} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'.82rem',fontWeight:600}}>{m.name||m.email?.split('@')[0]}</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted)'}}>{m.job_title||m.role}</div>
                </div>
                {isAdmin && m.id !== userId && (
                  <button onClick={async()=>{ await req('/api/chat','PATCH',{room_id:activeRoom.id,remove_user:m.id}); const mems=await req('/api/chat?members='+activeRoom.id); setMembers(Array.isArray(mems)?mems:[]); toast.info(m.name+' removed'); }}
                    style={{background:'rgba(255,77,109,.1)',border:'none',borderRadius:6,padding:'4px 8px',color:'var(--red)',cursor:'pointer',fontSize:'.72rem'}}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Add member */}
        {isAdmin && (
          <div>
            <div style={{fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:8,letterSpacing:'.04em'}}>ADD MEMBER</div>
            <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:140,overflowY:'auto'}}>
              {allMembers.filter(m=>!members.some(mem=>mem.id===m.id)).map((m,i)=>(
                <button key={m.id} onClick={async()=>{ await req('/api/chat','PATCH',{room_id:activeRoom.id,add_user:m.id}); const mems=await req('/api/chat?members='+activeRoom.id); setMembers(Array.isArray(mems)?mems:[]); toast.success(m.name+' added!'); }}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:9,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'border-color .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--purple)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.07)'}>
                  <Avatar name={m.name||m.email} image={m.image} size={26} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                  <span style={{fontSize:'.8rem',fontWeight:500,color:'var(--text)'}}>{m.name||m.email?.split('@')[0]}</span>
                  <span style={{marginLeft:'auto',fontSize:'.7rem',color:'var(--purple2)',fontWeight:600}}>+ Add</span>
                </button>
              ))}
              {allMembers.filter(m=>!members.some(mem=>mem.id===m.id)).length===0 && <div style={{fontSize:'.78rem',color:'var(--muted)',textAlign:'center',padding:'10px 0'}}>All members already in this group</div>}
            </div>
          </div>
        )}
        <div style={{marginTop:16}}>
          <Btn variant="ghost" onClick={()=>setManageModal(false)} style={{width:'100%'}}>Close</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
