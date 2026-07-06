import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, EmptyState, Spinner, Avatar, toast, sounds, askAI } from '../components/UI';

async function fetchJ(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return r.json();
}

export default function Followups() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(()=>{if(status==='unauthenticated')router.replace('/login');},[status]);

  const [followups,setFollowups] = useState([]);
  const [clients,  setClients]   = useState([]);
  const [members,  setMembers]   = useState([]);
  const [loading,  setLoading]   = useState(true);
  const [modal,    setModal]     = useState(false);
  const [form,     setForm]      = useState({client_id:'',subject:'',due_date:'',assigned_to:''});
  const [drafts,   setDrafts]    = useState({});
  const [drafting, setDrafting]  = useState({});
  const [doneLoading, setDoneLoading] = useState({});

  useEffect(()=>{if(status==='authenticated')fetchAll();},[status]);

  async function fetchAll(){
    const [f,c,m]=await Promise.all([fetchJ('/api/followups'),fetchJ('/api/clients'),fetchJ('/api/members')]);
    setFollowups(Array.isArray(f)?f:[]);
    setClients(Array.isArray(c)?c:[]);
    setMembers(Array.isArray(m)?m:[]);
    setLoading(false);
  }

  async function create(){
    if(!form.subject){toast.error('Subject required');return;}
    const r=await fetchJ('/api/followups','POST',form);
    if(r.error){toast.error(r.error);return;}
    toast.success('Follow-up added! 📩');
    setModal(false);
    setForm({client_id:'',subject:'',due_date:'',assigned_to:''});
    fetchAll();
  }

  async function draftAI(id,subject,clientName){
    setDrafting(d=>({...d,[id]:true}));
    const r=await askAI('Draft a warm WhatsApp follow-up for a social media agency.\nSubject: "'+subject+'"\nClient: '+(clientName||'the client')+'\nMax 80 words. Friendly, professional, clear CTA.');
    setDrafts(d=>({...d,[id]:r}));
    setDrafting(d=>({...d,[id]:false}));
    sounds.pop();
  }

  async function markDone(id){
    setDoneLoading(d=>({...d,[id]:true}));
    const body = drafts[id]||null;
    const r = await fetchJ('/api/followups','PATCH',{id,status:'done',body});
    setDoneLoading(d=>({...d,[id]:false}));
    if(r.error){toast.error('Failed: '+r.error);return;}
    toast.success('Follow-up done! +30 🪙 ✅');
    sounds.success();
    fetchAll();
  }

  async function deleteFU(id){
    await fetchJ('/api/followups?id='+id,'DELETE');
    toast.info('Deleted');fetchAll();
  }

  if(loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><Spinner size={28}/></div></Layout>;

  const pending = followups.filter(f=>f.status==='pending');
  const done    = followups.filter(f=>f.status==='done');

  return (
    <Layout badges={{followups:pending.length}}>
      <div className="fade-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:4}}>Follow-ups 📩</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>{pending.length} pending · {done.length} done · +30 🪙 per completion</p>
          </div>
          <Btn onClick={()=>setModal(true)}>+ Add Follow-up</Btn>
        </div>

        {pending.length===0&&done.length===0
          ?<EmptyState emoji="📩" title="No follow-ups yet" subtitle="Track client comms and get AI-drafted messages." action={<Btn onClick={()=>setModal(true)}>+ Add Follow-up</Btn>}/>
          :(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {pending.map(f=>(
                <Card key={f.id}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'.9rem',marginBottom:5}}>{f.subject}</div>
                      <div style={{fontSize:'.76rem',color:'var(--muted2)',marginBottom:6}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                        {f.client_logo?<img src={f.client_logo} alt={f.client_name} style={{width:14,height:14,borderRadius:3,objectFit:'cover'}}/>:'🏢'}
                        {f.client_name||'No client'}
                      </span>
                      {f.assignee_name&&(
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,marginLeft:8}}>
                          <Avatar name={f.assignee_name} image={f.assignee_image} size={16} color="#7C5CFC"/>
                          {f.assignee_name}
                        </span>
                      )}
                      </div>
                      {f.due_date&&<span style={{background:'rgba(255,77,109,.1)',color:'var(--red)',fontSize:'.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20}}>⏰ {String(f.due_date).slice(0,10)}</span>}
                    </div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',flexShrink:0}}>
                      <Btn variant="ghost" size="sm" onClick={()=>draftAI(f.id,f.subject,f.client_name)} disabled={drafting[f.id]}>
                        {drafting[f.id]?'⏳':'🤖'} Draft
                      </Btn>
                      <Btn size="sm" onClick={()=>markDone(f.id)} disabled={doneLoading[f.id]}>
                        {doneLoading[f.id]?'⏳ Saving…':'✅ Done +30 🪙'}
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={()=>deleteFU(f.id)}>🗑</Btn>
                    </div>
                  </div>
                  {drafts[f.id]&&(
                    <div style={{marginTop:14,background:'rgba(124,92,252,.06)',border:'1px solid rgba(124,92,252,.2)',borderRadius:10,padding:14,fontSize:'.8rem',lineHeight:1.65,color:'var(--muted2)',whiteSpace:'pre-wrap'}}>
                      <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--purple2)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.08em'}}>AI Draft</div>
                      {drafts[f.id]}
                      <div style={{display:'flex',gap:8,marginTop:10}}>
                        <Btn variant="ghost" size="sm" onClick={()=>navigator.clipboard?.writeText(drafts[f.id]).then(()=>toast.success('Copied! 📋'))}>📋 Copy</Btn>
                        <Btn size="sm" onClick={()=>markDone(f.id)} disabled={doneLoading[f.id]}>{doneLoading[f.id]?'⏳':'✅ Mark Sent +30 🪙'}</Btn>
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              {done.length>0&&(
                <>
                  <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--muted)',marginTop:8,marginBottom:6}}>Completed ({done.length})</div>
                  {done.map(f=>(
                    <div key={f.id} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:12,opacity:.5,display:'flex',alignItems:'center',gap:8}}>
                      <span>✅</span>
                      <span style={{fontSize:'.82rem',fontWeight:600,textDecoration:'line-through',color:'var(--muted)',flex:1}}>{f.subject}</span>
                      <span style={{fontSize:'.7rem',color:'var(--muted)'}}>{f.client_name}</span>
                      {f.sent_at&&<span style={{fontSize:'.68rem',color:'var(--muted)'}}>{new Date(f.sent_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        }
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="New Follow-up" width={460}>
        <Select label="Client" value={form.client_id} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))}>
          <option value="">No client</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Subject *" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="e.g. July Content Calendar Approval"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Due Date" type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
          <Select label="Assign To" value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}>
            <option value="">Me</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
          </Select>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>setModal(false)} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={create} style={{flex:2}}>Add Follow-up</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
