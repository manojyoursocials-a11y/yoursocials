import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Textarea, Spinner, EmptyState, Tag, Avatar, toast, sounds } from '../components/UI';

async function fetchJ(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return r.json();
}
const df=()=>({name:'',contact_name:'',contact_email:'',contact_phone:'',industry:'',notes:'',status:'active'});

export default function Clients() {
  const {status}=useSession();
  const router=useRouter();
  useEffect(()=>{if(status==='unauthenticated')router.replace('/login');},[status]);

  const [clients,  setClients]   = useState([]);
  const [loading,  setLoading]   = useState(true);
  const [modal,    setModal]     = useState(false);
  const [editing,  setEditing]   = useState(null);
  const [form,     setForm]      = useState(df());
  const [selected, setSelected]  = useState(null); // client to show tasks for
  const [cTasks,   setCTasks]    = useState([]);
  const [taskLoading,setTL]      = useState(false);

  useEffect(()=>{if(status==='authenticated')fetchAll();},[status]);

  async function fetchAll(){
    const d=await fetchJ('/api/clients');
    setClients(Array.isArray(d)?d:[]);setLoading(false);
  }

  async function loadClientTasks(client){
    setSelected(client);setTL(true);
    const t=await fetchJ('/api/tasks?client='+client.id);
    setCTasks(Array.isArray(t)?t:[]);setTL(false);
  }

  async function save(){
    if(!form.name.trim()){toast.error('Name required');return;}
    if(editing){
      const r=await fetchJ('/api/clients','PATCH',{id:editing.id,...form});
      if(r.error){toast.error(r.error);return;}
      toast.success('Client updated!');
    } else {
      const r=await fetchJ('/api/clients','POST',form);
      if(r.error){toast.error(r.error);return;}
      toast.success('Client added! 🏢');sounds.pop();
    }
    setModal(false);setEditing(null);fetchAll();
  }

  async function del(id){
    if(!confirm('Delete this client?'))return;
    await fetchJ('/api/clients?id='+id,'DELETE');
    toast.info('Removed');fetchAll();
    if(selected?.id===id){setSelected(null);setCTasks([]);}
  }

  const STATUS_COL={active:{bg:'rgba(0,229,160,.1)',color:'var(--green)'},inactive:{bg:'rgba(107,107,138,.1)',color:'var(--muted)'},prospect:{bg:'rgba(0,212,255,.1)',color:'var(--cyan)'}};
  const TASK_STATUS={todo:{color:'#9090AA',label:'To Do'},inprogress:{color:'#00D4FF',label:'In Progress'},review:{color:'#FFD60A',label:'Under Review'},done:{color:'#00E5A0',label:'Done'}};

  if(loading)return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><Spinner size={28}/></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:4}}>Clients 🏢</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>{clients.filter(c=>c.status==='active').length} active · {clients.filter(c=>c.status==='prospect').length} prospects · click a client to see tasks</p>
          </div>
          <Btn onClick={()=>{setEditing(null);setForm(df());setModal(true);}}>+ Add Client</Btn>
        </div>

        <div style={{display:'grid',gridTemplateColumns:selected?'repeat(auto-fit,minmax(260px,1fr))':'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
          {/* Client cards */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {clients.length===0
              ?<EmptyState emoji="🏢" title="No clients yet" action={<Btn onClick={()=>{setEditing(null);setForm(df());setModal(true);}}>+ Add Client</Btn>}/>
              :clients.map(c=>{
                const s=STATUS_COL[c.status]||STATUS_COL.active;
                const isSel=selected?.id===c.id;
                return (
                  <Card key={c.id} hover onClick={()=>isSel?setSelected(null):loadClientTasks(c)}
                    style={{border:isSel?'1px solid var(--purple)':undefined,background:isSel?'rgba(124,92,252,.06)':undefined,cursor:'pointer'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:10,background:'rgba(124,92,252,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>🏢</div>
                        <div>
                          <div style={{fontWeight:800,fontSize:'.9rem'}}>{c.name}</div>
                          {c.industry&&<div style={{fontSize:'.7rem',color:'var(--muted)'}}>{c.industry}</div>}
                        </div>
                      </div>
                      <span style={{background:s.bg,color:s.color,fontSize:'.65rem',fontWeight:700,padding:'2px 9px',borderRadius:20}}>{c.status}</span>
                    </div>
                    {c.contact_name&&<div style={{fontSize:'.77rem',color:'var(--muted2)',marginBottom:2}}>👤 {c.contact_name}</div>}
                    {c.contact_email&&<div style={{fontSize:'.73rem',color:'var(--muted)',marginBottom:2}}>📧 {c.contact_email}</div>}
                    {c.contact_phone&&<div style={{fontSize:'.73rem',color:'var(--muted)',marginBottom:8}}>📱 {c.contact_phone}</div>}
                    <div style={{display:'flex',gap:12,fontSize:'.72rem',color:'var(--muted2)',marginBottom:10}}>
                      <span>📋 {c.task_count||0} tasks</span>
                      <span>✅ {c.done_count||0} done</span>
                    </div>
                    <div style={{display:'flex',gap:8}} onClick={e=>e.stopPropagation()}>
                      <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>{setEditing(c);setForm({name:c.name,contact_name:c.contact_name||'',contact_email:c.contact_email||'',contact_phone:c.contact_phone||'',industry:c.industry||'',notes:c.notes||'',status:c.status});setModal(true);}}>✏️ Edit</Btn>
                      <Btn variant="danger" size="sm" onClick={()=>del(c.id)}>🗑</Btn>
                    </div>
                  </Card>
                );
              })
            }
          </div>

          {/* Client tasks panel — Feature #1 */}
          {selected&&(
            <Card style={{overflow:'hidden',padding:0}}>
              <div style={{padding:'14px 16px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(124,92,252,.05)'}}>
                <div>
                  <div style={{fontWeight:800,fontSize:'1rem'}}>📋 {selected.name} — Tasks</div>
                  <div style={{fontSize:'.73rem',color:'var(--muted2)',marginTop:2}}>{cTasks.length} tasks total</div>
                </div>
                <Btn variant="ghost" size="sm" onClick={()=>{setSelected(null);setCTasks([]);}}>✕ Close</Btn>
              </div>
              <div style={{padding:16,maxHeight:'calc(100vh - 280px)',overflowY:'auto'}}>
                {taskLoading
                  ?<div style={{display:'flex',justifyContent:'center',padding:24}}><Spinner size={22}/></div>
                  :cTasks.length===0
                    ?<div style={{textAlign:'center',padding:'32px 0',color:'var(--muted)',fontSize:'.85rem'}}>No tasks for this client yet.</div>
                    :(['todo','inprogress','review','done'].map(st=>{
                        const grp=cTasks.filter(t=>t.status===st);
                        if(!grp.length)return null;
                        const tc=TASK_STATUS[st];
                        return (
                          <div key={st} style={{marginBottom:20}}>
                            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:tc.color,marginBottom:10}}>
                              {tc.label} ({grp.length})
                            </div>
                            {grp.map(t=>(
                              <div key={t.id} style={{padding:'10px 12px',background:'var(--surface3)',borderRadius:10,marginBottom:7,border:'1px solid var(--border)'}}>
                                <div style={{fontSize:'.83rem',fontWeight:600,marginBottom:6}}>{t.title}</div>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                                    <Tag text={t.priority}/>
                                    {t.owner_name&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:'.7rem',color:'var(--muted2)'}}><Avatar name={t.owner_name} size={18} color="#7C5CFC"/>{t.owner_name}</div>}
                                    {t.created_by_name&&t.created_by_name!==t.owner_name&&<div style={{fontSize:'.68rem',color:'var(--muted)'}}>by {t.created_by_name}</div>}
                                  </div>
                                  <div style={{display:'flex',gap:8,fontSize:'.68rem',color:'var(--muted)'}}>
                                    {t.post_date&&<span style={{color:'#9D7FFF'}}>📤 {String(t.post_date).slice(0,10)}</span>}
                                    {t.deadline&&<span>⏰ {String(t.deadline).slice(0,10)}</span>}
                                  </div>
                                </div>
                                {t.description&&<div style={{fontSize:'.74rem',color:'var(--muted)',marginTop:5,lineHeight:1.4}}>{t.description}</div>}
                              </div>
                            ))}
                          </div>
                        );
                      }))
                }
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={()=>{setModal(false);setEditing(null);}} title={editing?'Edit Client':'Add New Client'} width={520}>
        <Input label="Client / Brand Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Scale Up Salon"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Contact Person" value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Priya"/>
          <Input label="Industry" value={form.industry} onChange={e=>setForm(f=>({...f,industry:e.target.value}))} placeholder="Beauty & Wellness"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Email" type="email" value={form.contact_email} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))} placeholder="contact@brand.com"/>
          <Input label="Phone / WhatsApp" value={form.contact_phone} onChange={e=>setForm(f=>({...f,contact_phone:e.target.value}))} placeholder="+91 98765 43210"/>
        </div>
        <Select label="Status" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Textarea label="Notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes about this client…"/>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setModal(false);setEditing(null);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Add Client'}</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
