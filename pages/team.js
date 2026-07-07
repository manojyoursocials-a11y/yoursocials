import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Avatar, ProgressBar, Spinner, EmptyState, Tag, toast, api, MEMBER_COLORS } from '../components/UI';

export default function Team() {
  const { status, data: session, update: updateSession } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [memberTasks,  setMemberTasks]  = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState({ job_title: '' });

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'authenticated') {
      api('/api/members').then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false); });
    }
  }, [status]);

  async function loadMemberTasks(member) {
    setSelected(member);
    setTasksLoading(true);
    const tasks = await api('/api/tasks?member=' + member.id);
    setMemberTasks(Array.isArray(tasks) ? tasks : []);
    setTasksLoading(false);
  }

  function openEditProfile() {
    // Find own profile from members list (which has the DB image)
    const me = members.find(m => m.email === session?.user?.email);
    setForm({ job_title: session?.user?.job_title || me?.job_title || '', image: me?.image || '' });
    setModal(true);
  }

  async function saveProfile() {
    const updates = { job_title: form.job_title };
    if (form.image !== session?.user?.image) updates.image = form.image || null;
    const res = await api('/api/members', 'PATCH', updates);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Profile updated!');
    setModal(false);
    // Refresh members list
    api('/api/members').then(d => setMembers(Array.isArray(d) ? d : []));
  }

  const STATUS_COLORS = {
    todo:       { color: '#9090AA', label: 'To Do'        },
    inprogress: { color: '#00D4FF', label: 'In Progress'  },
    review:     { color: '#FFD60A', label: 'Under Review' },
    done:       { color: '#00E5A0', label: 'Done'         },
  };

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
        <Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading…</span>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="fade-up">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:4 }}>Team Members</h2>
            <p style={{ fontSize:'.82rem', color:'var(--muted2)' }}>{members.length} members · click any card to see their tasks</p>
          </div>
          <Btn variant="ghost" onClick={openEditProfile}>✏️ Edit My Profile</Btn>
        </div>

        {members.length === 0
          ? <EmptyState emoji="👥" title="No team yet" subtitle="Members appear when they log in."/>
          : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16, marginBottom: selected ? 24 : 0 }}>
              {members.map((m, i) => {
                const isMe   = m.email === session?.user?.email;
                const color  = MEMBER_COLORS[i % MEMBER_COLORS.length];
                const done   = m.done_tasks || 0;
                const total  = m.total_tasks || 0;
                const over   = m.overdue_tasks || 0;
                const dlPct  = total > 0 ? Math.max(0, Math.round(100 - (over / total) * 100)) : 100;
                const isSel  = selected?.id === m.id;
                return (
                  <Card key={m.id} hover onClick={() => isSel ? setSelected(null) : loadMemberTasks(m)}
                    style={{ position:'relative', border: isSel ? '1px solid var(--purple)' : isMe ? '1px solid rgba(124,92,252,.35)' : undefined, cursor:'pointer' }}>
                    {isMe && <div style={{ position:'absolute', top:12, right:12, fontSize:'.63rem', fontWeight:700, background:'rgba(124,92,252,.15)', color:'var(--purple2)', padding:'2px 8px', borderRadius:20 }}>You</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <div style={{ position:'relative' }}>
                        <Avatar name={m.name || m.email} image={m.image} size={48} color={color}/>
                        {m.streak >= 3 && <div style={{ position:'absolute', bottom:-4, right:-4, background:'var(--orange)', color:'#000', fontSize:'.58rem', fontWeight:800, padding:'1px 4px', borderRadius:6 }}>🔥{m.streak}</div>}
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'.92rem' }}>{m.name || m.email?.split('@')[0]}</div>
                        <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:2 }}>{m.job_title || m.role}</div>
                        <div style={{ fontSize:'.7rem', color:'var(--yellow)', fontWeight:600 }}>🪙 {(m.coins || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:10 }}>
                      {[['Done', done, color], ['On-Time', dlPct + '%', dlPct >= 90 ? 'var(--green)' : 'var(--yellow)'], ['Quality', m.avg_quality ? Math.round(m.avg_quality * 20) + '%' : '—', 'var(--cyan)']].map(([l, v, c]) => (
                        <div key={l} style={{ background:'var(--surface3)', borderRadius:8, padding:'7px 8px', textAlign:'center' }}>
                          <div style={{ fontSize:'.88rem', fontWeight:800, color:c }}>{v}</div>
                          <div style={{ fontSize:'.6rem', color:'var(--muted)', marginTop:1 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:'.72rem', color:'var(--muted2)', display:'flex', gap:12 }}>
                      <span>📋 {total - done} active</span>
                      <span>✅ {done} done</span>
                      {over > 0 && <span style={{ color:'var(--red)' }}>⚠️ {over}</span>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        }

        {/* Member task list */}
        {selected && (
          <Card style={{ marginTop:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:'1rem' }}>Tasks for {selected.name}</div>
                <div style={{ fontSize:'.75rem', color:'var(--muted2)', marginTop:2 }}>{memberTasks.length} tasks total</div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => { setSelected(null); setMemberTasks([]); }}>✕ Close</Btn>
            </div>
            {tasksLoading
              ? <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px 0' }}><Spinner size={20}/><span style={{ color:'var(--muted2)', fontSize:'.82rem' }}>Loading…</span></div>
              : memberTasks.length === 0
                ? <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)', fontSize:'.82rem' }}>No tasks assigned yet.</div>
                : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {['todo','inprogress','review','done'].map(status => {
                      const grp = memberTasks.filter(t => t.status === status);
                      if (!grp.length) return null;
                      const sc = STATUS_COLORS[status];
                      return (
                        <div key={status}>
                          <div style={{ fontSize:'.68rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:sc.color, marginBottom:8, paddingLeft:4 }}>{sc.label} ({grp.length})</div>
                          {grp.map(t => {
                            const overdue = t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date();
                            return (
                              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface3)', borderRadius:10, marginBottom:6, border:`1px solid ${overdue ? 'rgba(255,77,109,.3)' : 'var(--border)'}` }}>
                                <span style={{ background:sc.color + '22', color:sc.color, fontSize:'.65rem', fontWeight:700, padding:'2px 8px', borderRadius:6, whiteSpace:'nowrap' }}>{sc.label}</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:'.82rem', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                                  {t.client_name && <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:2 }}>🏢 {t.client_name}</div>}
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                                  <Tag text={t.priority}/>
                                  {t.post_date && <span style={{ fontSize:'.7rem', color:'var(--purple2)' }}>📤 {String(t.post_date).slice(0,10)}</span>}
                                  {t.deadline && <span style={{ fontSize:'.7rem', color: overdue ? 'var(--red)' : 'var(--muted)' }}>⏰ {String(t.deadline).slice(0,10)}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )
            }
          </Card>
        )}
      </div>

      {/* Edit My Profile Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Edit My Profile" width={420}>
        {/* Profile Photo */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:'.73rem', fontWeight:600, color:'var(--muted2)', marginBottom:10, letterSpacing:'.04em' }}>PROFILE PHOTO</div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {/* Current photo */}
            <div style={{ width:72, height:72, borderRadius:'50%', overflow:'hidden', background:'var(--surface3)', border:'3px solid var(--border2)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {form.image
                ? <img src={form.image} alt="profile" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <span style={{ fontSize:'2rem', opacity:.4 }}>👤</span>
              }
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {/* Upload button */}
              <label style={{ cursor:'pointer', padding:'8px 16px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, fontSize:'.8rem', color:'var(--text)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:7 }}>
                📷 {form.image ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
                  const reader = new FileReader();
                  reader.onload = ev => setForm(f => ({ ...f, image: ev.target.result }));
                  reader.readAsDataURL(file);
                }}/>
              </label>
              {/* Delete photo button — only show if they have one */}
              {form.image && (
                <button onClick={() => { if (confirm('Remove your profile photo?')) setForm(f => ({ ...f, image: '' })); }}
                  style={{ padding:'7px 16px', background:'rgba(255,77,109,.1)', border:'1px solid rgba(255,77,109,.25)', borderRadius:9, fontSize:'.8rem', color:'var(--red)', fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left' }}>
                  🗑 Delete Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <Input label="Job Title" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Content Lead, Designer, Editor…"/>

        {/* Role — READ ONLY for non-admins */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:'.73rem', fontWeight:600, color:'var(--muted2)', marginBottom:5, letterSpacing:'.04em' }}>ROLE</div>
          <div style={{ padding:'9px 12px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:10, fontSize:'.83rem', color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>{session?.user?.role || 'member'}</span>
            <span style={{ fontSize:'.7rem', color:'var(--muted)', background:'rgba(255,255,255,.06)', padding:'2px 8px', borderRadius:6 }}>🔒 set by admin</span>
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => setModal(false)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={saveProfile} style={{ flex:2 }}>Save Profile</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
