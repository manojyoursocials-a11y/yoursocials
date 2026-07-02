import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, ProgressBar, Spinner, api, MEMBER_COLORS } from '../components/UI';

export default function Analytics() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status]);
  const [tasks,   setTasks]   = useState([]);
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ if(status==='authenticated') Promise.all([api('/api/tasks'),api('/api/members'),api('/api/clients')]).then(([t,m,c])=>{ setTasks(Array.isArray(t)?t:[]); setMembers(Array.isArray(m)?m:[]); setClients(Array.isArray(c)?c:[]); setLoading(false); }); },[status]);

  if(loading) return <Layout><div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12 }}><Spinner size={28}/></div></Layout>;

  const done   = tasks.filter(t=>t.status==='done').length;
  const overdue= tasks.filter(t=>t.status!=='done'&&t.deadline&&new Date(t.deadline)<new Date()).length;
  const byClient=clients.map(c=>({ name:c.name, count:tasks.filter(t=>t.client_id===c.id).length })).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const maxCl=byClient[0]?.count||1;

  return (
    <Layout>
      <div className="fade-up">
        <h2 style={{ fontWeight:900,fontSize:'1.3rem',marginBottom:6 }}>Analytics</h2>
        <p style={{ fontSize:'.82rem',color:'var(--muted2)',marginBottom:24 }}>All-time performance overview</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14,marginBottom:20 }}>
          {[['Total Tasks',tasks.length,'var(--purple)'],['Done',done,'var(--green)'],['In Progress',tasks.filter(t=>t.status==='inprogress').length,'var(--cyan)'],['Overdue',overdue,overdue>0?'var(--red)':'var(--green)'],['Members',members.length,'var(--pink)'],['Clients',clients.length,'var(--orange)']].map(([l,v,col])=>(
            <Card key={l} style={{ textAlign:'center' }}><div style={{ fontSize:'2rem',fontWeight:900,color:col }}>{v}</div><div style={{ fontSize:'.72rem',color:'var(--muted)',marginTop:4 }}>{l}</div></Card>
          ))}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
          <Card>
            <div style={{ fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:14 }}>Tasks by Member</div>
            {members.filter(m=>m.total_tasks>0).map((m,i)=>(
              <div key={m.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.78rem',marginBottom:4 }}>
                  <span>{m.name||m.email?.split('@')[0]}</span>
                  <span style={{ color:'var(--muted2)',fontSize:'.72rem' }}>{m.done_tasks||0}/{m.total_tasks||0} done</span>
                </div>
                <ProgressBar value={m.done_tasks||0} max={m.total_tasks||1} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
              </div>
            ))}
            {members.every(m=>!m.total_tasks)&&<div style={{ color:'var(--muted)',fontSize:'.8rem' }}>No tasks yet.</div>}
          </Card>
          <Card>
            <div style={{ fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:14 }}>Tasks by Client</div>
            {byClient.length===0?<div style={{ color:'var(--muted)',fontSize:'.8rem' }}>No client tasks yet.</div>:byClient.map((c,i)=>(
              <div key={c.name} style={{ marginBottom:12 }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.78rem',marginBottom:4 }}><span>{c.name}</span><span style={{ color:'var(--muted2)' }}>{c.count}</span></div>
                <ProgressBar value={c.count} max={maxCl} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
              </div>
            ))}
          </Card>
        </div>
        <Card>
          <div style={{ fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:14 }}>Status Breakdown</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
            {[['📋','To Do',tasks.filter(t=>t.status==='todo').length,'var(--muted2)'],['⚡','In Progress',tasks.filter(t=>t.status==='inprogress').length,'var(--cyan)'],['👁️','Review',tasks.filter(t=>t.status==='review').length,'var(--yellow)'],['✅','Done',done,'var(--green)']].map(([e,l,v,col])=>(
              <div key={l} style={{ background:'var(--surface3)',borderRadius:10,padding:14,textAlign:'center' }}>
                <div style={{ fontSize:'1.4rem',marginBottom:4 }}>{e}</div>
                <div style={{ fontSize:'1.6rem',fontWeight:900,color:col }}>{v}</div>
                <div style={{ fontSize:'.7rem',color:'var(--muted)',marginTop:3 }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
