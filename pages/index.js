import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Card, Ring, ProgressBar, Tag, Avatar, Spinner, MEMBER_COLORS, api } from '../components/UI';

const PRI_COLOR = { P1:'#FF4D6D', P2:'#FF9F43', P3:'#FFD60A', P4:'#00E5A0' };
const STATUS_LABEL = { todo:'📋 To Do', inprogress:'⚡ In Progress', review:'👁 Under Review', done:'✅ Done' };

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [allTasks,   setAllTasks]   = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [panel,      setPanel]      = useState(null);
  const [panelSearch,setPanelSearch]= useState('');

  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const d = await api('/api/dashboard');
      if (d && !d.error) setData(d);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [t, m] = await Promise.all([api('/api/tasks'), api('/api/members')]);
      if (Array.isArray(t)) setAllTasks(t);
      if (Array.isArray(m)) setAllMembers(m);
    } catch(e) {}
  }, [isAdmin]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/setup', { method:'POST' }).finally(fetchData);
      fetchAdminData();
      const t = setInterval(fetchData, 60000);
      return () => clearInterval(t);
    }
  }, [status, fetchData, fetchAdminData]);

  if (status==='loading'||loading) return (
    <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
      <Spinner size={28}/><span style={{color:'var(--muted2)'}}>Loading…</span>
    </div></Layout>
  );

  const {stats={},dueToday=[],members=[],rewards=[]} = data||{};
  const {total=0,done=0,inProg=0,review=0,todo=0,overdue=0,completionPct=0,healthScore=20,pendingFollowups=0} = stats;
  const weekReward = rewards.find(r=>r.reward_type==='weekly');
  const tripReward = rewards.find(r=>r.reward_type==='monthly');
  const today      = new Date().toISOString().split('T')[0];

  // Build panel tasks
  const memberName = id => allMembers.find(m=>m.id===id)?.name || '—';
  const panelTasks = (() => {
    if (!panel) return [];
    let tasks = allTasks.filter(t => {
      if (panel === 'overdue') return t.status !== 'done' && t.deadline && String(t.deadline).slice(0,10) < today;
      return t.status === panel;
    });
    if (panelSearch) tasks = tasks.filter(t =>
      (t.title||'').toLowerCase().includes(panelSearch.toLowerCase()) ||
      (t.client_name||'').toLowerCase().includes(panelSearch.toLowerCase()) ||
      (memberName(t.owner_id)||'').toLowerCase().includes(panelSearch.toLowerCase())
    );
    return tasks.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  })();

  const PANEL_CFG = {
    done:       { label:'✅ Tasks Done',      color:'var(--green)',  bg:'rgba(0,229,160,.06)'  },
    inprogress: { label:'⚡ In Progress',      color:'var(--cyan)',   bg:'rgba(0,212,255,.06)'  },
    review:     { label:'👁 Under Review',     color:'var(--yellow)', bg:'rgba(255,214,10,.06)' },
    todo:       { label:'📋 To Do',            color:'var(--muted2)', bg:'rgba(144,144,170,.06)'},
    overdue:    { label:'⚠️ Overdue Tasks',    color:'var(--red)',    bg:'rgba(255,77,109,.06)' },
  };

  function togglePanel(key) {
    if (!isAdmin || !key) return;
    if (panel === key) { setPanel(null); setPanelSearch(''); return; }
    setPanel(key);
    setPanelSearch('');
    if (!allTasks.length) fetchAdminData();
  }

  const STAT_CARDS = [
    { label:'Health Score', value:healthScore,   suffix:'/100',       color:'#7C5CFC', key:null },
    { label:'Tasks Done',   value:done,          suffix:` of ${total}`,color:'var(--green)',  key:'done'       },
    { label:'In Progress',  value:inProg,        suffix:' tasks',      color:'var(--cyan)',   key:'inprogress' },
    { label:'Under Review', value:review,        suffix:' tasks',      color:'var(--yellow)', key:'review'     },
    { label:'To Do',        value:todo,          suffix:' tasks',      color:'var(--muted2)', key:'todo'       },
    { label:'Overdue',      value:overdue,       suffix:' tasks',      color:overdue>0?'var(--red)':'var(--green)', key:'overdue' },
  ];

  return (
    <Layout badges={{tasks:todo, followups:pendingFollowups}}>
      <div className="fade-up">

        {/* Greeting */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:'.72rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--purple2)',marginBottom:6}}>
            {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
          <h1 style={{fontWeight:900,fontSize:'clamp(1.6rem,4vw,2.2rem)',marginBottom:8}}>
            Hey {session?.user?.name?.split(' ')[0]||'there'} 👋
          </h1>
          <p style={{color:'var(--muted2)',fontSize:'.88rem'}}>
            {done} tasks done · {overdue>0?`${overdue} overdue ⚠️`:'no overdue ✅'} · {members.length} team members · <span style={{color:'var(--green)'}}>● live</span>
          </p>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
          {STAT_CARDS.map(k => (
            <Card key={k.label}
              onClick={() => togglePanel(k.key)}
              style={{flex:1,minWidth:110,position:'relative',overflow:'hidden',
                cursor:isAdmin&&k.key?'pointer':'default',
                border: panel===k.key ? `1.5px solid ${k.color}` : '1px solid var(--border)',
                background: panel===k.key ? k.color+'10' : undefined,
                transition:'border .15s, background .15s'
              }}>
              <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                {k.label}
                {isAdmin && k.key && <span style={{color:k.color,fontSize:'.72rem'}}>{panel===k.key?'▲':'▼'}</span>}
              </div>
              <div style={{fontSize:'2rem',fontWeight:900,color:k.color,lineHeight:1}}>
                {k.value}<span style={{fontSize:'.85rem',fontWeight:500,color:'var(--muted2)'}}>{k.suffix}</span>
              </div>
              {isAdmin && k.key && <div style={{fontSize:'.65rem',color:k.color,marginTop:4,opacity:.7}}>Click to view</div>}
            </Card>
          ))}
        </div>

        {/* ── ADMIN DETAIL PANEL ── */}
        {isAdmin && panel && PANEL_CFG[panel] && (
          <Card style={{marginBottom:24,border:`1px solid ${PANEL_CFG[panel].color}44`,background:PANEL_CFG[panel].bg}}>
            {/* Panel header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
              <div style={{fontWeight:800,fontSize:'1rem',color:PANEL_CFG[panel].color}}>
                {PANEL_CFG[panel].label}
                <span style={{color:'var(--muted2)',fontWeight:500,fontSize:'.82rem',marginLeft:8}}>({allTasks.filter(t=>{
                  if(panel==='overdue') return t.status!=='done'&&t.deadline&&String(t.deadline).slice(0,10)<today;
                  return t.status===panel;
                }).length} tasks)</span>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input value={panelSearch} onChange={e=>setPanelSearch(e.target.value)}
                  placeholder="Search…"
                  style={{background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 12px',fontSize:'.8rem',color:'var(--text)',fontFamily:'inherit',outline:'none',width:180}}/>
                <button onClick={()=>{setPanel(null);setPanelSearch('');}}
                  style={{background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 12px',color:'var(--muted)',cursor:'pointer',fontSize:'.8rem',fontFamily:'inherit'}}>
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Task list */}
            {panelTasks.length === 0 && (
              <div style={{textAlign:'center',padding:'24px',color:'var(--muted)',fontSize:'.85rem'}}>
                {panelSearch ? 'No tasks match your search' : 'No tasks in this category'}
              </div>
            )}
            <div style={{maxHeight:420,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
              {panelTasks.map((t,i) => {
                const dl = t.deadline ? String(t.deadline).slice(0,10) : null;
                const isLate = dl && dl < today && t.status !== 'done';
                return (
                  <div key={t.id||i}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:'var(--surface2)',borderRadius:10,border:'1px solid var(--border)',transition:'border .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=PANEL_CFG[panel].color}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                    {/* Priority */}
                    <span style={{padding:'2px 8px',borderRadius:6,background:(PRI_COLOR[t.priority]||'#9090AA')+'22',color:PRI_COLOR[t.priority]||'#9090AA',fontSize:'.65rem',fontWeight:700,flexShrink:0}}>
                      {t.priority||'P3'}
                    </span>
                    {/* Title + meta */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:'.86rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted2)',marginTop:2,display:'flex',gap:10,flexWrap:'wrap'}}>
                        {t.client_name && <span>🏢 {t.client_name}</span>}
                        {t.content_type && <span>📌 {t.content_type}</span>}
                        <span style={{color:'var(--purple2)'}}>👤 {memberName(t.owner_id)}</span>
                      </div>
                    </div>
                    {/* Status badge */}
                    <span style={{fontSize:'.68rem',padding:'2px 8px',borderRadius:6,background:'var(--surface3)',color:'var(--muted2)',flexShrink:0,whiteSpace:'nowrap'}}>
                      {STATUS_LABEL[t.status]||t.status}
                    </span>
                    {/* Deadline */}
                    {dl && (
                      <span style={{fontSize:'.72rem',padding:'3px 9px',borderRadius:6,background:isLate?'rgba(255,77,109,.15)':'var(--surface3)',color:isLate?'var(--red)':'var(--muted2)',fontWeight:isLate?700:400,flexShrink:0,whiteSpace:'nowrap'}}>
                        {isLate?'⚠️ ':''}{dl}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {panelTasks.length > 0 && (
              <div style={{textAlign:'right',marginTop:10}}>
                <button onClick={()=>router.push('/tasks')}
                  style={{background:'none',border:'none',color:'var(--purple2)',cursor:'pointer',fontSize:'.78rem',fontFamily:'inherit',fontWeight:600}}>
                  Open full Tasks page →
                </button>
              </div>
            )}
          </Card>
        )}

        {/* ── TEAM PERFORMANCE + DUE TODAY ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
          <Card>
            <div style={{fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:16}}>Team Performance</div>
            <div style={{display:'flex',gap:24,alignItems:'center'}}>
              <Ring value={healthScore} size={90} color="var(--purple)" label="health"/>
              <div style={{flex:1}}>
                {[['Task Completion',completionPct,'var(--purple)'],['On-Time Rate',Math.max(0,100-overdue*12),'var(--green)'],['Team Active',members.length>0?85:0,'var(--cyan)']].map(([l,v,c])=>(
                  <div key={l} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:'.75rem',color:'var(--muted2)'}}>{l}</span>
                      <span style={{fontSize:'.75rem',fontWeight:700,color:c}}>{v}%</span>
                    </div>
                    <ProgressBar value={v} color={c}/>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <div style={{fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>Due Today</div>
            {dueToday.length===0
              ? <div style={{color:'var(--muted)',fontSize:'.82rem',textAlign:'center',padding:'20px 0'}}>🎉 Nothing due today!</div>
              : dueToday.slice(0,5).map(t=>(
                <div key={t.id||t.title} onClick={()=>router.push('/tasks')} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                  <Tag label={t.priority||'P3'} color={PRI_COLOR[t.priority]}/>
                  <span style={{flex:1,fontSize:'.84rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</span>
                </div>
              ))
            }
          </Card>
        </div>

        {/* ── TASK OVERVIEW ── */}
        <div style={{marginBottom:8,fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)'}}>Task Overview</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:28}}>
          {[['📋','todo','To Do',todo,'var(--muted2)'],['⚡','inprogress','In Progress',inProg,'var(--cyan)'],['👁','review','Under Review',review,'var(--yellow)'],['✅','done','Done',done,'var(--green)']].map(([icon,key,label,val,color])=>(
            <Card key={key} hover={isAdmin} onClick={()=>togglePanel(key)}
              style={{textAlign:'center',cursor:isAdmin?'pointer':'default',border:panel===key?`1.5px solid ${color}`:'1px solid var(--border)',background:panel===key?color+'10':undefined,transition:'all .15s'}}>
              <div style={{fontSize:'1.6rem',marginBottom:6}}>{icon}</div>
              <div style={{fontSize:'1.6rem',fontWeight:900,color}}>{val}</div>
              <div style={{fontSize:'.72rem',color:'var(--muted2)',marginTop:2}}>{label}</div>
              {isAdmin && <div style={{fontSize:'.62rem',color,marginTop:4,opacity:.6}}>{panel===key?'▲ collapse':'▼ click to view'}</div>}
            </Card>
          ))}
        </div>

        {/* ── REWARDS ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:28}}>
          <Card style={{background:'linear-gradient(135deg,rgba(255,214,10,.08),rgba(255,159,67,.06))',border:'1px solid rgba(255,214,10,.2)'}}>
            <div style={{fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#FFD60A',marginBottom:10}}>This Week's Reward</div>
            {weekReward ? <>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:'2rem'}}>🎁</span>
                <div><div style={{fontWeight:800,fontSize:'1.05rem'}}>{weekReward.name}</div></div>
              </div>
              <ProgressBar value={completionPct} color="#FFD60A" style={{marginTop:12}}/>
              <div style={{fontSize:'.72rem',color:'var(--muted2)',marginTop:4}}>{completionPct}% tasks complete</div>
            </> : <div style={{color:'var(--muted)',fontSize:'.84rem'}}>No weekly reward set</div>}
          </Card>
          <Card style={{background:'linear-gradient(135deg,rgba(124,92,252,.06),rgba(0,212,255,.04))',border:'1px solid rgba(124,92,252,.2)'}}>
            <div style={{fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--purple2)',marginBottom:10}}>Monthly Trip Challenge</div>
            {tripReward ? <>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:'2rem'}}>✈️</span>
                <div><div style={{fontWeight:800,fontSize:'1.05rem'}}>{tripReward.name}</div></div>
              </div>
              <ProgressBar value={completionPct} color="var(--purple)" style={{marginTop:12}}/>
            </> : <div style={{color:'var(--muted)',fontSize:'.84rem'}}>No trip reward set</div>}
          </Card>
        </div>

        {/* ── TEAM ── */}
        {members.length > 0 && <>
          <div style={{marginBottom:12,fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--muted)'}}>Team</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
            {members.slice(0,8).map((m,i) => (
              <Card key={m.id} hover onClick={()=>router.push('/team')} style={{display:'flex',alignItems:'center',gap:12}}>
                <Avatar name={m.name||m.email} image={m.image} size={38} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name||m.email}</div>
                  <div style={{fontSize:'.7rem',color:'var(--muted2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.job_title||m.role}</div>
                  <div style={{fontSize:'.72rem',color:'var(--yellow)',marginTop:2}}>🪙 {(m.coins||0).toLocaleString()}</div>
                </div>
              </Card>
            ))}
          </div>
        </>}
      </div>
    </Layout>
  );
}
