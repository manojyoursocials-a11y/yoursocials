import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, ProgressBar, Spinner, Tag, Avatar, MEMBER_COLORS } from '../components/UI';

async function fetchJ(url){ const r=await fetch(url); return r.json(); }

export default function Analytics() {
  const {status}=useSession();
  const router=useRouter();
  useEffect(()=>{if(status==='unauthenticated')router.replace('/login');},[status]);

  const [tasks,  setTasks]   = useState([]);
  const [members,setMembers] = useState([]);
  const [clients,setClients] = useState([]);
  const [loading,setLoading] = useState(true);
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,  setDateTo]  =useState('');
  const [viewTab, setViewTab] =useState('overview'); // overview|bymember|byclient|bydate

  useEffect(()=>{
    if(status==='authenticated'){
      Promise.all([fetchJ('/api/tasks'),fetchJ('/api/members'),fetchJ('/api/clients')]).then(([t,m,c])=>{
        setTasks(Array.isArray(t)?t:[]);
        setMembers(Array.isArray(m)?m:[]);
        setClients(Array.isArray(c)?c:[]);
        setLoading(false);
      });
    }
  },[status]);

  if(loading)return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><Spinner size={28}/></div></Layout>;

  // Date filter
  const filtered = tasks.filter(t => {
    if (!dateFrom && !dateTo) return true;
    const created = t.created_at ? t.created_at.slice(0,10) : '';
    if (dateFrom && created < dateFrom) return false;
    if (dateTo   && created > dateTo)   return false;
    return true;
  });

  const done    = filtered.filter(t=>t.status==='done').length;
  const inProg  = filtered.filter(t=>t.status==='inprogress').length;
  const review  = filtered.filter(t=>t.status==='review').length;
  const todo    = filtered.filter(t=>t.status==='todo').length;
  const total   = filtered.length;
  const today   = new Date().toISOString().split('T')[0];
  const overdue = filtered.filter(t=>t.status!=='done'&&t.deadline&&String(t.deadline).slice(0,10)<today).length;

  // By date grouping
  const byDate = {};
  filtered.forEach(t => {
    const d = t.created_at ? t.created_at.slice(0,10) : 'Unknown';
    if (!byDate[d]) byDate[d] = { total:0, done:0 };
    byDate[d].total++;
    if (t.status==='done') byDate[d].done++;
  });
  const dateRows = Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);

  // By member
  const byMember = members.map(m => ({
    ...m,
    tasks: filtered.filter(t=>t.owner_id===m.id),
    done:  filtered.filter(t=>t.owner_id===m.id&&t.status==='done').length,
  })).filter(m=>m.tasks.length>0).sort((a,b)=>b.tasks.length-a.tasks.length);

  // By client
  const byClient = clients.map(c => ({
    ...c,
    tasks: filtered.filter(t=>t.client_id===c.id),
    done:  filtered.filter(t=>t.client_id===c.id&&t.status==='done').length,
  })).filter(c=>c.tasks.length>0).sort((a,b)=>b.tasks.length-a.tasks.length);
  const maxCT = byClient[0]?.tasks.length||1;

  const tabStyle = (active) => ({
    padding:'7px 16px', borderRadius:9, border:'none', fontFamily:'Inter,sans-serif',
    fontSize:'.8rem', fontWeight:active?700:500, cursor:'pointer',
    background:active?'rgba(124,92,252,.18)':'transparent',
    color:active?'var(--purple2)':'var(--muted2)', transition:'all .18s',
  });

  return (
    <Layout>
      <div className="fade-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:4}}>Analytics 📊</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>{total} tasks in range · {done} done · {overdue} overdue</p>
          </div>
          {/* Date filter */}
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:'.76rem',color:'var(--muted2)',fontWeight:600}}>From</span>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:8,padding:'6px 10px',fontSize:'.78rem',color:'var(--text)',fontFamily:'Inter,sans-serif'}}/>
            <span style={{fontSize:'.76rem',color:'var(--muted2)',fontWeight:600}}>To</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:8,padding:'6px 10px',fontSize:'.78rem',color:'var(--text)',fontFamily:'Inter,sans-serif'}}/>
            {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom('');setDateTo('');}} style={{padding:'6px 12px',borderRadius:8,border:'1px solid var(--border2)',background:'transparent',color:'var(--muted2)',cursor:'pointer',fontSize:'.76rem',fontFamily:'Inter,sans-serif'}}>Clear</button>}
          </div>
        </div>

        {/* KPI row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
          {[['Total',total,'var(--purple)'],['Done',done,'var(--green)'],['In Progress',inProg,'var(--cyan)'],['Under Review',review,'var(--yellow)'],['To Do',todo,'var(--muted2)'],['Overdue',overdue,overdue>0?'var(--red)':'var(--green)']].map(([l,v,c])=>(
            <Card key={l} style={{textAlign:'center'}}>
              <div style={{fontSize:'1.9rem',fontWeight:900,color:c,marginBottom:3}}>{v}</div>
              <div style={{fontSize:'.7rem',color:'var(--muted)'}}>{l}</div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:6,marginBottom:18,background:'var(--surface2)',padding:5,borderRadius:12,width:'fit-content',border:'1px solid var(--border)'}}>
          {[['overview','Overview'],['bymember','By Member'],['byclient','By Client'],['bydate','By Date']].map(([id,label])=>(
            <button key={id} onClick={()=>setViewTab(id)} style={tabStyle(viewTab===id)}>{label}</button>
          ))}
        </div>

        {/* Overview */}
        {viewTab==='overview'&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
            <Card>
              <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:14}}>Status Breakdown</div>
              {[['📋 To Do',todo,'var(--muted2)'],['⚡ In Progress',inProg,'var(--cyan)'],['👁️ Under Review',review,'var(--yellow)'],['✅ Done',done,'var(--green)']].map(([l,v,c])=>(
                <div key={l} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',marginBottom:4}}><span style={{color:'var(--muted2)'}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span></div>
                  <ProgressBar value={v} max={total||1} color={c}/>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:14}}>Priority Breakdown</div>
              {['P1','P2','P3','P4'].map(p=>{
                const cnt=filtered.filter(t=>t.priority===p).length;
                const colors={P1:'var(--red)',P2:'var(--orange)',P3:'var(--yellow)',P4:'var(--green)'};
                const labels={P1:'🔴 Critical',P2:'🟠 High',P3:'🟡 Medium',P4:'🟢 Low'};
                return (
                  <div key={p} style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',marginBottom:4}}><span style={{color:'var(--muted2)'}}>{labels[p]}</span><span style={{fontWeight:700,color:colors[p]}}>{cnt}</span></div>
                    <ProgressBar value={cnt} max={total||1} color={colors[p]}/>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* By Member */}
        {viewTab==='bymember'&&(
          <Card>
            <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:14}}>Tasks by Member</div>
            {byMember.length===0&&<div style={{color:'var(--muted)',fontSize:'.82rem'}}>No data.</div>}
            {byMember.map((m,i)=>(
              <div key={m.id} style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
                  <Avatar name={m.name||m.email} image={m.image} size={30} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'.83rem',fontWeight:700}}>{m.name||m.email?.split('@')[0]}</div>
                    <div style={{fontSize:'.7rem',color:'var(--muted)' }}>{m.tasks.length} tasks · {m.done} done</div>
                  </div>
                  <span style={{fontWeight:800,color:MEMBER_COLORS[i%MEMBER_COLORS.length],fontSize:'.9rem'}}>{m.tasks.length}</span>
                </div>
                <ProgressBar value={m.done} max={m.tasks.length||1} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
              </div>
            ))}
          </Card>
        )}

        {/* By Client */}
        {viewTab==='byclient'&&(
          <Card>
            <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:14}}>Tasks by Client</div>
            {byClient.length===0&&<div style={{color:'var(--muted)',fontSize:'.82rem'}}>No client tasks.</div>}
            {byClient.map((c,i)=>(
              <div key={c.id} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'.83rem',marginBottom:5}}>
                  <span style={{fontWeight:600}}>{c.name}</span>
                  <span style={{color:'var(--muted2)',fontSize:'.76rem'}}>{c.done}/{c.tasks.length} done</span>
                </div>
                <ProgressBar value={c.tasks.length} max={maxCT} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                <div style={{display:'flex',gap:8,marginTop:5,flexWrap:'wrap'}}>
                  {['todo','inprogress','review','done'].map(st=>{
                    const cnt=c.tasks.filter(t=>t.status===st).length;
                    if(!cnt)return null;
                    return <span key={st} style={{fontSize:'.67rem',color:'var(--muted2)'}}><Tag text={st}/> {cnt}</span>;
                  })}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* By Date */}
        {viewTab==='bydate'&&(
          <Card>
            <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:14}}>Tasks Created by Date</div>
            {dateRows.length===0&&<div style={{color:'var(--muted)',fontSize:'.82rem'}}>No data in range.</div>}
            <div style={{display:'grid',gridTemplateColumns:'140px 1fr 60px 60px',gap:8,alignItems:'center'}}>
              <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Date</div>
              <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Progress</div>
              <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Total</div>
              <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--green)',textTransform:'uppercase'}}>Done</div>
              {dateRows.map(([date,v])=>(
                <>
                  <div key={date+'-d'} style={{fontSize:'.82rem',fontWeight:600,color:'var(--text)'}}>{date}</div>
                  <div key={date+'-p'}><ProgressBar value={v.done} max={v.total||1} color="var(--green)"/></div>
                  <div key={date+'-t'} style={{fontSize:'.82rem',fontWeight:700,textAlign:'center'}}>{v.total}</div>
                  <div key={date+'-dn'} style={{fontSize:'.82rem',fontWeight:700,color:'var(--green)',textAlign:'center'}}>{v.done}</div>
                </>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
