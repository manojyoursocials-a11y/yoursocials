// pages/team.js
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Avatar, ProgressBar, Spinner, EmptyState, toast, api, MEMBER_COLORS } from '../components/UI';

export default function Team() {
  const { status, data:session } = useSession();
  const router = useRouter();
  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status]);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ job_title:'', role:'member' });

  useEffect(()=>{ if(status==='authenticated') api('/api/members').then(d=>{ setMembers(Array.isArray(d)?d:[]); setLoading(false); }); },[status]);

  async function updateProfile() {
    await api('/api/members','PATCH',form);
    toast.success('Profile updated!'); setModal(false);
    api('/api/members').then(d=>setMembers(Array.isArray(d)?d:[]));
  }

  if(loading) return <Layout><div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12 }}><Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading…</span></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <div><h2 style={{ fontWeight:900,fontSize:'1.3rem',marginBottom:4 }}>Team Members</h2>
            <p style={{ fontSize:'.82rem',color:'var(--muted2)' }}>{members.length} members · everyone logs in with Google</p></div>
          <Btn variant="ghost" onClick={()=>{ setForm({ job_title:session?.user?.job_title||'',role:session?.user?.role||'member' }); setModal(true); }}>✏️ Edit My Profile</Btn>
        </div>
        {members.length===0
          ? <EmptyState emoji="👥" title="No team yet" subtitle="Team members appear here automatically when they log in with Google."/>
          : <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16 }}>
              {members.map((m,i)=>{
                const isMe=m.email===session?.user?.email;
                const col=MEMBER_COLORS[i%MEMBER_COLORS.length];
                const qPct=m.avg_quality?Math.round(m.avg_quality*20):0;
                const dlPct=m.total_tasks>0?Math.max(0,Math.round(100-(m.overdue_tasks/m.total_tasks)*100)):100;
                return (
                  <Card key={m.id} hover style={{ border:isMe?'1px solid rgba(124,92,252,.35)':undefined,position:'relative' }}>
                    {isMe&&<div style={{ position:'absolute',top:12,right:12,fontSize:'.63rem',fontWeight:700,background:'rgba(124,92,252,.15)',color:'var(--purple2)',padding:'2px 8px',borderRadius:20 }}>You</div>}
                    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14 }}>
                      <div style={{ position:'relative' }}>
                        <Avatar name={m.name||m.email} url={m.image} size={48} color={col}/>
                        {m.streak>=3&&<div style={{ position:'absolute',bottom:-4,right:-4,background:'var(--orange)',color:'#000',fontSize:'.58rem',fontWeight:800,padding:'1px 4px',borderRadius:6 }}>🔥{m.streak}</div>}
                      </div>
                      <div>
                        <div style={{ fontWeight:800,fontSize:'.92rem' }}>{m.name||m.email?.split('@')[0]}</div>
                        <div style={{ fontSize:'.72rem',color:'var(--muted)',marginBottom:2 }}>{m.job_title||m.role}</div>
                        <div style={{ fontSize:'.7rem',color:'var(--yellow)',fontWeight:600 }}>🪙 {(m.coins||0).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:12 }}>
                      {[['Done',m.done_tasks||0,col],['Deadline%',`${dlPct}%`,dlPct>=90?'var(--green)':'var(--yellow)'],['Quality',qPct?`${qPct}%`:'—','var(--cyan)']].map(([l,v,c])=>(
                        <div key={l} style={{ background:'var(--surface3)',borderRadius:8,padding:'7px 8px',textAlign:'center' }}>
                          <div style={{ fontSize:'.88rem',fontWeight:800,color:c }}>{v}</div>
                          <div style={{ fontSize:'.6rem',color:'var(--muted)',marginTop:1 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:'.72rem',color:'var(--muted2)',display:'flex',gap:12' }}>
                      <span>📋 {(m.total_tasks||0)-(m.done_tasks||0)} active</span>
                      <span>✅ {m.done_tasks||0} done</span>
                      {m.overdue_tasks>0&&<span style={{ color:'var(--red)' }}>⚠️ {m.overdue_tasks}</span>}
                    </div>
                  </Card>
                );
              })}
            </div>
        }
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Edit My Profile" width={380}>
        <Input label="Job Title" value={form.job_title} onChange={e=>setForm(f=>({...f,job_title:e.target.value}))} placeholder="Content Lead, Designer…"/>
        <Select label="Role" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
          <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
        </Select>
        <div style={{ display:'flex',gap:10 }}>
          <Btn variant="ghost" onClick={()=>setModal(false)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={updateProfile} style={{ flex:2 }}>Save</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
