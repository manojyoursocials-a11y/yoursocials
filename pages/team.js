import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Avatar, ProgressBar, Spinner, EmptyState, Tag, toast, api, MEMBER_COLORS } from '../components/UI';

export default function Team() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null); // member whose tasks are shown
  const [memberTasks, setMemberTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState({ job_title:'', role:'member' });

  useEffect(() => {
    if (status==='authenticated') {
      api('/api/members').then(d=>{ setMembers(Array.isArray(d)?d:[]); setLoading(false); });
    }
  }, [status]);

  async function loadMemberTasks(member) {
    setSelected(member);
    setTasksLoading(true);
    const tasks = await api('/api/tasks?member='+member.id);
    setMemberTasks(Array.isArray(tasks)?tasks:[]);
    setTasksLoading(false);
  }

  async function updateProfile() {
    await api('/api/members','PATCH',form);
    toast.success('Profile updated!');
    setModal(false);
    api('/api/members').then(d=>setMembers(Array.isArray(d)?d:[]));
  }

  const STATUS_COLORS = {
    todo:       { bg:'rgba(144,144,170,.12)', color:'var(--muted2)',  label:'To Do'        },
    inprogress: { bg:'rgba(0,212,255,.12)',   color:'var(--cyan)',    label:'In Progress'  },
    review:     { bg:'rgba(255,214,10,.12)',  color:'var(--yellow)',  label:'Under Review' },
    done:       { bg:'rgba(0,229,160,.10)',   color:'var(--green)',   label:'Done'         },
  };

  if (loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}><Spinner size={28}/><span style={{color:'var(--muted2)'}}>Loading…</span></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:4}}>Team Members</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>{members.length} members · click any card to see their tasks</p>
          </div>
          <Btn variant="ghost" onClick={()=>{setForm({job_title:session?.user?.job_title||'',role:session?.user?.role||'member'});setModal(true);}}>✏️ Edit My Profile</Btn>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16,marginBottom:selected?24:0}}>
          {members.length===0
            ? <EmptyState emoji="👥" title="No team yet" subtitle="Members appear when they log in."/>
            : members.map((m,i)=>{
              const isMe  = m.email===session?.user?.email;
              const color = MEMBER_COLORS[i%MEMBER_COLORS.length];
              const done  = m.done_tasks||0;
              const total = m.total_tasks||0;
              const over  = m.overdue_tasks||0;
              const dlPct = total>0?Math.max(0,Math.round(100-(over/total)*100)):100;
              const isSelected = selected?.id===m.id;
              return (
                <Card key={m.id} hover onClick={()=>loadMemberTasks(m)}
                  style={{position:'relative',border:isSelected?'1px solid var(--purple)':isMe?'1px solid rgba(124,92,252,.35)':undefined,cursor:'pointer',background:isSelected?'rgba(124,92,252,.08)':'var(--surface2)'}}>
                  {isMe&&<div style={{position:'absolute',top:12,right:12,fontSize:'.63rem',fontWeight:700,background:'rgba(124,92,252,.15)',color:'var(--purple2)',padding:'2px 8px',borderRadius:20}}>You</div>}
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                    <div style={{position:'relative'}}>
                      <Avatar name={m.name||m.email} size={48} color={color}/>
                      {m.streak>=3&&<div style={{position:'absolute',bottom:-4,right:-4,background:'var(--orange)',color:'#000',fontSize:'.58rem',fontWeight:800,padding:'1px 4px',borderRadius:6}}>🔥{m.streak}</div>}
                    </div>
                    <div>
                      <div style={{fontWeight:800,fontSize:'.92rem'}}>{m.name||m.email?.split('@')[0]}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted)',marginBottom:2}}>{m.job_title||m.role}</div>
                      <div style={{fontSize:'.7rem',color:'var(--yellow)',fontWeight:600}}>🪙 {(m.coins||0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                    {[['Done',done,color],['Deadline%',dlPct+'%',dlPct>=90?'var(--green)':'var(--yellow)'],['Quality',m.avg_quality?Math.round(m.avg_quality*20)+'%':'—','var(--cyan)']].map(([l,v,c])=>(
                      <div key={l} style={{background:'var(--surface3)',borderRadius:8,padding:'7px 8px',textAlign:'center'}}>
                        <div style={{fontSize:'.88rem',fontWeight:800,color:c}}>{v}</div>
                        <div style={{fontSize:'.6rem',color:'var(--muted)',marginTop:1}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:'.72rem',color:'var(--muted2)',display:'flex',gap:12}}>
                    <span>📋 {total-done} active</span>
                    <span>✅ {done} done</span>
                    {over>0&&<span style={{color:'var(--red)'}}>⚠️ {over} overdue</span>}
                  </div>
                  {isSelected&&<div style={{marginTop:10,fontSize:'.72rem',color:'var(--purple2)',fontWeight:600}}>👆 Showing tasks below</div>}
                </Card>
              );
            })
          }
        </div>

        {/* Member task list — Fix #5 */}
        {selected&&(
          <Card style={{marginTop:8}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:'1rem'}}>Tasks for {selected.name}</div>
                <div style={{fontSize:'.75rem',color:'var(--muted2)',marginTop:2}}>{memberTasks.length} tasks total</div>
              </div>
              <Btn variant="ghost" size="sm" onClick={()=>{setSelected(null);setMemberTasks([]);}}>✕ Close</Btn>
            </div>

            {tasksLoading
              ? <div style={{display:'flex',alignItems:'center',gap:10,padding:'20px 0'}}><Spinner size={20}/><span style={{color:'var(--muted2)',fontSize:'.82rem'}}>Loading tasks…</span></div>
              : memberTasks.length===0
                ? <div style={{textAlign:'center',padding:'24px 0',color:'var(--muted)',fontSize:'.82rem'}}>No tasks assigned yet.</div>
                : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {['todo','inprogress','review','done'].map(status=>{
                      const groupTasks = memberTasks.filter(t=>t.status===status);
                      if (!groupTasks.length) return null;
                      const sc = STATUS_COLORS[status];
                      return (
                        <div key={status}>
                          <div style={{fontSize:'.68rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:sc.color,marginBottom:8,paddingLeft:4}}>{sc.label} ({groupTasks.length})</div>
                          {groupTasks.map(t=>{
                            const overdue=t.deadline&&t.status!=='done'&&new Date(t.deadline)<new Date();
                            return (
                              <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--surface3)',borderRadius:10,marginBottom:6,border:'1px solid '+(overdue?'rgba(255,77,109,.3)':'var(--border)')}}>
                                <span style={{background:sc.bg,color:sc.color,fontSize:'.65rem',fontWeight:700,padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap'}}>{sc.label}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:'.82rem',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.title}</div>
                                  {t.client_name&&<div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>🏢 {t.client_name}</div>}
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                                  <Tag text={t.priority}/>
                                  {t.deadline&&<span style={{fontSize:'.7rem',color:overdue?'var(--red)':'var(--muted)',fontWeight:overdue?700:400}}>{overdue?'⚠️':'📅'} {t.deadline?.toString().slice(0,10)}</span>}
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

      <Modal open={modal} onClose={()=>setModal(false)} title="Edit My Profile" width={380}>
        <Input label="Job Title" value={form.job_title} onChange={e=>setForm(f=>({...f,job_title:e.target.value}))} placeholder="Content Lead, Designer…"/>
        <Select label="Role" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </Select>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>setModal(false)} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={updateProfile} style={{flex:2}}>Save</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
