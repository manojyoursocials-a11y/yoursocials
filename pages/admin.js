import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Textarea, Avatar, Spinner, EmptyState, toast, sounds, api, MEMBER_COLORS } from '../components/UI';

const TABS = ['Users','Coins','Clients','Tasks','Rewards','Follow-ups'];

export default function Admin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status==='unauthenticated') router.replace('/login');
    if (status==='authenticated' && session?.user?.role!=='admin') router.replace('/');
  }, [status, session]);

  const [tab,     setTab]     = useState('Users');
  const [users,   setUsers]   = useState([]);
  const [clients, setClients] = useState([]);
  const [tasks,   setTasks]   = useState([]);
  const [rewards, setRewards] = useState([]);
  const [followups,setFollowups]=useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modal,      setModal]      = useState(null); // 'user'|'client'|'task'|'reward'|'followup'
  const [editing,    setEditing]    = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [form,       setForm]       = useState({});
  const [coinResetUser, setCoinResetUser] = useState(null); // user to reset, or 'all'

  useEffect(() => {
    if (status==='authenticated' && session?.user?.role==='admin') fetchAll();
  }, [status, session]);

  async function fetchAll() {
    setLoading(true);
    const [u,c,t,r,f,m] = await Promise.all([
      api('/api/users'), api('/api/clients'), api('/api/tasks'),
      api('/api/rewards'), api('/api/followups'), api('/api/members'),
    ]);
    setUsers(Array.isArray(u)?u:[]);
    setClients(Array.isArray(c)?c:[]);
    setTasks(Array.isArray(t)?t:[]);
    setRewards(Array.isArray(r)?r:[]);
    setFollowups(Array.isArray(f)?f:[]);
    setMembers(Array.isArray(m)?m:[]);
    setLoading(false);
  }

  // ── Generic save ──────────────────────────────────────────
  async function save() {
    if (modal==='user') {
      if (!form.name||!form.email) { toast.error('Name and email required'); return; }
      if (!editing && !form.password) { toast.error('Password required'); return; }
      if (form.password && form.password.length<6) { toast.error('Password min 6 chars'); return; }
      if (editing) {
        const res = await api('/api/users','PATCH',{id:editing.id,...form,phone:form.phone||null,image:form.image||null});
        if (res.error) { toast.error(res.error); return; }
        toast.success('User updated');
      } else {
        const res = await api('/api/users','POST',{...form,phone:form.phone||null,image:form.image||null});
        if (res.error) { toast.error(res.error); return; }
        toast.success(form.name+' added!','👤'); sounds.success();
      }
    }
    else if (modal==='client') {
      if (!form.name) { toast.error('Name required'); return; }
      if (editing) { await api('/api/clients','PATCH',{id:editing.id,...form}); toast.success('Client updated'); }
      else { await api('/api/clients','POST',form); toast.success('Client added!','🏢'); sounds.success(); }
    }
    else if (modal==='task') {
      if (!form.title) { toast.error('Title required'); return; }
      if (editing) { await api('/api/tasks','PATCH',{id:editing.id,...form}); toast.success('Task updated'); }
      else { await api('/api/tasks','POST',form); toast.success('Task created!','✅'); sounds.success(); }
    }
    else if (modal==='reward') {
      if (!form.name||!form.emoji) { toast.error('Name and emoji required'); return; }
      if (editing) { await api('/api/rewards','PATCH',{id:editing.id,...form}); toast.success('Reward updated'); }
      else { await api('/api/rewards','POST',form); toast.success('Reward added!','🎁'); }
    }
    else if (modal==='followup') {
      if (!form.subject) { toast.error('Subject required'); return; }
      if (editing) { await api('/api/followups','PATCH',{id:editing.id,...form}); toast.success('Follow-up updated'); }
      else { await api('/api/followups','POST',form); toast.success('Follow-up added!'); }
    }
    closeModal(); fetchAll();
  }

  async function del() {
    const {type,id} = delConfirm;
    if (type==='user')     await api('/api/users?id='+id,    'DELETE');
    if (type==='client')   await api('/api/clients?id='+id,  'DELETE');
    if (type==='task')     await api('/api/tasks?id='+id,    'DELETE');
    if (type==='reward')   await api('/api/rewards?id='+id,  'DELETE');
    if (type==='followup') await api('/api/followups?id='+id,'DELETE');
    toast.info('Deleted'); setDelConfirm(null); fetchAll();
  }

  function openCreate(type) {
    setEditing(null);
    setForm(defaults(type));
    setModal(type);
  }
  function openEdit(type, item) {
    setEditing(item);
    setForm({...item, password:''});
    setModal(type);
  }
  function closeModal() { setModal(null); setEditing(null); setForm({}); }

  function defaults(type) {
    if (type==='user')     return {name:'',email:'',password:'',role:'member',job_title:'',phone:'',image:''};
    if (type==='client')   return {name:'',contact_name:'',contact_email:'',contact_phone:'',industry:'',notes:'',status:'active'};
    if (type==='task')     return {title:'',description:'',link:'',priority:'P3',owner_id:'',client_id:'',deadline:'',estimated_hours:''};
    if (type==='reward')   return {name:'',emoji:'🎁',description:'',coin_cost:500,reward_type:'weekly'};
    if (type==='followup') return {client_id:'',subject:'',due_date:'',assigned_to:'',status:'pending'};
    return {};
  }

  const STATUS_COL = { todo:'var(--muted2)', inprogress:'var(--cyan)', review:'var(--yellow)', done:'var(--green)' };
  const STATUS_LBL = { todo:'To Do', inprogress:'In Progress', review:'Under Review', done:'Done', pending:'Pending', sent:'Sent' };
  const ROLE_COL   = { admin:'var(--purple2)', member:'var(--green)', viewer:'var(--muted2)' };

  if (loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}><Spinner size={28}/><span style={{color:'var(--muted2)'}}>Loading…</span></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:4}}>⚙️ Admin Panel</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>Full control — add, edit, delete everything</p>
          </div>
          <Btn onClick={()=>openCreate(tab.toLowerCase().replace('-ups','up').replace('follow-up','followup').replace('users','user').replace('clients','client').replace('tasks','task').replace('rewards','reward').replace('followups','followup'))}>
            + Add {tab.replace('Follow-ups','Follow-up').replace(/s$/,'')}
          </Btn>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,background:'var(--surface3)',borderRadius:10,padding:4,marginBottom:20}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'7px 10px',borderRadius:8,fontSize:'.78rem',fontWeight:600,cursor:'pointer',textAlign:'center',color:tab===t?'var(--text)':'var(--muted2)',background:tab===t?'var(--surface2)':'transparent',border:'none',fontFamily:'Inter,sans-serif',transition:'all .18s'}}>
              {t}
            </button>
          ))}
        </div>

        {/* ── COINS ─────────────────────────────── */}
        {tab==='Coins'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:12}}>
              <div>
                <h3 style={{fontWeight:900,fontSize:'1.1rem',marginBottom:4}}>🪙 Coin Management</h3>
                <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>Reset coin balances per employee or all at once</p>
              </div>
              <Btn variant="danger" onClick={()=>setCoinResetUser('all')}>🔄 Reset All Coins</Btn>
            </div>
            <Card style={{marginBottom:18,background:'rgba(255,214,10,.04)',borderColor:'rgba(255,214,10,.2)'}}>
              <div style={{fontSize:'.78rem',color:'var(--muted2)',lineHeight:1.7}}>
                💡 Resetting sets the balance to <strong>0</strong>. Task reward flags are kept — so coins won't be re-awarded for the same task after a reset. Use this at the start of a new month or season.
              </div>
            </Card>
            {users.length===0&&<div style={{color:'var(--muted)',fontSize:'.85rem',textAlign:'center',padding:'40px 0'}}>No team members found.</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {users.map((u,i)=>(
                <Card key={u.id} style={{display:'flex',alignItems:'center',gap:12}}>
                  <Avatar name={u.name||u.email} size={42} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:'.88rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{u.name||u.email?.split('@')[0]}</div>
                    <div style={{fontSize:'.72rem',color:'var(--muted)',marginBottom:3}}>{u.job_title||u.role}</div>
                    <div style={{fontSize:'.85rem',color:'var(--yellow)',fontWeight:800}}>🪙 {(u.coins||0).toLocaleString()}</div>
                  </div>
                  <Btn variant={u.coins>0?'danger':'ghost'} size="sm"
                    onClick={()=>setCoinResetUser(u)}
                    style={{flexShrink:0,opacity:u.coins===0?.45:1}}>
                    {u.coins===0?'✓ 0':'Reset'}
                  </Btn>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS ─────────────────────────────── */}
        {tab==='Users'&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
            {users.length===0&&<EmptyState emoji="👥" title="No users" subtitle="Add team members." action={<Btn onClick={()=>openCreate('user')}>+ Add User</Btn>}/>}
            {users.map((u,i)=>{
              const isMe=u.id===session?.user?.id;
              return (
                <Card key={u.id} style={{position:'relative',border:isMe?'1px solid rgba(124,92,252,.3)':undefined}}>
                  {isMe&&<div style={{position:'absolute',top:10,right:10,fontSize:'.62rem',fontWeight:700,background:'rgba(124,92,252,.15)',color:'var(--purple2)',padding:'2px 7px',borderRadius:20}}>You</div>}
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <Avatar name={u.name||u.email} size={42} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:'.9rem'}}>{u.name}</div>
                      <div style={{fontSize:'.73rem',color:'var(--muted)',marginBottom:3}}>{u.email}</div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <span style={{background:'rgba(124,92,252,.12)',color:ROLE_COL[u.role]||'var(--muted2)',fontSize:'.63rem',fontWeight:700,padding:'2px 8px',borderRadius:20}}>{u.role}</span>
                        {u.job_title&&<span style={{fontSize:'.68rem',color:'var(--muted)'}}>{u.job_title}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:'.72rem',color:'var(--muted2)',display:'flex',gap:12,marginBottom:12}}>
                    <span>🪙 {(u.coins||0).toLocaleString()}</span>
                    <span>🔥 {u.streak||0} streak</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>openEdit('user',u)}>✏️ Edit</Btn>
                    {!isMe&&<Btn variant="danger" size="sm" onClick={()=>setDelConfirm({type:'user',id:u.id,label:u.name})}>🗑</Btn>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── CLIENTS ───────────────────────────── */}
        {tab==='Clients'&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
            {clients.length===0&&<EmptyState emoji="🏢" title="No clients" subtitle="Add your clients." action={<Btn onClick={()=>openCreate('client')}>+ Add Client</Btn>}/>}
            {clients.map(c=>(
              <Card key={c.id}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:'.9rem',marginBottom:2}}>{c.name}</div>
                    {c.industry&&<div style={{fontSize:'.7rem',color:'var(--muted)'}}>{c.industry}</div>}
                  </div>
                  <span style={{fontSize:'.63rem',fontWeight:700,padding:'2px 8px',borderRadius:20,
                    background:c.status==='active'?'rgba(0,229,160,.1)':c.status==='prospect'?'rgba(0,212,255,.1)':'rgba(107,107,138,.1)',
                    color:c.status==='active'?'var(--green)':c.status==='prospect'?'var(--cyan)':'var(--muted)'}}>
                    {c.status}
                  </span>
                </div>
                {c.contact_name&&<div style={{fontSize:'.75rem',color:'var(--muted2)',marginBottom:2}}>👤 {c.contact_name}</div>}
                {c.contact_email&&<div style={{fontSize:'.73rem',color:'var(--muted)',marginBottom:2}}>📧 {c.contact_email}</div>}
                {c.contact_phone&&<div style={{fontSize:'.73rem',color:'var(--muted)',marginBottom:8}}>📱 {c.contact_phone}</div>}
                <div style={{fontSize:'.7rem',color:'var(--muted2)',marginBottom:12}}>📋 {c.task_count||0} tasks · ✅ {c.done_count||0} done</div>
                <div style={{display:'flex',gap:8}}>
                  <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>openEdit('client',c)}>✏️ Edit</Btn>
                  <Btn variant="danger" size="sm" onClick={()=>setDelConfirm({type:'client',id:c.id,label:c.name})}>🗑</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── TASKS ─────────────────────────────── */}
        {tab==='Tasks'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div style={{fontSize:'.82rem',color:'var(--muted2)'}}>
                <span style={{color:'var(--green)',fontWeight:700}}>{tasks.filter(t=>t.status==='done').length} done</span> · {tasks.filter(t=>t.status!=='done').length} active · {tasks.length} total
              </div>
              {tasks.filter(t=>t.status==='done').length>0&&(
                <Btn variant="danger" size="sm" onClick={async()=>{
                  if(!confirm('Permanently delete all '+tasks.filter(t=>t.status==='done').length+' done tasks? This cannot be undone.')) return;
                  const r=await fetch('/api/admin-clear?type=done-tasks',{method:'DELETE',headers:{'Content-Type':'application/json'}});
                  const d=await r.json();
                  if(d.error){toast.error(d.error);return;}
                  toast.success('All done tasks cleared! 🗑');
                  fetch('/api/tasks').then(r=>r.json()).then(d=>setTasks(Array.isArray(d)?d:[]));
                }}>🗑 Clear All Done ({tasks.filter(t=>t.status==='done').length})</Btn>
              )}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {tasks.length===0&&<EmptyState emoji="✅" title="No tasks" subtitle="Create tasks." action={<Btn onClick={()=>openCreate('task')}>+ Add Task</Btn>}/>}
            {tasks.map(t=>{
              const overdue=t.deadline&&t.status!=='done'&&new Date(t.deadline)<new Date();
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'var(--surface2)',border:'1px solid '+(overdue?'rgba(255,77,109,.3)':'var(--border)'),borderRadius:10}}>
                  <span style={{background:'rgba(124,92,252,.1)',color:STATUS_COL[t.status]||'var(--muted2)',fontSize:'.65rem',fontWeight:700,padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap'}}>{STATUS_LBL[t.status]||t.status}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'.84rem',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.title}</div>
                    <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>
                      {t.owner_name&&`👤 ${t.owner_name}`}{t.client_name&&` · 🏢 ${t.client_name}`}
                      {t.deadline&&<span style={{color:overdue?'var(--red)':'var(--muted)',marginLeft:8}}>{overdue?'⚠️':'📅'} {t.deadline?.toString().slice(0,10)}</span>}
                    </div>
                  </div>
                  <span style={{fontSize:'.68rem',fontWeight:700,padding:'2px 7px',borderRadius:6,
                    background:t.priority==='P1'?'rgba(255,77,109,.15)':t.priority==='P2'?'rgba(255,140,66,.15)':t.priority==='P3'?'rgba(255,214,10,.12)':'rgba(0,229,160,.1)',
                    color:t.priority==='P1'?'var(--red)':t.priority==='P2'?'var(--orange)':t.priority==='P3'?'var(--yellow)':'var(--green)'}}>{t.priority}</span>
                  <div style={{display:'flex',gap:6}}>
                    <Btn variant="ghost" size="sm" onClick={()=>openEdit('task',t)}>✏️</Btn>
                    <Btn variant="danger" size="sm" onClick={()=>setDelConfirm({type:'task',id:t.id,label:t.title})}>🗑</Btn>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* ── REWARDS ───────────────────────────── */}
        {tab==='Rewards'&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14}}>
            {rewards.length===0&&<EmptyState emoji="🎁" title="No rewards" subtitle="Add rewards." action={<Btn onClick={()=>openCreate('reward')}>+ Add Reward</Btn>}/>}
            {rewards.map(r=>(
              <Card key={r.id} style={{textAlign:'center',position:'relative'}}>
                <div style={{fontSize:'2.2rem',marginBottom:8}}>{r.emoji}</div>
                <div style={{fontWeight:800,fontSize:'.88rem',marginBottom:3}}>{r.name}</div>
                <div style={{fontSize:'.72rem',color:'var(--muted)',marginBottom:6}}>{r.description}</div>
                <div style={{fontSize:'.75rem',color:'var(--yellow)',fontWeight:700,marginBottom:10}}>🪙 {(r.coin_cost||0).toLocaleString()}</div>
                <span style={{fontSize:'.63rem',fontWeight:700,padding:'2px 9px',borderRadius:20,background:r.reward_type==='monthly'?'rgba(124,92,252,.12)':'rgba(0,229,160,.1)',color:r.reward_type==='monthly'?'var(--purple2)':'var(--green)'}}>{r.reward_type}</span>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>openEdit('reward',r)}>✏️ Edit</Btn>
                  <Btn variant="danger" size="sm" onClick={()=>setDelConfirm({type:'reward',id:r.id,label:r.name})}>🗑</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── FOLLOW-UPS ─────────────────────────── */}
        {tab==='Follow-ups'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div style={{fontSize:'.82rem',color:'var(--muted2)'}}>
                <span style={{color:'var(--green)',fontWeight:700}}>{followups.filter(f=>f.status==='done').length} done</span> · {followups.filter(f=>f.status==='pending').length} pending
              </div>
              {followups.filter(f=>f.status==='done').length>0&&(
                <Btn variant="danger" size="sm" onClick={async()=>{
                  if(!confirm('Permanently delete all done follow-ups?')) return;
                  const r=await fetch('/api/admin-clear?type=done-followups',{method:'DELETE',headers:{'Content-Type':'application/json'}});
                  const d=await r.json();
                  if(d.error){toast.error(d.error);return;}
                  toast.success('Done follow-ups cleared! 🗑');
                  fetch('/api/followups').then(r=>r.json()).then(d=>setFollowups(Array.isArray(d)?d:[]));
                }}>🗑 Clear Done ({followups.filter(f=>f.status==='done').length})</Btn>
              )}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {followups.length===0&&<EmptyState emoji="📩" title="No follow-ups" subtitle="Track client communications." action={<Btn onClick={()=>openCreate('followup')}>+ Add Follow-up</Btn>}/>}
            {followups.map(f=>(
              <div key={f.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10}}>
                <span style={{fontSize:'.65rem',fontWeight:700,padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap',
                  background:f.status==='done'?'rgba(0,229,160,.1)':'rgba(255,214,10,.12)',
                  color:f.status==='done'?'var(--green)':'var(--yellow)'}}>{f.status}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'.84rem',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.subject}</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>
                    {f.client_name&&`🏢 ${f.client_name}`}{f.assignee_name&&` · 👤 ${f.assignee_name}`}
                    {f.due_date&&<span style={{marginLeft:8}}>📅 {f.due_date?.toString().slice(0,10)}</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <Btn variant="ghost" size="sm" onClick={()=>openEdit('followup',f)}>✏️</Btn>
                  <Btn variant="danger" size="sm" onClick={()=>setDelConfirm({type:'followup',id:f.id,label:f.subject})}>🗑</Btn>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ─────────────────────────────── */}

      {/* User modal */}
      <Modal open={modal==='user'} onClose={closeModal} title={editing?'Edit User':'Add Team Member'} width={500}>
        {/* Profile photo */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:8,letterSpacing:'.04em'}}>PROFILE PHOTO</div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:54,height:54,borderRadius:'50%',overflow:'hidden',background:'var(--surface3)',border:'2px solid var(--border2)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {form.image?<img src={form.image} alt="preview" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.5rem',opacity:.4}}>👤</span>}
            </div>
            <label style={{cursor:'pointer',padding:'7px 14px',background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:9,fontSize:'.8rem',color:'var(--muted2)',fontWeight:600,display:'inline-flex',alignItems:'center',gap:6}}>
              📷 Upload Photo
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                const file=e.target.files?.[0]; if(!file) return;
                if(file.size>2*1024*1024){toast.error('Max 2MB');return;}
                const reader=new FileReader();
                reader.onload=ev=>setForm(f=>({...f,image:ev.target.result}));
                reader.readAsDataURL(file);
              }}/>
            </label>
            {form.image&&<button onClick={()=>setForm(f=>({...f,image:''}))} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'.82rem'}}>✕</button>}
          </div>
        </div>

        <Input label="Full Name *" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Arun Kumar"/>
        <Input label="Email *" type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="arun@yoursocials.in" disabled={!!editing}/>
        <Input label="📱 Phone Number (used to login)" type="tel" value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91 98765 43210"/>
        <div style={{fontSize:'.73rem',color:'var(--cyan)',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,padding:'7px 12px',marginBottom:14}}>
          💡 Employee can log in using this phone number + their password
        </div>
        <Input label={editing?'New Password (blank = keep current)':'Password *'} type="password" value={form.password||''} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder={editing?'Leave blank to keep current':'Min 6 characters'}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Select label="Role" value={form.role||'member'} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            <option value="member">👤 Member</option>
            <option value="admin">👑 Admin</option>
            <option value="viewer">👁️ Viewer</option>
          </Select>
          <Input label="Job Title" value={form.job_title||''} onChange={e=>setForm(f=>({...f,job_title:e.target.value}))} placeholder="Content Lead, Designer…"/>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={closeModal} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Add Member'}</Btn>
        </div>
      </Modal>

      {/* Client modal */}
      <Modal open={modal==='client'} onClose={closeModal} title={editing?'Edit Client':'Add Client'} width={500}>
        <Input label="Brand / Client Name *" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Scale Up Salon"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Contact Person" value={form.contact_name||''} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Priya"/>
          <Input label="Industry" value={form.industry||''} onChange={e=>setForm(f=>({...f,industry:e.target.value}))} placeholder="Beauty & Wellness"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Email" type="email" value={form.contact_email||''} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))} placeholder="contact@brand.com"/>
          <Input label="Phone / WhatsApp" value={form.contact_phone||''} onChange={e=>setForm(f=>({...f,contact_phone:e.target.value}))} placeholder="+91 98765 43210"/>
        </div>
        <Select label="Status" value={form.status||'active'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Textarea label="Notes" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes about this client…"/>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={closeModal} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Add Client'}</Btn>
        </div>
      </Modal>

      {/* Task modal */}
      <Modal open={modal==='task'} onClose={closeModal} title={editing?'Edit Task':'Create Task'} width={560}>
        <Input label="Task Title *" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Instagram Reels — June"/>
        <Textarea label="Description" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What needs to be done…"/>
        <Input label="Link (optional)" value={form.link||''} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://drive.google.com/…"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Select label="Status" value={form.status||'todo'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            <option value="todo">📋 To Do</option>
            <option value="inprogress">⚡ In Progress</option>
            <option value="review">👁️ Under Review</option>
            <option value="done">✅ Done</option>
          </Select>
          <Select label="Priority" value={form.priority||'P3'} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            <option value="P1">🔴 Critical</option>
            <option value="P2">🟠 High</option>
            <option value="P3">🟡 Medium</option>
            <option value="P4">🟢 Low</option>
          </Select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Select label="Assign To" value={form.owner_id||''} onChange={e=>setForm(f=>({...f,owner_id:e.target.value}))}>
            <option value="">Unassigned</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
          </Select>
          <Select label="Client" value={form.client_id||''} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))}>
            <option value="">Internal</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Deadline" type="date" value={form.deadline?.toString().slice(0,10)||''} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/>
          <Input label="Estimated Hours" type="number" min="0.5" step="0.5" value={form.estimated_hours||''} onChange={e=>setForm(f=>({...f,estimated_hours:e.target.value}))} placeholder="3"/>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={closeModal} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Create Task'}</Btn>
        </div>
      </Modal>

      {/* Reward modal */}
      <Modal open={modal==='reward'} onClose={closeModal} title={editing?'Edit Reward':'Add Reward'} width={420}>
        <div style={{display:'grid',gridTemplateColumns:'70px 1fr',gap:12}}>
          <Input label="Emoji" value={form.emoji||''} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="🎁"/>
          <Input label="Name *" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Team Lunch"/>
        </div>
        <Input label="Description" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What is this reward?"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Coin Cost 🪙" type="number" min="0" value={form.coin_cost||0} onChange={e=>setForm(f=>({...f,coin_cost:parseInt(e.target.value)||0}))}/>
          <Select label="Type" value={form.reward_type||'weekly'} onChange={e=>setForm(f=>({...f,reward_type:e.target.value}))}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly Trip</option>
          </Select>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={closeModal} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Add Reward'}</Btn>
        </div>
      </Modal>

      {/* Follow-up modal */}
      <Modal open={modal==='followup'} onClose={closeModal} title={editing?'Edit Follow-up':'Add Follow-up'} width={460}>
        <Select label="Client" value={form.client_id||''} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))}>
          <option value="">No client</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Subject *" value={form.subject||''} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="e.g. July Content Calendar Approval"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Due Date" type="date" value={form.due_date?.toString().slice(0,10)||''} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
          <Select label="Assign To" value={form.assigned_to||''} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}>
            <option value="">Me</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
          </Select>
        </div>
        {editing&&(
          <Select label="Status" value={form.status||'pending'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
          </Select>
        )}
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={closeModal} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Add Follow-up'}</Btn>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Confirm Delete" width={360}>
        {delConfirm&&(
          <>
            <div style={{textAlign:'center',padding:'10px 0 20px',color:'var(--muted2)',fontSize:'.88rem',lineHeight:1.6}}>
              Are you sure you want to delete<br/>
              <strong style={{color:'var(--text)'}}>{delConfirm.label}</strong>?<br/>
              <span style={{fontSize:'.78rem'}}>This cannot be undone.</span>
            </div>
            <div style={{display:'flex',gap:10}}>
              <Btn variant="ghost" onClick={()=>setDelConfirm(null)} style={{flex:1}}>Cancel</Btn>
              <Btn variant="danger" onClick={del} style={{flex:1}}>Delete</Btn>
            </div>
          </>
        )}
      </Modal>
      {/* Coin Reset Confirm Modal */}
      <Modal open={!!coinResetUser} onClose={()=>setCoinResetUser(null)} title="Reset Coins" width={380}>
        {coinResetUser&&<>
          <div style={{textAlign:'center',padding:'12px 0 20px'}}>
            <div style={{fontSize:'2.5rem',marginBottom:10}}>🪙</div>
            {coinResetUser==='all'
              ?<><div style={{fontWeight:700,fontSize:'1rem',marginBottom:6}}>Reset ALL team coins</div><div style={{fontSize:'.82rem',color:'var(--muted2)',lineHeight:1.6}}>Every team member's coin balance will be set to 0. This cannot be undone.</div></>
              :<><div style={{fontWeight:700,fontSize:'1rem',marginBottom:6}}>{coinResetUser.name}</div><div style={{fontSize:'.82rem',color:'var(--muted2)'}}>Current balance: 🪙 {(coinResetUser.coins||0).toLocaleString()}</div><div style={{fontSize:'.78rem',color:'var(--muted)',marginTop:6}}>This will reset their coins to 0.</div></>
            }
          </div>
          <div style={{display:'flex',gap:10}}>
            <Btn variant="ghost" onClick={()=>setCoinResetUser(null)} style={{flex:1}}>Cancel</Btn>
            <Btn variant="danger" onClick={async()=>{
              const targetId = coinResetUser==='all'?'all':coinResetUser.id;
              const r = await api('/api/users','PATCH',{id:targetId,action:'resetCoins'});
              if(r.error){toast.error(r.error);return;}
              toast.success(coinResetUser==='all'?'All coins reset to 0! 🔄':'Coins reset for '+coinResetUser.name+' 🔄');
              setCoinResetUser(null);
              // Refresh user list to show updated balances
              api('/api/users').then(d=>setUsers(Array.isArray(d)?d:[]));
            }} style={{flex:1}}>Yes, Reset</Btn>
          </div>
        </>}
      </Modal>

    </Layout>
  );
}
