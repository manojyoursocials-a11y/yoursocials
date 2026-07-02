import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Select, Textarea, Tag, Avatar, EmptyState, Spinner, launchConfetti, toast, sounds, api, askAI, MEMBER_COLORS } from '../components/UI';

const COLS = [
  { id:'todo',       label:'To Do',       emoji:'📋', color:'var(--muted2)' },
  { id:'inprogress', label:'In Progress',  emoji:'⚡', color:'var(--cyan)'   },
  { id:'review',     label:'Under Review', emoji:'👁️', color:'var(--yellow)' },
  { id:'done',       label:'Done',         emoji:'✅', color:'var(--green)'  },
];

export default function Tasks() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status]);

  const [tasks,   setTasks]   = useState([]);
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [detail,  setDetail]  = useState(null);
  const [form,    setForm]    = useState(df());
  const [checklist,setChecklist]=useState([]);
  const [aiLoading,setAiLoading]=useState(false);
  const [aiSugg,  setAiSugg]  = useState('');
  const [filter,  setFilter]  = useState('all');

  function df(){ return { title:'',description:'',priority:'P3',owner_id:'',client_id:'',deadline:'',estimated_hours:'' }; }

  useEffect(()=>{ if(status==='authenticated') fetchAll(); },[status]);

  async function fetchAll() {
    const [t,m,c] = await Promise.all([api('/api/tasks'),api('/api/members'),api('/api/clients')]);
    setTasks(Array.isArray(t)?t:[]); setMembers(Array.isArray(m)?m:[]); setClients(Array.isArray(c)?c:[]); setLoading(false);
  }

  async function createTask() {
    if (!form.title.trim()){ toast.error('Title required'); sounds.error(); return; }
    await api('/api/tasks','POST',{ ...form, ai_checklist:checklist });
    toast.success('Task created! +50 🪙','✅'); sounds.success();
    setModal(false); setForm(df()); setChecklist([]); fetchAll();
  }

  async function moveTask(id, status) {
    await api('/api/tasks','PATCH',{ id, status });
    if(status==='done'){ launchConfetti(); sounds.confetti(); toast.success('Task done! +100 🪙 🎉'); }
    else { sounds.pop(); toast.info(`Moved to ${COLS.find(c=>c.id===status)?.label}`); }
    setDetail(null); fetchAll();
  }

  async function deleteTask(id) {
    await api(`/api/tasks?id=${id}`,'DELETE');
    setDetail(null); fetchAll(); toast.info('Task deleted');
  }

  async function genChecklist() {
    if(!form.title){ toast.error('Enter title first'); return; }
    setAiLoading(true);
    const r = await askAI(`Generate 5-7 checklist steps for this creative agency task: "${form.title}". Return ONLY a numbered list, one per line.`);
    setChecklist(r.split('\n').filter(l=>l.trim()).slice(0,7).map(l=>({ text:l.replace(/^\d+\.\s*/,'').trim(), done:false })));
    setAiLoading(false); sounds.pop();
  }

  async function getAISugg(task) {
    setAiSugg('loading');
    const r = await askAI(`Give 3 specific suggestions to improve: "${task.title}" (Client: ${task.client_name||'Internal'}, Priority: ${task.priority}, Deadline: ${task.deadline||'none'})`);
    setAiSugg(r);
  }

  const filtered = tasks.filter(t=>filter==='all'||t.owner_id===filter);

  if(loading) return <Layout><div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12 }}><Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading…</span></div></Layout>;

  return (
    <Layout badges={{ tasks:tasks.filter(t=>t.status==='todo').length }}>
      <div style={{ display:'flex',flexDirection:'column',height:'calc(100vh - 110px)' }}>
        {/* Toolbar */}
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap' }}>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:10,padding:'7px 12px',fontSize:'.8rem',color:'var(--text)',fontFamily:'Inter,sans-serif',cursor:'pointer' }}>
            <option value="all">All members</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
          </select>
          <div style={{ marginLeft:'auto' }}><Btn onClick={()=>{ setModal(true); setChecklist([]); setForm(df()); }}>+ New Task</Btn></div>
        </div>

        {/* Kanban */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,flex:1,overflow:'hidden' }}>
          {COLS.map(col=>{
            const ct=filtered.filter(t=>t.status===col.id);
            return (
              <div key={col.id} style={{ background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r)',display:'flex',flexDirection:'column',overflow:'hidden' }}>
                <div style={{ padding:'13px 13px 9px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
                  <span style={{ display:'flex',alignItems:'center',gap:7,fontSize:'.8rem',fontWeight:700,color:col.color }}>{col.emoji} {col.label}</span>
                  <span style={{ background:'var(--surface3)',color:'var(--muted2)',fontSize:'.63rem',fontWeight:700,padding:'2px 7px',borderRadius:20 }}>{ct.length}</span>
                </div>
                <div style={{ flex:1,overflowY:'auto',padding:8,display:'flex',flexDirection:'column',gap:7 }}>
                  {ct.length===0&&<div style={{ color:'var(--muted)',fontSize:'.73rem',textAlign:'center',padding:'20px 0',opacity:.6 }}>No tasks here</div>}
                  {ct.map(t=><TaskCard key={t.id} task={t} onClick={()=>{ setDetail(t); setAiSugg(''); }}/>)}
                </div>
                <button onClick={()=>{ setModal(true); setChecklist([]); setForm(df()); }} style={{ margin:8,padding:8,borderRadius:8,border:'1px dashed var(--border2)',background:'transparent',color:'var(--muted)',fontSize:'.74rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontFamily:'Inter,sans-serif',transition:'all .18s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';e.currentTarget.style.color='var(--purple2)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.13)';e.currentTarget.style.color='var(--muted)';}}>+ Add task</button>
              </div>
            );
          })}
        </div>

        {/* Create modal */}
        <Modal open={modal} onClose={()=>setModal(false)} title="Create New Task" width={580}>
          <Input label="Task Title *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Instagram Reels — Client June Recap"/>
          <Textarea label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What needs to be done…"/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Select label="Priority" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
              {['P1','P2','P3','P4'].map(p=><option key={p} value={p}>{['🔴 Critical','🟠 High','🟡 Medium','🟢 Low'][['P1','P2','P3','P4'].indexOf(p)]} — {p}</option>)}
            </Select>
            <Select label="Assign To" value={form.owner_id} onChange={e=>setForm(f=>({...f,owner_id:e.target.value}))}>
              <option value="">Me</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
            </Select>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Select label="Client" value={form.client_id} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))}>
              <option value="">No client (Internal)</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/>
          </div>
          <Input label="Estimated Hours" type="number" min="0.5" step="0.5" value={form.estimated_hours} onChange={e=>setForm(f=>({...f,estimated_hours:e.target.value}))} placeholder="e.g. 3"/>

          {checklist.length>0&&(
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:8 }}>🤖 AI Checklist</div>
              {checklist.map((item,i)=>(
                <label key={i} style={{ display:'flex',alignItems:'flex-start',gap:8,fontSize:'.8rem',cursor:'pointer',color:'var(--muted2)',marginBottom:5 }}>
                  <input type="checkbox" checked={item.done} onChange={e=>setChecklist(c=>c.map((x,j)=>j===i?{...x,done:e.target.checked}:x))} style={{ marginTop:2,accentColor:'var(--purple)' }}/>
                  {item.text}
                </label>
              ))}
            </div>
          )}
          <div style={{ display:'flex',gap:10 }}>
            <Btn variant="ghost" onClick={genChecklist} disabled={aiLoading} style={{ flex:1 }}>{aiLoading?'⏳ Generating…':'🤖 AI Checklist'}</Btn>
            <Btn onClick={createTask} style={{ flex:2 }}>Create Task</Btn>
          </div>
        </Modal>

        {/* Detail modal */}
        <Modal open={!!detail} onClose={()=>{ setDetail(null); setAiSugg(''); }} title={detail?.title||''} width={540}>
          {detail&&<>
            <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:16 }}>
              <Tag text={detail.priority}/><Tag text={detail.status}/>
              {detail.client_name&&<span style={{ background:'var(--surface3)',color:'var(--muted2)',fontSize:'.68rem',fontWeight:600,padding:'2px 8px',borderRadius:6 }}>🏢 {detail.client_name}</span>}
              {detail.deadline&&<span style={{ background:'var(--surface3)',color:'var(--muted2)',fontSize:'.68rem',fontWeight:600,padding:'2px 8px',borderRadius:6 }}>📅 {detail.deadline?.toString().slice(0,10)}</span>}
              {detail.estimated_hours&&<span style={{ background:'var(--surface3)',color:'var(--muted2)',fontSize:'.68rem',fontWeight:600,padding:'2px 8px',borderRadius:6 }}>⏱ {detail.estimated_hours}h</span>}
            </div>
            {detail.description&&<p style={{ fontSize:'.83rem',color:'var(--muted2)',lineHeight:1.6,marginBottom:16 }}>{detail.description}</p>}
            <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
              {COLS.filter(c=>c.id!==detail.status).map(col=><Btn key={col.id} variant="ghost" size="sm" onClick={()=>moveTask(detail.id,col.id)}>→ {col.label}</Btn>)}
            </div>
            <div style={{ display:'flex',gap:8,marginBottom:12 }}>
              <Btn variant="ghost" size="sm" onClick={()=>getAISugg(detail)} style={{ flex:1 }}>🤖 AI Suggestions</Btn>
              <Btn variant="danger" size="sm" onClick={()=>deleteTask(detail.id)}>🗑 Delete</Btn>
            </div>
            {aiSugg==='loading'&&<div style={{ padding:12,background:'rgba(124,92,252,.06)',borderRadius:10,border:'1px solid rgba(124,92,252,.15)',fontSize:'.8rem',color:'var(--muted2)' }}><div style={{ display:'flex',gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'var(--purple2)',animation:`bounce .9s infinite`,animationDelay:`${i*.15}s` }}/>)}</div></div>}
            {aiSugg&&aiSugg!=='loading'&&<div style={{ padding:14,background:'rgba(124,92,252,.06)',borderRadius:10,border:'1px solid rgba(124,92,252,.15)',fontSize:'.8rem',color:'var(--muted2)',lineHeight:1.65,whiteSpace:'pre-wrap' }}>🤖 {aiSugg}</div>}
            {detail.ai_checklist&&(() => { try { const cl=JSON.parse(detail.ai_checklist); return cl.length>0&&<div style={{ marginTop:14 }}><div style={{ fontSize:'.73rem',fontWeight:700,color:'var(--muted)',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase' }}>Checklist</div>{cl.map((item,i)=><div key={i} style={{ display:'flex',alignItems:'center',gap:8,fontSize:'.8rem',color:item.done?'var(--muted)':'var(--muted2)',marginBottom:5,textDecoration:item.done?'line-through':'none' }}><span>{item.done?'✅':'⬜'}</span>{item.text}</div>)}</div>; } catch(e){ return null; } })()}
          </>}
        </Modal>
      </div>
    </Layout>
  );
}

function TaskCard({ task, onClick }) {
  const overdue = task.deadline && task.status!=='done' && new Date(task.deadline)<new Date();
  return (
    <div onClick={onClick} style={{ background:'var(--surface3)',border:`1px solid ${overdue?'rgba(255,77,109,.3)':'var(--border)'}`,borderRadius:10,padding:12,cursor:'pointer',transition:'all .18s' }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.transform='translateY(-1px)';}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=overdue?'rgba(255,77,109,.3)':'var(--border)';e.currentTarget.style.transform='';}}
    >
      <div style={{ fontSize:'.82rem',fontWeight:600,lineHeight:1.35,marginBottom:8 }}>{task.title}</div>
      <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:6 }}>
        <Tag text={task.priority}/>
        {task.client_name&&<span style={{ fontSize:'.64rem',color:'var(--muted)' }}>{task.client_name}</span>}
      </div>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        {task.owner_name&&<div style={{ display:'flex',alignItems:'center',gap:5,fontSize:'.68rem',color:'var(--muted2)' }}>
          <Avatar name={task.owner_name} url={task.owner_image} size={18} color="var(--purple)"/>
          {task.owner_name?.split(' ')[0]}
        </div>}
        {task.deadline&&<span style={{ fontSize:'.67rem',color:overdue?'var(--red)':'var(--muted)',fontWeight:overdue?700:400 }}>{overdue?'⚠️':'📅'} {task.deadline?.toString().slice(0,10)}</span>}
      </div>
      {task.estimated_hours&&<div style={{ marginTop:5,fontSize:'.63rem',color:'var(--muted)' }}>⏱ {task.estimated_hours}h</div>}
    </div>
  );
}
