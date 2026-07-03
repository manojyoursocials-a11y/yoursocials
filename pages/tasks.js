import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Select, Textarea, Tag, Avatar, Spinner, launchConfetti, toast, sounds, askAI, MEMBER_COLORS } from '../components/UI';

const COLS = [
  { id:'todo',       label:'To Do',       emoji:'📋', color:'#9090AA' },
  { id:'inprogress', label:'In Progress',  emoji:'⚡', color:'#00D4FF' },
  { id:'review',     label:'Under Review', emoji:'👁️', color:'#FFD60A' },
  { id:'done',       label:'Done',         emoji:'✅', color:'#00E5A0' },
];
const PRI_OPTS = { P1:'🔴 Critical', P2:'🟠 High', P3:'🟡 Medium', P4:'🟢 Low' };
const blank = () => ({ title:'', description:'', link:'', priority:'P3', owner_id:'', client_id:'', deadline:'', estimated_hours:'' });
const toUrl = s => !s ? s : (s.startsWith('http') ? s : 'https://'+s);

// ── Standalone fetch helpers — no dependency on UI.js api() ──
async function fetchJSON(url, method = 'GET', body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

export default function Tasks() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const [tasks,   setTasks]   = useState([]);
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);  // create/edit modal
  const [editing, setEditing] = useState(null);   // task being edited
  const [detail,  setDetail]  = useState(null);   // task in detail view
  const [form,    setForm]    = useState(blank());
  const [checks,  setChecks]  = useState([]);
  const [aiLoad,  setAiLoad]  = useState(false);
  const [aiSugg,  setAiSugg]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [saving,  setSaving]  = useState(false);
  const [moving,  setMoving]  = useState('');     // status being moved to

  const reload = useCallback(async () => {
    const [t, m, c] = await Promise.all([
      fetchJSON('/api/tasks'),
      fetchJSON('/api/members'),
      fetchJSON('/api/clients'),
    ]);
    setTasks(Array.isArray(t) ? t : []);
    setMembers(Array.isArray(m) ? m : []);
    setClients(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (status === 'authenticated') reload(); }, [status, reload]);

  function openCreate() {
    setEditing(null); setForm(blank()); setChecks([]); setModal(true);
  }

  function openEdit(task) {
    setEditing(task);
    setForm({
      title:           task.title || '',
      description:     task.description || '',
      link:            task.link || '',
      priority:        task.priority || 'P3',
      owner_id:        task.owner_id || '',
      client_id:       task.client_id || '',
      deadline:        task.deadline ? String(task.deadline).slice(0, 10) : '',
      estimated_hours: task.estimated_hours || '',
    });
    try { setChecks(JSON.parse(task.ai_checklist || '[]')); } catch { setChecks([]); }
    setDetail(null);
    setModal(true);
  }

  async function saveTask() {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    const payload = {
      title:           form.title.trim(),
      description:     form.description.trim(),
      link:            form.link.trim() ? toUrl(form.link.trim()) : null,
      priority:        form.priority || 'P3',
      owner_id:        form.owner_id || null,
      client_id:       form.client_id || null,
      deadline:        form.deadline || null,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      ai_checklist:    JSON.stringify(checks),
    };
    let res;
    if (editing) {
      // PATCH with id + title = EDIT in the API
      res = await fetchJSON('/api/tasks', 'PATCH', { id: editing.id, ...payload });
    } else {
      res = await fetchJSON('/api/tasks', 'POST', payload);
    }
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editing ? 'Task updated! ✅' : 'Task created! +10 🪙');
    sounds.pop();
    setModal(false); setEditing(null); setForm(blank()); setChecks([]);
    reload();
  }

  async function moveTask(taskId, newStatus) {
    if (moving) return; // prevent double-click
    setMoving(newStatus);
    // PATCH with id + status only = MOVE in the API
    const res = await fetchJSON('/api/tasks', 'PATCH', { id: taskId, status: newStatus });
    setMoving('');
    if (res.error) { toast.error('Move failed: ' + res.error); reload(); return; }
    // Update detail modal to reflect new status immediately
    setDetail(prev => prev ? { ...prev, status: newStatus } : prev);
    // Update board immediately
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    if (newStatus === 'done') { launchConfetti(); sounds.confetti(); toast.success('Done! +50 🪙 🎉'); }
    else { sounds.pop(); toast.info('Moved to ' + COLS.find(c => c.id === newStatus)?.label); }
    reload();
  }

  async function deleteTask(id) {
    await fetchJSON('/api/tasks?id=' + id, 'DELETE');
    setDetail(null); toast.info('Deleted'); reload();
  }

  async function genChecklist() {
    if (!form.title) { toast.error('Enter a title first'); return; }
    setAiLoad(true);
    const r = await askAI('Generate 5-7 checklist steps for: "' + form.title + '". Return ONLY a numbered list, one item per line.');
    setChecks(r.split('\n').filter(l => l.trim()).slice(0, 7).map(l => ({ text: l.replace(/^\d+[\.\)]\s*/, '').trim(), done: false })));
    setAiLoad(false); sounds.pop();
  }

  async function getAiHelp(task) {
    setAiSugg('loading');
    const r = await askAI('Give 3 practical suggestions to improve: "' + task.title + '" (Priority: ' + task.priority + ', Client: ' + (task.client_name || 'Internal') + ').');
    setAiSugg(r);
  }

  const filtered = tasks.filter(t => filter === 'all' || t.owner_id === filter);

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
        <Spinner size={28}/><span style={{ color:'#9090AA' }}>Loading tasks…</span>
      </div>
    </Layout>
  );

  return (
    <Layout badges={{ tasks: tasks.filter(t => t.status === 'todo').length }}>
      <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 110px)' }}>

        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ background:'#1C1C28', border:'1px solid rgba(255,255,255,.13)', borderRadius:10, padding:'7px 12px', fontSize:'.8rem', color:'#F0EFFF', fontFamily:'Inter,sans-serif', cursor:'pointer' }}>
            <option value="all">All members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
          <button onClick={openCreate}
            style={{ marginLeft:'auto', padding:'8px 18px', background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:'.82rem', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            + New Task
          </button>
        </div>

        {/* Kanban board */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, flex:1, overflow:'hidden' }}>
          {COLS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id);
            return (
              <div key={col.id} style={{ background:'#16161F', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'13px 13px 9px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'.8rem', fontWeight:700, color:col.color }}>{col.emoji} {col.label}</span>
                  <span style={{ background:'#1C1C28', color:'#9090AA', fontSize:'.63rem', fontWeight:700, padding:'2px 7px', borderRadius:20 }}>{colTasks.length}</span>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:7 }}>
                  {colTasks.length === 0 && <div style={{ color:'#6B6B8A', fontSize:'.73rem', textAlign:'center', padding:'20px 0' }}>No tasks</div>}
                  {colTasks.map(t => {
                    const over = t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date();
                    return (
                      <div key={t.id}
                        onClick={() => { setDetail(t); setAiSugg(''); }}
                        style={{ background:'#1C1C28', border:'1px solid '+(over?'rgba(255,77,109,.4)':'rgba(255,255,255,.07)'), borderRadius:10, padding:12, cursor:'pointer', transition:'border-color .15s,transform .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='#7C5CFC'; e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor=over?'rgba(255,77,109,.4)':'rgba(255,255,255,.07)'; e.currentTarget.style.transform=''; }}>
                        <div style={{ fontSize:'.82rem', fontWeight:600, marginBottom:7, color:'#F0EFFF' }}>{t.title}</div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
                          <Tag text={t.priority}/>
                          {t.client_name && <span style={{ fontSize:'.64rem', color:'#6B6B8A' }}>{t.client_name}</span>}
                          {t.link && <span style={{ fontSize:'.64rem', color:'#9D7FFF' }}>🔗</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          {t.owner_name && <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.68rem', color:'#9090AA' }}><Avatar name={t.owner_name} size={18} color="#7C5CFC"/>{t.owner_name.split(' ')[0]}</div>}
                          {t.deadline && <span style={{ fontSize:'.67rem', color:over?'#FF4D6D':'#6B6B8A', fontWeight:over?700:400 }}>📅 {String(t.deadline).slice(0,10)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={openCreate}
                  style={{ margin:8, padding:8, borderRadius:8, border:'1px dashed rgba(255,255,255,.13)', background:'transparent', color:'#6B6B8A', fontSize:'.74rem', cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#7C5CFC'; e.currentTarget.style.color='#9D7FFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.13)'; e.currentTarget.style.color='#6B6B8A'; }}>
                  + Add task
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Create/Edit modal ────────────────────────────── */}
        <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? '✏️ Edit Task' : '+ New Task'} width={580}>
          <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} placeholder="e.g. Instagram Reels — June Recap"/>
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} placeholder="What needs to be done…"/>
          <Input label="Link (any URL)" value={form.link} onChange={e => setForm(f => ({ ...f, link:e.target.value }))} placeholder="https://drive.google.com/..."/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority:e.target.value }))}>
              {Object.entries(PRI_OPTS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select label="Assign To" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id:e.target.value }))}>
              <option value="">Me</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
            </Select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Select label="Client" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id:e.target.value }))}>
              <option value="">Internal</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline:e.target.value }))}/>
          </div>
          <Input label="Estimated Hours" type="number" min="0.5" step="0.5" value={form.estimated_hours} onChange={e => setForm(f => ({ ...f, estimated_hours:e.target.value }))} placeholder="e.g. 3"/>
          {checks.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:'.73rem', fontWeight:600, color:'#9090AA', marginBottom:8 }}>🤖 Checklist</div>
              {checks.map((item, i) => (
                <label key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:'.8rem', cursor:'pointer', color:'#9090AA', marginBottom:5 }}>
                  <input type="checkbox" checked={item.done} onChange={e => setChecks(c => c.map((x,j) => j===i?{...x,done:e.target.checked}:x))} style={{ marginTop:2, accentColor:'#7C5CFC' }}/>
                  {item.text}
                </label>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <Btn variant="ghost" onClick={genChecklist} disabled={aiLoad} style={{ flex:1 }}>{aiLoad?'⏳ Generating…':'🤖 AI Checklist'}</Btn>
            <Btn onClick={saveTask} disabled={saving} style={{ flex:2 }}>{saving?'Saving…':editing?'💾 Save Changes':'Create Task'}</Btn>
          </div>
        </Modal>

        {/* ── Detail modal ─────────────────────────────────── */}
        <Modal open={!!detail} onClose={() => { setDetail(null); setAiSugg(''); }} title={detail?.title || ''} width={560}>
          {detail && (() => {
            const currentStatus = detail.status;
            return (
              <>
                {/* Tags */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                  <Tag text={detail.priority}/>
                  <Tag text={currentStatus}/>
                  {detail.client_name && <span style={{ background:'#1C1C28', color:'#9090AA', fontSize:'.68rem', fontWeight:600, padding:'2px 8px', borderRadius:6 }}>🏢 {detail.client_name}</span>}
                  {detail.deadline && <span style={{ background:'#1C1C28', color:'#9090AA', fontSize:'.68rem', fontWeight:600, padding:'2px 8px', borderRadius:6 }}>📅 {String(detail.deadline).slice(0,10)}</span>}
                  {detail.estimated_hours && <span style={{ background:'#1C1C28', color:'#9090AA', fontSize:'.68rem', fontWeight:600, padding:'2px 8px', borderRadius:6 }}>⏱ {detail.estimated_hours}h</span>}
                </div>

                {/* Description */}
                {detail.description && <p style={{ fontSize:'.83rem', color:'#9090AA', lineHeight:1.6, marginBottom:14 }}>{detail.description}</p>}

                {/* Link */}
                {detail.link && (
                  <div style={{ marginBottom:14 }}>
                    <a href={toUrl(detail.link)} target="_blank" rel="noopener noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', background:'rgba(124,92,252,.12)', border:'1px solid rgba(124,92,252,.3)', borderRadius:8, fontSize:'.82rem', color:'#9D7FFF', textDecoration:'none', fontWeight:600 }}>
                      🔗 Open Link ↗
                    </a>
                  </div>
                )}

                {/* ── MOVE TO section ── */}
                <div style={{ marginBottom:16, padding:14, background:'rgba(255,255,255,.03)', borderRadius:12, border:'1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700, color:'#6B6B8A', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:10 }}>
                    Move to
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {COLS.map(col => {
                      const isCurrent = col.id === currentStatus;
                      const isLoading = moving === col.id;
                      return (
                        <button key={col.id}
                          disabled={isCurrent || !!moving}
                          onClick={async () => {
                            await moveTask(detail.id, col.id);
                          }}
                          style={{
                            padding:'10px 14px',
                            borderRadius:10,
                            border:'1px solid '+(isCurrent ? col.color+'88' : 'rgba(255,255,255,.1)'),
                            background: isCurrent ? col.color+'22' : 'rgba(255,255,255,.03)',
                            color: isCurrent ? col.color : '#9090AA',
                            fontSize:'.8rem',
                            fontWeight: isCurrent ? 700 : 500,
                            cursor: isCurrent || moving ? 'default' : 'pointer',
                            fontFamily:'Inter,sans-serif',
                            transition:'all .15s',
                            display:'flex',
                            alignItems:'center',
                            gap:7,
                            opacity: (moving && !isCurrent && !isLoading) ? .4 : 1,
                          }}
                          onMouseEnter={e => { if(!isCurrent&&!moving){e.currentTarget.style.background=col.color+'18';e.currentTarget.style.borderColor=col.color+'66';e.currentTarget.style.color=col.color;} }}
                          onMouseLeave={e => { if(!isCurrent&&!moving){e.currentTarget.style.background='rgba(255,255,255,.03)';e.currentTarget.style.borderColor='rgba(255,255,255,.1)';e.currentTarget.style.color='#9090AA';} }}>
                          {isLoading ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,.2)', borderTopColor:col.color, borderRadius:'50%', animation:'spin .7s linear infinite' }}/> : col.emoji}
                          {col.label}
                          {isCurrent && <span style={{ marginLeft:'auto', fontSize:'.65rem', opacity:.7 }}>current</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <Btn variant="ghost" size="sm" onClick={() => openEdit(detail)} style={{ flex:1 }}>✏️ Edit</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => getAiHelp(detail)} style={{ flex:1 }}>🤖 AI Help</Btn>
                  <Btn variant="danger" size="sm" onClick={() => deleteTask(detail.id)}>🗑</Btn>
                </div>

                {/* AI suggestions */}
                {aiSugg === 'loading' && (
                  <div style={{ padding:12, background:'rgba(124,92,252,.06)', borderRadius:10, border:'1px solid rgba(124,92,252,.15)', display:'flex', gap:5, marginBottom:10 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#9D7FFF', animation:'bounce .9s infinite', animationDelay:i*.15+'s' }}/>)}
                  </div>
                )}
                {aiSugg && aiSugg !== 'loading' && (
                  <div style={{ padding:14, background:'rgba(124,92,252,.06)', borderRadius:10, border:'1px solid rgba(124,92,252,.15)', fontSize:'.8rem', color:'#9090AA', lineHeight:1.65, whiteSpace:'pre-wrap', marginBottom:10 }}>
                    🤖 {aiSugg}
                  </div>
                )}

                {/* Checklist */}
                {(() => {
                  try {
                    const cl = JSON.parse(detail.ai_checklist || '[]');
                    if (!cl.length) return null;
                    return (
                      <div>
                        <div style={{ fontSize:'.68rem', fontWeight:700, color:'#6B6B8A', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Checklist</div>
                        {cl.map((item, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.8rem', color:item.done?'#6B6B8A':'#9090AA', marginBottom:5, textDecoration:item.done?'line-through':'none' }}>
                            <span>{item.done?'✅':'⬜'}</span>{item.text}
                          </div>
                        ))}
                      </div>
                    );
                  } catch { return null; }
                })()}
              </>
            );
          })()}
        </Modal>
      </div>
    </Layout>
  );
}
