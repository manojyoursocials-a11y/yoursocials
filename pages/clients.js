import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Textarea, Spinner, EmptyState, Tag, Avatar, toast, sounds } from '../components/UI';

async function fetchJ(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined });
  return r.json();
}

const df = () => ({ name:'', contact_name:'', contact_email:'', contact_phone:'', industry:'', notes:'', status:'active', logo:'' });

const STATUS_COL = {
  active:   { bg:'rgba(0,229,160,.12)',   color:'#00E5A0' },
  inactive: { bg:'rgba(107,107,138,.12)', color:'#9090AA' },
  prospect: { bg:'rgba(0,212,255,.12)',   color:'#00D4FF' },
};
const TASK_STATUS = {
  todo:       { color:'#9090AA', label:'To Do'        },
  inprogress: { color:'#00D4FF', label:'In Progress'  },
  review:     { color:'#FFD60A', label:'Under Review' },
  done:       { color:'#00E5A0', label:'Done'         },
};

export default function Clients() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const [clients,     setClients]    = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [modal,       setModal]      = useState(false);
  const [editing,     setEditing]    = useState(null);
  const [form,        setForm]       = useState(df());
  const [selected,    setSelected]   = useState(null);
  const [cTasks,      setCTasks]     = useState([]);
  const [taskLoading, setTL]         = useState(false);
  const [saving,      setSaving]     = useState(false);

  useEffect(() => { if (status==='authenticated') fetchAll(); }, [status]);

  async function fetchAll() {
    const d = await fetchJ('/api/clients');
    setClients(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function loadClientTasks(client) {
    if (selected?.id === client.id) { setSelected(null); setCTasks([]); return; }
    setSelected(client); setTL(true);
    const t = await fetchJ('/api/tasks?client='+client.id);
    setCTasks(Array.isArray(t) ? t : []); setTL(false);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    if (editing) {
      const r = await fetchJ('/api/clients','PATCH',{ id:editing.id, ...form });
      if (r.error) { toast.error(r.error); setSaving(false); return; }
      toast.success('Client updated!');
    } else {
      const r = await fetchJ('/api/clients','POST', form);
      if (r.error) { toast.error(r.error); setSaving(false); return; }
      toast.success('Client added! 🏢'); sounds.pop();
    }
    setSaving(false); setModal(false); setEditing(null); fetchAll();
  }

  async function del(id) {
    if (!confirm('Delete this client and all their task associations?')) return;
    await fetchJ('/api/clients?id='+id, 'DELETE');
    toast.info('Client removed'); fetchAll();
    if (selected?.id===id) { setSelected(null); setCTasks([]); }
  }

  function openEdit(c) {
    setEditing(c);
    setForm({ name:c.name, contact_name:c.contact_name||'', contact_email:c.contact_email||'', contact_phone:c.contact_phone||'', industry:c.industry||'', notes:c.notes||'', status:c.status, logo:c.logo||'' });
    setModal(true);
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { toast.error('Logo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, logo: ev.target.result }));
    reader.readAsDataURL(file);
  }

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <Spinner size={28}/>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="fade-up">
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:4 }}>Clients 🏢</h2>
            <p style={{ fontSize:'.82rem', color:'var(--muted2)' }}>
              {clients.filter(c=>c.status==='active').length} active ·{' '}
              {clients.filter(c=>c.status==='prospect').length} prospects ·{' '}
              click a client to see tasks
            </p>
          </div>
          <Btn onClick={() => { setEditing(null); setForm(df()); setModal(true); }}>+ Add Client</Btn>
        </div>

        {/* Client grid + task panel side by side */}
        <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap:20, alignItems:'start' }}>

          {/* ── CLIENT CARDS GRID ──────────────────── */}
          {clients.length === 0
            ? <EmptyState emoji="🏢" title="No clients yet" subtitle="Add your first client." action={<Btn onClick={() => { setEditing(null); setForm(df()); setModal(true); }}>+ Add Client</Btn>}/>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
                {clients.map(c => {
                  const s    = STATUS_COL[c.status] || STATUS_COL.active;
                  const isSel = selected?.id === c.id;
                  const compPct = c.task_count > 0 ? Math.round((c.done_count/c.task_count)*100) : 0;

                  return (
                    <div key={c.id}
                      onClick={() => loadClientTasks(c)}
                      style={{ background: isSel ? 'rgba(124,92,252,.08)' : 'var(--surface2)', border:`1px solid ${isSel?'var(--purple)':'var(--border)'}`, borderRadius:16, overflow:'hidden', cursor:'pointer', transition:'all .18s', display:'flex', flexDirection:'column' }}
                      onMouseEnter={e => { if(!isSel){e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='var(--shadow-lg)'; }}}
                      onMouseLeave={e => { if(!isSel){e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}}>

                      {/* Logo banner */}
                      <div style={{ height:90, background: c.logo ? 'transparent' : 'linear-gradient(135deg,rgba(124,92,252,.15),rgba(0,212,255,.08))', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative', borderBottom:'1px solid var(--border)' }}>
                        {c.logo
                          ? <img src={c.logo} alt={c.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                              <div style={{ fontSize:'2rem' }}>🏢</div>
                              <div style={{ fontSize:'.65rem', color:'var(--muted)', fontWeight:500 }}>No logo</div>
                            </div>
                        }
                        {/* Status badge top-right */}
                        <span style={{ position:'absolute', top:8, right:8, background:s.bg, color:s.color, fontSize:'.62rem', fontWeight:700, padding:'2px 8px', borderRadius:20, backdropFilter:'blur(8px)' }}>{c.status}</span>
                      </div>

                      {/* Card body */}
                      <div style={{ padding:'14px 14px 12px', flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:'.95rem', marginBottom:2 }}>{c.name}</div>
                        {c.industry && <div style={{ fontSize:'.7rem', color:'var(--muted)', marginBottom:8 }}>{c.industry}</div>}

                        {c.contact_name  && <div style={{ fontSize:'.76rem', color:'var(--muted2)', marginBottom:2 }}>👤 {c.contact_name}</div>}
                        {c.contact_phone && <div style={{ fontSize:'.73rem', color:'var(--muted)',  marginBottom:2 }}>📱 {c.contact_phone}</div>}
                        {c.contact_email && <div style={{ fontSize:'.73rem', color:'var(--muted)',  marginBottom:8 }}>📧 {c.contact_email}</div>}

                        {/* Task progress bar */}
                        {c.task_count > 0 && (
                          <div style={{ marginBottom:10 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.7rem', color:'var(--muted2)', marginBottom:4 }}>
                              <span>📋 {c.task_count} tasks</span>
                              <span style={{ color:'var(--green)', fontWeight:700 }}>✅ {c.done_count} done · {compPct}%</span>
                            </div>
                            <div style={{ height:4, background:'var(--surface3)', borderRadius:4, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${compPct}%`, background:'var(--green)', borderRadius:4, transition:'width 1s' }}/>
                            </div>
                          </div>
                        )}
                        {c.task_count === 0 && <div style={{ fontSize:'.73rem', color:'var(--muted)', marginBottom:10 }}>No tasks yet</div>}
                      </div>

                      {/* Action row */}
                      <div style={{ padding:'0 12px 12px', display:'flex', gap:8 }} onClick={e => e.stopPropagation()}>
                        <Btn variant="ghost" size="sm" style={{ flex:1 }} onClick={() => openEdit(c)}>✏️ Edit</Btn>
                        <Btn variant="danger" size="sm" onClick={() => del(c.id)}>🗑</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
          }

          {/* ── TASK PANEL ─────────────────────────── */}
          {selected && (
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', position:'sticky', top:0 }}>
              {/* Panel header */}
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'rgba(124,92,252,.05)', display:'flex', alignItems:'center', gap:12 }}>
                {selected.logo
                  ? <img src={selected.logo} alt={selected.name} style={{ width:36, height:36, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>
                  : <div style={{ width:36, height:36, borderRadius:8, background:'rgba(124,92,252,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>🏢</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:'.95rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selected.name}</div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted2)' }}>{cTasks.length} tasks total</div>
                </div>
                <button onClick={() => { setSelected(null); setCTasks([]); }}
                  style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, cursor:'pointer', color:'var(--muted)', fontSize:'.9rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
              </div>

              {/* Task list */}
              <div style={{ maxHeight:'calc(100vh - 300px)', overflowY:'auto', padding:14 }}>
                {taskLoading
                  ? <div style={{ display:'flex', justifyContent:'center', padding:24 }}><Spinner size={22}/></div>
                  : cTasks.length === 0
                    ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted)', fontSize:'.85rem' }}>No tasks for this client yet.</div>
                    : ['todo','inprogress','review','done'].map(st => {
                        const grp = cTasks.filter(t => t.status===st);
                        if (!grp.length) return null;
                        const tc = TASK_STATUS[st];
                        return (
                          <div key={st} style={{ marginBottom:18 }}>
                            <div style={{ fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:tc.color, marginBottom:8 }}>
                              {tc.label} ({grp.length})
                            </div>
                            {grp.map(t => (
                              <div key={t.id} style={{ padding:'10px 12px', background:'var(--surface3)', borderRadius:10, marginBottom:7, border:'1px solid var(--border)' }}>
                                <div style={{ fontSize:'.82rem', fontWeight:600, marginBottom:5 }}>{t.title}</div>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                                  <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                                    <Tag text={t.priority}/>
                                    {t.owner_name && <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.7rem', color:'var(--muted2)' }}><Avatar name={t.owner_name} image={t.owner_image} size={18} color="#7C5CFC"/>{t.owner_name.split(' ')[0]}</div>}
                                  </div>
                                  <div style={{ display:'flex', gap:8, fontSize:'.68rem', color:'var(--muted)' }}>
                                    {t.post_date && <span style={{ color:'#9D7FFF' }}>📤 {String(t.post_date).slice(0,10)}</span>}
                                    {t.deadline  && <span>⏰ {String(t.deadline).slice(0,10)}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ──────────────────────────────────── */}
      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Client' : 'Add New Client'} width={520}>

        {/* Logo upload */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:'.73rem', fontWeight:600, color:'var(--muted2)', marginBottom:8, letterSpacing:'.04em' }}>CLIENT LOGO</div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:64, height:64, borderRadius:12, overflow:'hidden', background:'var(--surface3)', border:'2px solid var(--border2)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {form.logo
                ? <img src={form.logo} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <span style={{ fontSize:'1.8rem', opacity:.4 }}>🏢</span>
              }
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <label style={{ cursor:'pointer', padding:'7px 14px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, fontSize:'.8rem', color:'var(--muted2)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:7 }}>
                🖼️ Upload Logo
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoUpload}/>
              </label>
              {form.logo && (
                <button onClick={() => setForm(f => ({ ...f, logo:'' }))} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.78rem', textAlign:'left' }}>✕ Remove logo</button>
              )}
            </div>
          </div>
        </div>

        <Input label="Client / Brand Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="e.g. Scale Up Salon"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Contact Person" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name:e.target.value }))} placeholder="Priya"/>
          <Input label="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry:e.target.value }))} placeholder="Beauty & Wellness"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Email" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email:e.target.value }))} placeholder="contact@brand.com"/>
          <Input label="Phone / WhatsApp" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone:e.target.value }))} placeholder="+91 98765 43210"/>
        </div>
        <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} placeholder="Any notes about this client…"/>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => { setModal(false); setEditing(null); }} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={save} disabled={saving} style={{ flex:2 }}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Client'}</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
