import { useSession, getServerSideProps as authProps } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Ring, ProgressBar, Tag, Avatar, SectionLabel, Spinner, MEMBER_COLORS, api } from '../components/UI';

export default function Dashboard() {
  const { data:session, status } = useSession();
  const router = useRouter();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(()=>{ if(status==='unauthenticated') router.replace('/login'); },[status]);
  useEffect(()=>{
    if(status==='authenticated'){
      // Run DB setup on first load (idempotent — safe to call every time)
      fetch('/api/setup',{method:'POST'}).then(()=>{ setSetupDone(true); fetchData(); });
    }
  },[status]);

  async function fetchData() {
    const d = await api('/api/dashboard');
    setData(d);
    setLoading(false);
  }

  if (status==='loading'||loading) return (
    <Layout>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12 }}>
        <Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading dashboard…</span>
      </div>
    </Layout>
  );

  const { stats={}, dueToday=[], members=[], rewards=[] } = data || {};
  const { total=0, done=0, inProg=0, review=0, todo=0, overdue=0, avgQuality, completionPct=0, healthScore=20, pendingFollowups=0, totalCoins=0 } = stats;

  const weekReward  = rewards.find(r=>r.reward_type==='weekly');
  const tripReward  = rewards.find(r=>r.reward_type==='monthly');

  return (
    <Layout badges={{ tasks:todo, followups:pendingFollowups }}>
      <div className="fade-up">
        {/* Hero */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:'.72rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--purple2)',marginBottom:6 }}>
            {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
          <h1 style={{ fontSize:'1.8rem',fontWeight:900,letterSpacing:'-.03em',marginBottom:4 }}>
            Hey {session?.user?.name?.split(' ')[0]||'there'} 👋
          </h1>
          <p style={{ color:'var(--muted2)',fontSize:'.88rem' }}>{done} tasks done · {overdue>0?`${overdue} overdue ⚠️`:'no overdue tasks ✅'} · {members.length} team members</p>
        </div>

        {/* KPI row */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:14,marginBottom:20 }}>
          {[
            { label:'Health Score', value:healthScore, suffix:'/100', color:'#7C5CFC', glow:'#7C5CFC' },
            { label:'Tasks Done',   value:done,        suffix:` of ${total}`, color:'var(--green)', glow:'#00E5A0' },
            { label:'In Progress',  value:inProg,      suffix:' tasks', color:'var(--cyan)',  glow:'#00D4FF' },
            { label:'Under Review', value:review,      suffix:' tasks', color:'var(--yellow)',glow:'#FFD60A' },
            { label:'Overdue',      value:overdue,     suffix:' tasks', color:overdue>0?'var(--red)':'var(--green)', glow:'#FF4D6D' },
            { label:'Avg Quality',  value:avgQuality||'—', suffix:avgQuality?'/5':'', color:'var(--orange)',glow:'#FF8C42' },
          ].map(k=>(
            <Card key={k.label} hover style={{ position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',top:0,left:0,right:0,height:2.5,background:`linear-gradient(90deg,${k.glow},transparent)` }}/>
              <div style={{ position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:'50%',background:k.glow,opacity:.1,filter:'blur(20px)' }}/>
              <div style={{ fontSize:'.68rem',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--muted)',marginBottom:8 }}>{k.label}</div>
              <div style={{ fontSize:'2rem',fontWeight:900,color:k.color,lineHeight:1 }}>{k.value}<span style={{ fontSize:'.85rem',fontWeight:500,color:'var(--muted)' }}>{k.suffix}</span></div>
            </Card>
          ))}
        </div>

        {/* Health + Due today */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20 }}>
          <Card>
            <div style={{ fontSize:'.72rem',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--muted)',marginBottom:16 }}>Team Performance</div>
            <div style={{ display:'flex',alignItems:'center',gap:24 }}>
              <Ring value={healthScore} max={100} size={130} color="#7C5CFC" label={healthScore} sublabel="health"/>
              <div style={{ flex:1 }}>
                {[['Task Completion',completionPct,'var(--purple)'],['On-Time Rate',Math.max(0,100-overdue*12),'var(--green)'],['Team Engaged',members.length>0?85:0,'var(--cyan)']].map(([l,v,col])=>(
                  <div key={l} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.73rem',marginBottom:4 }}><span style={{ color:'var(--muted2)' }}>{l}</span><span style={{ fontWeight:700,color:col }}>{Math.round(v)}%</span></div>
                    <ProgressBar value={v} color={col}/>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <div style={{ fontSize:'.72rem',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--muted)',marginBottom:14 }}>Due Today</div>
            {dueToday.length===0
              ? <div style={{ color:'var(--muted)',fontSize:'.82rem',textAlign:'center',padding:'20px 0' }}>🎉 Nothing due today!</div>
              : dueToday.slice(0,5).map(t=>(
                <div key={t.id} onClick={()=>router.push('/tasks')} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--border)',cursor:'pointer' }}>
                  <Tag text={t.priority}/>
                  <span style={{ flex:1,fontSize:'.8rem',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{t.title}</span>
                </div>
              ))
            }
          </Card>
        </div>

        {/* Status cols */}
        <SectionLabel>Task Overview</SectionLabel>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
          {[['📋','To Do',todo,'var(--muted2)','/tasks'],['⚡','In Progress',inProg,'var(--cyan)','/tasks'],['👁️','Under Review',review,'var(--yellow)','/tasks'],['✅','Done',done,'var(--green)','/tasks']].map(([e,l,v,col,p])=>(
            <Card key={l} hover onClick={()=>router.push(p)} style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1.6rem',marginBottom:6 }}>{e}</div>
              <div style={{ fontSize:'1.8rem',fontWeight:900,color:col }}>{v}</div>
              <div style={{ fontSize:'.72rem',color:'var(--muted)',marginTop:4 }}>{l}</div>
            </Card>
          ))}
        </div>

        {/* Reward + Trip */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20 }}>
          <Card style={{ background:'rgba(255,214,10,.04)',borderColor:'rgba(255,214,10,.15)' }}>
            <div style={{ fontSize:'.72rem',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--yellow)',marginBottom:10 }}>This Week's Reward</div>
            {weekReward
              ? <div style={{ display:'flex',alignItems:'center',gap:16 }}>
                  <div style={{ fontSize:'2.2rem' }}>{weekReward.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700,marginBottom:6 }}>{weekReward.name}</div>
                    <ProgressBar value={completionPct} color="var(--yellow)"/>
                    <div style={{ fontSize:'.72rem',color:'var(--muted2)',marginTop:4 }}>{completionPct}% tasks complete</div>
                  </div>
                </div>
              : <div style={{ color:'var(--muted)',fontSize:'.82rem' }}>Loading…</div>
            }
          </Card>
          <Card style={{ background:'linear-gradient(135deg,rgba(124,92,252,.1),rgba(0,212,255,.06))',borderColor:'rgba(124,92,252,.2)' }}>
            <div style={{ fontSize:'.72rem',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--purple2)',marginBottom:10 }}>Monthly Trip Challenge</div>
            {tripReward
              ? <>
                  <div style={{ fontSize:'1.1rem',fontWeight:800,marginBottom:10 }}>{tripReward.emoji} {tripReward.name}</div>
                  <ProgressBar value={totalCoins} max={tripReward.coin_cost||13000} color="var(--grad2)"/>
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.72rem',color:'var(--muted2)',marginTop:5 }}>
                    <span>🪙 {totalCoins.toLocaleString()} earned</span><span>Goal: {(tripReward.coin_cost||13000).toLocaleString()}</span>
                  </div>
                </>
              : <div style={{ color:'var(--muted)',fontSize:'.82rem' }}>Loading…</div>
            }
          </Card>
        </div>

        {/* Team strip */}
        {members.length>0&&(
          <>
            <SectionLabel>Team</SectionLabel>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12 }}>
              {members.slice(0,6).map((m,i)=>(
                <Card key={m.id} hover onClick={()=>router.push('/team')} style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <Avatar name={m.name||m.email} url={m.image} size={38} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                  <div>
                    <div style={{ fontSize:'.82rem',fontWeight:700 }}>{m.name||m.email?.split('@')[0]}</div>
                    <div style={{ fontSize:'.68rem',color:'var(--muted)' }}>{m.job_title||m.role}</div>
                    <div style={{ fontSize:'.7rem',color:'var(--yellow)',marginTop:2 }}>🪙{(m.coins||0).toLocaleString()}</div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
