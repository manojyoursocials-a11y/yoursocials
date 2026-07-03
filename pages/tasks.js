import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Select, Textarea, Tag, Avatar, Spinner, launchConfetti, toast, sounds, askAI } from '../components/UI';

const COLS = [
  { id:'todo',       label:'To Do',       emoji:'📋', color:'#9090AA' },
  { id:'inprogress', label:'In Progress',  emoji:'⚡', color:'#00D4FF' },
  { id:'review',     label:'Under Review', emoji:'👁️', color:'#FFD60A' },
  { id:'done',       label:'Done',         emoji:'✅', color:'#00E5A0' },
];
const PRI = { P1:'🔴 Critical', P2:'🟠 High', P3:'🟡 Medium', P4:'🟢 Low' };

const blank = () => ({ title:'', description:'', link:'', priority:'P3', owner_id:'', client_id:'', deadline:'', post_date:'', estimated_hours:'' });
const toUrl = s => s && !s.startsWith('http') ? 'https://'+s : s;

async function req(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  try { return await r.json(); } catch { return { error: 'Network error' }; }
}

export default function Tasks() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const userId  = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';

  const [tasks,    setTasks]    = useState([]);
  const [members,  setMembers]  = useState([]);
  const [clients,  setClients]  = useState([]);
  const [today,    setToday]    = useState([]);   // today's tasks panel
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [form,     setForm]     = useState(blank());
  const [checks,   setChecks]   = useState([]);
  const [aiLoad,   setAiLoad]   = useState(false);
  const [aiSugg,   setAiSugg]   = useState('');
  const [filter,   setFilter]   = useState('all');      // member filter
  const [clientF,  setClientF]  = useState('all');      // client filter
  const [statusF,  setStatusF]  = useState('all');      // status filter
  const [saving,   setSaving]   = useState(false);
  const [moving,   setMoving]   = useState('');
  const [showToday,setShowToday]= useState(true);

  const reload = useCallback(async () => {
    const [t, m, c, tod] = await Promise.all([
      req('/api/tasks'),
      req('/api/members'),
      req('/api/clients'),
      req('/api/tasks?today=1'),
    ]);
    setTasks(Array.isArray(t) ? t : []);
    setMembers(Array.isArray(m) ? m : []);
    setClients(Array.isArray(c) ? c : []);
    setToday(Array.isArray(tod) ? tod : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (status==='authenticated') reload(); }, [status, reload]);

  // Determine if current user can edit a task
  function canEdit(task) {
    if (!task) return false;
    if (isAdmin) return true;
    return task.created_by === userId || task.owner_id === userId;
  }

  function openCreate() { setEditing(null); setForm(blank()); setChecks([]); setModal(true); }

  function openEdit(task) {
    if (!canEdit(task)) { toast.error('Only the assigner or assignee can edit this task'); return; }
    setEditing(task);
    setForm({
      title:           task.title || '',
      description:     task.description || '',
      link:            task.link || '',
      priority:        task.priority || 'P3',
      owner_id:        task.owner_id || '',
      client_id:       task.client_id || '',
      deadline:        task.deadline ? String(task.deadline).slice(0,10) : '',
      post_date:       task.post_date ? String(task.post_date).slice(0,10) : '',
      estimated_hours: task.estimated_hours || '',
    });
    try { setChecks(JSON.parse(task.ai_checklist||'[]')); } catch { setChecks([]); }
    setDetail(null);
    setModal(true);
  }

  async function saveTask() {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    const payload = {
      title:           form.title.trim(),
      description:     form.description.trim(),
      link:            form.link.trim() ? toUrl(form.link.trim()) : null,
      priority:        form.priority || 'P3',
      owner_id:        form.owner_id || null,
      client_id:       form.client_id || null,
      deadline:        form.deadline || null,
      post_date:       form.post_date || null,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      ai_checklist:    JSON.stringify(checks),
    };
    let res;
    if (editing) {
      res = await req('/api/tasks','PATCH',{ id: editing.id, ...payload });
    } else {
      res = await req('/api/tasks','POST', payload);
    }
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editing ? 'Task saved!' : 'Task created! +10 🪙');
    sounds.pop();
    setModal(false); setEditing(null); setForm(blank()); setChecks([]);
    reload();
  }

  async function moveTask(taskId, newStatus) {
    if (moving) return;
    setMoving(taskId + newStatus);
    const r = await req('/api/tasks','PATCH',{ id: taskId, status: newStatus });
    setMoving('');
    if (r.error) { toast.error('Move failed: ' + r.error); reload(); return; }
    setDetail(prev => prev?.id === taskId ? {...prev, status: newStatus} : prev);
    setTasks(prev => prev.map(t => t.id===taskId ? {...t, status:newStatus} : t));
    if (newStatus==='done') { launchConfetti(); sounds.confetti(); toast.success('Done! +50 🪙 🎉'); }
    else { sounds.pop(); toast.info('Moved → ' + COLS.find(c=>c.id===newStatus)?.label); }
    reload();
  }

  async function deleteTask(id) {
    await req('/api/tasks?id='+id,'DELETE');
    setDetail(null); toast.info('Task deleted'); reload();
  }

  async function genChecklist() {
    if (!form.title) { toast.error('Enter a title first'); return; }
    setAiLoad(true);
    const r = await askAI('Generate 5-7 checklist steps for: "'+form.title+'". Return ONLY a numbered list, one step per line.');
    setChecks(r.split('\n').filter(l=>l.trim()).slice(0,7).map(l=>({ text:l.replace(/^\d+[\.\)]\s*/,'').trim(), done:false })));
    setAiLoad(false); sounds.pop();
  }

  async function getAiHelp(task) {
    setAiSugg('loading');
    const r = await askAI('3 practical suggestions for: "'+task.title+'" (Priority:'+task.priority+', Assignee:'+(task.owner_name||'?')+', Client:'+(task.client_name||'Internal')+')');
    setAiSugg(r);
  }

  // Apply filters
  let filtered = [...tasks];
  if (filter !== 'all')   filtered = filtered.filter(t => t.owner_id === filter);
  if (clientF !== 'all')  filtered = filtered.filter(t => t.client_id === clientF);
  if (statusF !== 'all')  filtered = filtered.filter(t => t.status === statusF);

  const todayStr = new Date().toISOString().split('T')[0];

  if (loading) return (
    <Layout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
        <Spinner size={28}/><span style={{color:'#9090AA'}}>Loading…</span>
      </div>
    </Layout>
  );

  return (
    <Layout badges={{ tasks: tasks.filter(t=>t.status==='todo').length }}>
      <div style={{display:'flex',height:'calc(100vh - 110px)',gap:16}}>

        {/* ── TODAY'S TASKS PANEL (left) ─────────────── */}
        {showToday && (
          <div style={{width:260,minWidth:260,background:'#16161F',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
            <div style={{padding:'13px 14px 10px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:800,fontSize:'.85rem',color:'#F0EFFF'}}>📅 Today</div>
                <div style={{fontSize:'.65rem',color:'#6B6B8A',marginTop:2}}>{today.length} tasks due/posting</div>
              </div>
              <button onClick={()=>setShowToday(false)} style={{background:'none',border:'none',color:'#6B6B8A',cursor:'pointer',fontSize:'.9rem'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:8}}>
              {today.length===0
                ? <div style={{textAlign:'center',padding:'24px 8px',color:'#6B6B8A',fontSize:'.78rem'}}>🎉 Nothing due today!</div>
                : today.map(t => {
                  const isPost = t.post_date && String(t.post_date).slice(0,10) === todayStr;
                  const isDead = t.deadline && String(t.deadline).slice(0,10) === todayStr;
                  return (
                    <div key={t.id} onClick={() => { setDetail(t); setAiSugg(''); }}
                      style={{padding:'9px 10px',borderRadius:9,marginBottom:6,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',cursor:'pointer',transition:'border-color .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#7C5CFC'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,.07)'}>
                      <div style={{fontSize:'.78rem',fontWeight:600,color:'#F0EFFF',marginBottom:4,lineHeight:1.3}}>{t.title}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <Tag text={t.priority}/>
                        {isPost && <span style={{fontSize:'.63rem',background:'rgba(124,92,252,.15)',color:'#9D7FFF',padding:'1px 6px',borderRadius:5,fontWeight:600}}>📤 Post</span>}
                        {isDead && <span style={{fontSize:'.63rem',background:'rgba(255,77,109,.15)',color:'#FF4D6D',padding:'1px 6px',borderRadius:5,fontWeight:600}}>⏰ Due</span>}
                      </div>
                      {t.owner_name && <div style={{fontSize:'.67rem',color:'#6B6B8A',marginTop:4}}>👤 {t.owner_name}</div>}
                      {t.client_name && <div style={{fontSize:'.67rem',color:'#6B6B8A'}}>🏢 {t.client_name}</div>}
                    </div>
                  );
                })
              }
            </div>
          </div>
        )}

        {/* ── MAIN BOARD ─────────────────────────────── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Toolbar */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
            {!showToday && (
              <button onClick={()=>setShowToday(true)} style={{padding:'6px 12px',background:'rgba(124,92,252,.12)',border:'1px solid rgba(124,92,252,.25)',borderRadius:8,color:'#9D7FFF',fontSize:'.76rem',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                📅 Today
              </button>
            )}
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={selStyle}>
              <option value="all">All members</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
            </select>
            <select value={clientF} onChange={e=>setClientF(e.target.value)} style={selStyle}>
              <option value="all">All clients</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={selStyle}>
              <option value="all">All statuses</option>
              {COLS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button onClick={openCreate} style={{marginLeft:'auto',padding:'8px 18px',background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:'.82rem',cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
              + New Task
            </button>
          </div>

          {/* Kanban columns */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,flex:1,overflow:'hidden'}}>
            {COLS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.id);
              return (
                <div key={col.id} style={{background:'#16161F',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                  <div style={{padding:'12px 12px 8px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                    <span style={{fontSize:'.8rem',fontWeight:700,color:col.color}}>{col.emoji} {col.label}</span>
                    <span style={{background:'#1C1C28',color:'#9090AA',fontSize:'.62rem',fontWeight:700,padding:'2px 7px',borderRadius:20}}>{colTasks.length}</span>
                  </div>
                  <div style={{flex:1,overflowY:'auto',padding:7,display:'flex',flexDirection:'column',gap:7}}>
                    {colTasks.length===0 && <div style={{color:'#6B6B8A',fontSize:'.72rem',textAlign:'center',padding:'16px 0'}}>No tasks</div>}
                    {colTasks.map(t => <TaskCard key={t.id} task={t} onClick={()=>{setDetail(t);setAiSugg('');}}/>)}
                  </div>
                  <button onClick={openCreate} style={{margin:7,padding:7,borderRadius:8,border:'1px dashed rgba(255,255,255,.1)',background:'transparent',color:'#6B6B8A',fontSize:'.73rem',cursor:'pointer',fontFamily:'Inter,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#7C5CFC';e.currentTarget.style.color='#9D7FFF';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.1)';e.currentTarget.style.color='#6B6B8A';}}>
                    + Add task
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CREATE / EDIT MODAL ─────────────────────── */}
        <Modal open={modal} onClose={()=>{setModal(false);setEditing(null);}} title={editing?'✏️ Edit Task':'+ New Task'} width={600}>
          <Input label="Title *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Instagram Reels — June Recap"/>
          <Textarea label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What needs to be done…"/>
          <Input label="Link (any URL)" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://drive.google.com/..."/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Select label="Priority" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
              {Object.entries(PRI).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </Select>
            <Select label="Assign To (Assignee)" value={form.owner_id} onChange={e=>setForm(f=>({...f,owner_id:e.target.value}))}>
              <option value="">Me</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
            </Select>
          </div>
          <Select label="Client" value={form.client_id} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))}>
            <option value="">Internal / No client</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <Input label="Post Date 📤" type="date" value={form.post_date} onChange={e=>setForm(f=>({...f,post_date:e.target.value}))}/>
            <Input label="Deadline ⏰" type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/>
            <Input label="Hours" type="number" min="0.5" step="0.5" value={form.estimated_hours} onChange={e=>setForm(f=>({...f,estimated_hours:e.target.value}))} placeholder="e.g. 3"/>
          </div>
          {checks.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:'.73rem',fontWeight:600,color:'#9090AA',marginBottom:8}}>🤖 AI Checklist</div>
              {checks.map((item,i)=>(
                <label key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:'.8rem',cursor:'pointer',color:'#9090AA',marginBottom:5}}>
                  <input type="checkbox" checked={item.done} onChange={e=>setChecks(c=>c.map((x,j)=>j===i?{...x,done:e.target.checked}:x))} style={{marginTop:2,accentColor:'#7C5CFC'}}/>
                  {item.text}
                </label>
              ))}
            </div>
          )}
          <div style={{display:'flex',gap:10}}>
            <Btn variant="ghost" onClick={genChecklist} disabled={aiLoad} style={{flex:1}}>{aiLoad?'⏳…':'🤖 AI Checklist'}</Btn>
            <Btn onClick={saveTask} disabled={saving} style={{flex:2}}>{saving?'Saving…':editing?'💾 Save Changes':'Create Task'}</Btn>
          </div>
        </Modal>

        {/* ── DETAIL MODAL ────────────────────────────── */}
        <Modal open={!!detail} onClose={()=>{setDetail(null);setAiSugg('');}} title={detail?.title||''} width={580}>
          {detail&&(()=>{
            const cur = detail.status;
            const editable = canEdit(detail);
            return (
              <>
                {/* Tags row */}
                <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
                  <Tag text={detail.priority}/>
                  <Tag text={cur}/>
                  {detail.client_name&&<span style={tagStyle}>🏢 {detail.client_name}</span>}
                  {detail.post_date&&<span style={{...tagStyle,background:'rgba(124,92,252,.12)',color:'#9D7FFF'}}>📤 Post: {String(detail.post_date).slice(0,10)}</span>}
                  {detail.deadline&&<span style={{...tagStyle,background:'rgba(255,77,109,.1)',color:'#FF4D6D'}}>⏰ Due: {String(detail.deadline).slice(0,10)}</span>}
                  {detail.estimated_hours&&<span style={tagStyle}>⏱ {detail.estimated_hours}h</span>}
                </div>

                {/* Assigner + Assignee — Feature #9 */}
                <div style={{display:'flex',gap:16,marginBottom:14,padding:'10px 14px',background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid rgba(255,255,255,.07)'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.65rem',fontWeight:700,color:'#6B6B8A',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>Assigner</div>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <Avatar name={detail.created_by_name||'?'} size={26} color="#FF5FA0"/>
                      <span style={{fontSize:'.8rem',fontWeight:600,color:'#F0EFFF'}}>{detail.created_by_name||'Unknown'}</span>
                    </div>
                  </div>
                  <div style={{width:1,background:'rgba(255,255,255,.08)'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.65rem',fontWeight:700,color:'#6B6B8A',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>Assignee</div>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <Avatar name={detail.owner_name||'?'} size={26} color="#7C5CFC"/>
                      <span style={{fontSize:'.8rem',fontWeight:600,color:'#F0EFFF'}}>{detail.owner_name||'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                {detail.description&&<p style={{fontSize:'.83rem',color:'#9090AA',lineHeight:1.6,marginBottom:14}}>{detail.description}</p>}
                {detail.link&&<div style={{marginBottom:14}}><a href={toUrl(detail.link)} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:'rgba(124,92,252,.12)',border:'1px solid rgba(124,92,252,.3)',borderRadius:8,fontSize:'.82rem',color:'#9D7FFF',textDecoration:'none',fontWeight:600}}>🔗 Open Link ↗</a></div>}

                {/* Move To — Feature #2: reassign resets to todo */}
                <div style={{marginBottom:14,padding:14,background:'rgba(255,255,255,.02)',borderRadius:12,border:'1px solid rgba(255,255,255,.07)'}}>
                  <div style={{fontSize:'.68rem',fontWeight:700,color:'#6B6B8A',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:10}}>Move to</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {COLS.map(col => {
                      const isCur = col.id===cur;
                      const isLoading = moving === detail.id+col.id;
                      return (
                        <button key={col.id} disabled={isCur||!!moving}
                          onClick={()=>moveTask(detail.id,col.id)}
                          style={{padding:'9px 12px',borderRadius:10,border:'1px solid '+(isCur?col.color+'66':'rgba(255,255,255,.09)'),background:isCur?col.color+'1A':'rgba(255,255,255,.02)',color:isCur?col.color:'#9090AA',fontSize:'.8rem',fontWeight:isCur?700:500,cursor:isCur||moving?'default':'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:7,transition:'all .15s'}}
                          onMouseEnter={e=>{if(!isCur&&!moving){e.currentTarget.style.background=col.color+'18';e.currentTarget.style.borderColor=col.color+'55';e.currentTarget.style.color=col.color;}}}
                          onMouseLeave={e=>{if(!isCur&&!moving){e.currentTarget.style.background='rgba(255,255,255,.02)';e.currentTarget.style.borderColor='rgba(255,255,255,.09)';e.currentTarget.style.color='#9090AA';}}}>
                          {isLoading?<span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.15)',borderTopColor:col.color,borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite'}}/>:col.emoji}
                          {col.label}{isCur&&<span style={{marginLeft:'auto',fontSize:'.62rem',opacity:.6}}>now</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons — edit only for assigner/assignee */}
                <div style={{display:'flex',gap:8,marginBottom:14}}>
                  {editable
                    ? <Btn variant="ghost" size="sm" onClick={()=>openEdit(detail)} style={{flex:1}}>✏️ Edit Task</Btn>
                    : <div style={{flex:1,padding:'5px 12px',borderRadius:10,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',fontSize:'.75rem',color:'#6B6B8A',display:'flex',alignItems:'center',justifyContent:'center'}}>🔒 View only</div>
                  }
                  <Btn variant="ghost" size="sm" onClick={()=>getAiHelp(detail)} style={{flex:1}}>🤖 AI Help</Btn>
                  {(isAdmin||detail.created_by===userId)&&<Btn variant="danger" size="sm" onClick={()=>deleteTask(detail.id)}>🗑</Btn>}
                </div>

                {aiSugg==='loading'&&<div style={{padding:12,background:'rgba(124,92,252,.06)',borderRadius:10,border:'1px solid rgba(124,92,252,.15)',display:'flex',gap:5,marginBottom:10}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:'#9D7FFF',animation:'bounce .9s infinite',animationDelay:i*.15+'s'}}/>)}</div>}
                {aiSugg&&aiSugg!=='loading'&&<div style={{padding:14,background:'rgba(124,92,252,.06)',borderRadius:10,border:'1px solid rgba(124,92,252,.15)',fontSize:'.8rem',color:'#9090AA',lineHeight:1.65,whiteSpace:'pre-wrap',marginBottom:10}}>🤖 {aiSugg}</div>}

                {(()=>{try{const cl=JSON.parse(detail.ai_checklist||'[]');if(!cl.length)return null;return<div style={{marginTop:10}}><div style={{fontSize:'.68rem',fontWeight:700,color:'#6B6B8A',textTransform:'uppercase',marginBottom:8}}>Checklist</div>{cl.map((item,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:'.8rem',color:item.done?'#6B6B8A':'#9090AA',marginBottom:5,textDecoration:item.done?'line-through':'none'}}><span>{item.done?'✅':'⬜'}</span>{item.text}</div>)}</div>;}catch{return null;}})()}
              </>
            );
          })()}
        </Modal>
      </div>
    </Layout>
  );
}

const selStyle = { background:'#1C1C28', border:'1px solid rgba(255,255,255,.13)', borderRadius:10, padding:'7px 11px', fontSize:'.78rem', color:'#F0EFFF', fontFamily:'Inter,sans-serif', cursor:'pointer' };
const tagStyle  = { background:'#1C1C28', color:'#9090AA', fontSize:'.68rem', fontWeight:600, padding:'2px 8px', borderRadius:6 };

function TaskCard({ task, onClick }) {
  const over = task.deadline && task.status!=='done' && new Date(task.deadline) < new Date();
  const todayStr = new Date().toISOString().split('T')[0];
  const postToday = task.post_date && String(task.post_date).slice(0,10) === todayStr;
  return (
    <div onClick={onClick}
      style={{background:'#1C1C28',border:'1px solid '+(over?'rgba(255,77,109,.35)':'rgba(255,255,255,.07)'),borderRadius:10,padding:11,cursor:'pointer',transition:'all .15s'}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='#7C5CFC';e.currentTarget.style.transform='translateY(-1px)';}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=over?'rgba(255,77,109,.35)':'rgba(255,255,255,.07)';e.currentTarget.style.transform='';}}>
      <div style={{fontSize:'.82rem',fontWeight:600,marginBottom:7,color:'#F0EFFF',lineHeight:1.3}}>{task.title}</div>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
        <Tag text={task.priority}/>
        {task.client_name&&<span style={{fontSize:'.63rem',color:'#6B6B8A'}}>{task.client_name}</span>}
        {task.link&&<span style={{fontSize:'.63rem',color:'#9D7FFF'}}>🔗</span>}
        {postToday&&<span style={{fontSize:'.63rem',background:'rgba(124,92,252,.15)',color:'#9D7FFF',padding:'1px 5px',borderRadius:4,fontWeight:600}}>📤</span>}
      </div>
      {/* Assigner + Assignee on card — Feature #9 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {task.created_by_name&&<div style={{fontSize:'.65rem',color:'#6B6B8A',display:'flex',alignItems:'center',gap:3}}><Avatar name={task.created_by_name} size={16} color="#FF5FA0"/><span title="Assigner">{task.created_by_name.split(' ')[0]}</span></div>}
          {task.owner_name&&task.owner_name!==task.created_by_name&&<><span style={{color:'#6B6B8A',fontSize:'.6rem'}}>→</span><div style={{fontSize:'.65rem',color:'#9090AA',display:'flex',alignItems:'center',gap:3}}><Avatar name={task.owner_name} size={16} color="#7C5CFC"/><span title="Assignee">{task.owner_name.split(' ')[0]}</span></div></>}
        </div>
        {task.deadline&&<span style={{fontSize:'.63rem',color:over?'#FF4D6D':'#6B6B8A'}}>📅 {String(task.deadline).slice(0,10)}</span>}
      </div>
    </div>
  );
}
