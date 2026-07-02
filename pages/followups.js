import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, EmptyState, Spinner, launchConfetti, toast, sounds, api, askAI } from '../components/UI';

export default function Followups() {
  const { status, data:session } = useSession();
  const router = useRouter();
  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status]);

  const [followups, setFollowups] = useState([]);
  const [clients,   setClients]   = useState([]);
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState({ client_id:'',subject:'',due_date:'',assigned_to:'' });
  const [drafts,    setDrafts]    = useState({});
  const [drafting,  setDrafting]  = useState({});

  useEffect(()=>{ if(status==='authenticated') fetchAll(); },[status]);
  async function fetchAll() {
    const [f,c,m]=await Promise.all([api('/api/followups'),api('/api/clients'),api('/api/members')]);
    setFollowups(Array.isArray(f)?f:[]); setClients(Array.isArray(c)?c:[]); setMembers(Array.isArray(m)?m:[]); setLoading(false);
  }

  async function create() {
    if(!form.subject){ toast.error('Subject required'); return; }
    await api('/api/followups','POST',form);
    toast.success('Follow-up added!','📩'); setModal(false); setForm({ client_id:'',subject:'',due_date:'',assigned_to:'' }); fetchAll();
  }

  async function draftAI(id,subject,clientName) {
    setDrafting(d=>({...d,[id]:true}));
    const r=await askAI(`Draft a warm, professional WhatsApp follow-up for a creative agency.\nSubject: "${subject}"\nClient: ${clientName||'the client'}\nKeep it under 80 words. Natural, friendly tone, clear CTA.`);
    setDrafts(d=>({...d,[id]:r})); setDrafting(d=>({...d,[id]:false})); sounds.pop();
  }

  async function markDone(id) {
    await api('/api/followups','PATCH',{ id, status:'done' });
    toast.success('Follow-up done! +30 🪙','✅'); sounds.success(); fetchAll();
  }

  if(loading) return <Layout><div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12 }}><Spinner size={28}/></div></Layout>;

  const pending=followups.filter(f=>f.status==='pending');
  const done=followups.filter(f=>f.status==='done');

  return (
    <Layout badges={{ followups:pending.length }}>
      <div className="fade-up">
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <div><h2 style={{ fontWeight:900,fontSize:'1.3rem',marginBottom:4 }}>Follow-ups</h2>
            <p style={{ fontSize:'.82rem',color:'var(--muted2)' }}>{pending.length} pending · {done.length} done</p></div>
          <Btn onClick={()=>setModal(true)}>+ Add Follow-up</Btn>
        </div>

        {pending.length===0&&done.length===0
          ? <EmptyState emoji="📩" title="No follow-ups yet" subtitle="Track client comms and draft messages with AI." action={<Btn onClick={()=>setModal(true)}>+ Add Follow-up</Btn>}/>
          : <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              {pending.map(f=>(
                <Card key={f.id}>
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:'.9rem',marginBottom:4 }}>{f.subject}</div>
                      <div style={{ fontSize:'.76rem',color:'var(--muted2)',marginBottom:6 }}>🏢 {f.client_name||'No client'}{f.assignee_name?` · 👤 ${f.assignee_name}`:''}</div>
                      <div style={{ display:'flex',gap:8 }}>
                        {f.due_date&&<span style={{ background:'rgba(255,77,109,.1)',color:'var(--red)',fontSize:'.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20 }}>⏰ {f.due_date?.toString().slice(0,10)}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                      <Btn variant="ghost" size="sm" onClick={()=>draftAI(f.id,f.subject,f.client_name)} disabled={drafting[f.id]}>{drafting[f.id]?'⏳':'🤖'} Draft</Btn>
                      <Btn size="sm" onClick={()=>markDone(f.id)}>✅ Done</Btn>
                    </div>
                  </div>
                  {drafts[f.id]&&<div style={{ marginTop:14,background:'rgba(124,92,252,.06)',border:'1px solid rgba(124,92,252,.2)',borderRadius:10,padding:14,fontSize:'.8rem',lineHeight:1.65,color:'var(--muted2)',whiteSpace:'pre-wrap' }}>
                    {drafts[f.id]}
                    <div style={{ display:'flex',gap:8,marginTop:10 }}>
                      <Btn variant="ghost" size="sm" onClick={()=>navigator.clipboard?.writeText(drafts[f.id]).then(()=>toast.success('Copied!','📋'))}>📋 Copy</Btn>
                      <Btn size="sm" onClick={()=>markDone(f.id)}>✅ Mark Sent</Btn>
                    </div>
                  </div>}
                </Card>
              ))}
              {done.length>0&&<>
                <div style={{ fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginTop:8,marginBottom:6 }}>Completed</div>
                {done.map(f=><div key={f.id} style={{ background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:12,opacity:.45,display:'flex',alignItems:'center',gap:8 }}>
                  <span>✅</span><span style={{ fontSize:'.82rem',fontWeight:600,textDecoration:'line-through',color:'var(--muted)' }}>{f.subject}</span>
                  <span style={{ fontSize:'.7rem',color:'var(--muted)',marginLeft:'auto' }}>{f.client_name}</span>
                </div>)}
              </>}
            </div>
        }
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="New Follow-up" width={460}>
        <Select label="Client" value={form.client_id} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))}>
          <option value="">No client</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Subject *" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="e.g. July Content Calendar Approval"/>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          <Input label="Due Date" type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
          <Select label="Assign To" value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}>
            <option value="">Me</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
          </Select>
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <Btn variant="ghost" onClick={()=>setModal(false)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={create} style={{ flex:2 }}>Add Follow-up</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
