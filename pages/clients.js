import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Textarea, Spinner, EmptyState, toast, sounds, api } from '../components/UI';

export default function Clients() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status]);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(df());

  function df(){ return { name:'',contact_name:'',contact_email:'',contact_phone:'',industry:'',notes:'',status:'active' }; }

  useEffect(()=>{ if(status==='authenticated') fetchAll(); },[status]);
  async function fetchAll(){ const d=await api('/api/clients'); setClients(Array.isArray(d)?d:[]); setLoading(false); }

  async function save() {
    if(!form.name.trim()){ toast.error('Name required'); sounds.error(); return; }
    if(editing){ await api('/api/clients','PATCH',{ id:editing.id, ...form }); toast.success('Client updated'); }
    else { await api('/api/clients','POST',form); toast.success('Client added! 🏢','🏢'); sounds.success(); }
    setModal(false); fetchAll();
  }

  async function del(id) {
    if(!confirm('Delete this client?')) return;
    await api(`/api/clients?id=${id}`,'DELETE');
    toast.info('Client removed'); fetchAll();
  }

  const S={ active:{ bg:'rgba(0,229,160,.1)',color:'var(--green)',label:'Active' }, inactive:{ bg:'rgba(107,107,138,.1)',color:'var(--muted)',label:'Inactive' }, prospect:{ bg:'rgba(0,212,255,.1)',color:'var(--cyan)',label:'Prospect' } };

  if(loading) return <Layout><div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12 }}><Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading…</span></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <div><h2 style={{ fontWeight:900,fontSize:'1.3rem',marginBottom:4 }}>Clients</h2>
            <p style={{ fontSize:'.82rem',color:'var(--muted2)' }}>{clients.filter(c=>c.status==='active').length} active · {clients.filter(c=>c.status==='prospect').length} prospects</p></div>
          <Btn onClick={()=>{ setEditing(null); setForm(df()); setModal(true); }}>+ Add Client</Btn>
        </div>
        {clients.length===0
          ? <EmptyState emoji="🏢" title="No clients yet" subtitle="Add your first client to start assigning tasks." action={<Btn onClick={()=>{ setEditing(null); setForm(df()); setModal(true); }}>+ Add Client</Btn>}/>
          : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16 }}>
              {clients.map(c=>{
                const s=S[c.status]||S.active;
                return (
                  <Card key={c.id} hover>
                    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:38,height:38,borderRadius:10,background:'rgba(124,92,252,.15)',border:'1px solid rgba(124,92,252,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem' }}>🏢</div>
                        <div><div style={{ fontWeight:800,fontSize:'.92rem' }}>{c.name}</div>{c.industry&&<div style={{ fontSize:'.7rem',color:'var(--muted)' }}>{c.industry}</div>}</div>
                      </div>
                      <span style={{ background:s.bg,color:s.color,fontSize:'.65rem',fontWeight:700,padding:'3px 9px',borderRadius:20,whiteSpace:'nowrap' }}>{s.label}</span>
                    </div>
                    {c.contact_name&&<div style={{ fontSize:'.78rem',color:'var(--muted2)',marginBottom:3 }}>👤 {c.contact_name}</div>}
                    {c.contact_email&&<div style={{ fontSize:'.75rem',color:'var(--muted)',marginBottom:3 }}>📧 {c.contact_email}</div>}
                    {c.contact_phone&&<div style={{ fontSize:'.75rem',color:'var(--muted)',marginBottom:8 }}>📱 {c.contact_phone}</div>}
                    {c.notes&&<div style={{ fontSize:'.75rem',color:'var(--muted2)',background:'var(--surface3)',borderRadius:8,padding:'7px 10px',marginBottom:10,lineHeight:1.5 }}>{c.notes}</div>}
                    <div style={{ display:'flex',gap:10,fontSize:'.72rem',color:'var(--muted2)',marginBottom:12 }}>
                      <span>📋 {c.task_count||0} tasks</span><span>✅ {c.done_count||0} done</span>
                    </div>
                    <div style={{ display:'flex',gap:8 }}>
                      <Btn variant="ghost" size="sm" onClick={()=>{ setEditing(c); setForm({ name:c.name,contact_name:c.contact_name||'',contact_email:c.contact_email||'',contact_phone:c.contact_phone||'',industry:c.industry||'',notes:c.notes||'',status:c.status }); setModal(true); }} style={{ flex:1 }}>✏️ Edit</Btn>
                      <Btn variant="danger" size="sm" onClick={()=>del(c.id)}>🗑</Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
        }
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'Edit Client':'Add New Client'} width={520}>
        <Input label="Client / Brand Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Scale Up Salon"/>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          <Input label="Contact Person" value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Priya"/>
          <Input label="Industry" value={form.industry} onChange={e=>setForm(f=>({...f,industry:e.target.value}))} placeholder="Beauty & Wellness"/>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          <Input label="Email" type="email" value={form.contact_email} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))} placeholder="contact@brand.com"/>
          <Input label="Phone / WhatsApp" value={form.contact_phone} onChange={e=>setForm(f=>({...f,contact_phone:e.target.value}))} placeholder="+91 98765 43210"/>
        </div>
        <Select label="Status" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
          <option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option>
        </Select>
        <Textarea label="Notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes about this client…"/>
        <div style={{ display:'flex',gap:10 }}>
          <Btn variant="ghost" onClick={()=>setModal(false)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={save} style={{ flex:2 }}>{editing?'Save Changes':'Add Client'}</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
