import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Card, Modal, Spinner, Avatar, MEMBER_COLORS, toast } from '../components/UI';

const api = (url, method='GET', body) =>
  fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined }).then(r=>r.json());

const STATUS = {
  present:  { label:'Present',    icon:'✅', color:'#00E5A0', bg:'rgba(0,229,160,.12)'  },
  absent:   { label:'Absent',     icon:'❌', color:'#FF4D6D', bg:'rgba(255,77,109,.12)' },
  halfday:  { label:'Half Day',   icon:'🌓', color:'#FFD60A', bg:'rgba(255,214,10,.12)' },
  leave:    { label:'Leave',      icon:'🏖️', color:'#7C5CFC', bg:'rgba(124,92,252,.12)' },
  wfh:      { label:'Work From Home', icon:'🏠', color:'#00D4FF', bg:'rgba(0,212,255,.12)' },
  holiday:  { label:'Holiday',    icon:'🎉', color:'#FF9F43', bg:'rgba(255,159,67,.12)' },
};

function dateStr(d) { return d.toISOString().split('T')[0]; }
function monthDays(y, m) { return new Date(y, m+1, 0).getDate(); }

export default function Attendance() {
  const { data:session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';
  const userId  = session?.user?.id;

  const today  = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [records, setRecords]   = useState([]);
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [marking, setMarking]   = useState(false);
  const [showMark,setShowMark]  = useState(null); // { user, date }
  const [markStatus, setMarkStatus] = useState('present');
  const [markNote,   setMarkNote]   = useState('');
  const [view, setView] = useState('month'); // month | today

  const load = useCallback(async () => {
    setLoading(true);
    const [att, mem] = await Promise.all([
      api(`/api/attendance?month=${month}&year=${year}`),
      api('/api/members'),
    ]);
    setRecords(Array.isArray(att) ? att : []);
    setMembers(Array.isArray(mem) ? mem : []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { if (status==='authenticated') load(); }, [status, load]);

  async function markAttendance() {
    if (!showMark) return;
    setMarking(true);
    await api('/api/attendance', 'POST', {
      user_id: showMark.user.id,
      date:    showMark.date,
      status:  markStatus,
      note:    markNote,
    });
    setMarking(false);
    setShowMark(null);
    setMarkNote('');
    toast.success(`Marked ${STATUS[markStatus].label} for ${showMark.user.name}`);
    load();
  }

  // Get attendance for a specific user+date
  function getRecord(userId, date) {
    return records.find(r => r.user_id === userId && String(r.date).slice(0,10) === date);
  }

  // Summary counts for a user this month
  function userSummary(uid) {
    const userRecs = records.filter(r => r.user_id === uid);
    return {
      present: userRecs.filter(r=>r.status==='present').length,
      absent:  userRecs.filter(r=>r.status==='absent').length,
      leave:   userRecs.filter(r=>r.status==='leave').length,
      halfday: userRecs.filter(r=>r.status==='halfday').length,
      wfh:     userRecs.filter(r=>r.status==='wfh').length,
      holiday: userRecs.filter(r=>r.status==='holiday').length,
    };
  }

  // Working days in the month (Mon-Sat, skip Sundays)
  const totalDays = monthDays(year, month-1);
  const workDays  = Array.from({length:totalDays},(_,i)=>i+1)
    .filter(d => new Date(year,month-1,d).getDay() !== 0).length;

  const todayStr  = dateStr(today);
  const monthName = new Date(year, month-1).toLocaleString('en-IN',{month:'long',year:'numeric'});

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.2rem',margin:0}}>📋 Attendance</h2>
            <p style={{fontSize:'.78rem',color:'var(--muted2)',margin:'4px 0 0'}}>
              {isAdmin ? 'Mark and manage team attendance' : 'View your attendance record'}
            </p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {/* Month nav */}
            <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'4px 8px'}}>
              <button onClick={()=>{let m=month-1,y=year;if(m<1){m=12;y--;}setMonth(m);setYear(y);}} style={{background:'none',border:'none',color:'var(--muted2)',cursor:'pointer',fontSize:'1rem',padding:'0 4px'}}>‹</button>
              <span style={{fontSize:'.85rem',fontWeight:700,minWidth:130,textAlign:'center'}}>{monthName}</span>
              <button onClick={()=>{let m=month+1,y=year;if(m>12){m=1;y++;}setMonth(m);setYear(y);}} style={{background:'none',border:'none',color:'var(--muted2)',cursor:'pointer',fontSize:'1rem',padding:'0 4px'}}>›</button>
            </div>
            {/* View toggle */}
            <div style={{display:'flex',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:3,gap:3}}>
              {[['month','📅 Month'],['today','📌 Today']].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)} style={{padding:'5px 12px',borderRadius:6,border:'none',background:view===v?'var(--surface3)':'transparent',color:view===v?'var(--text)':'var(--muted2)',fontSize:'.78rem',fontWeight:view===v?700:400,cursor:'pointer',fontFamily:'inherit'}}>
                  {l}
                </button>
              ))}
            </div>
            {/* Today quick mark */}
            {isAdmin && (
              <Btn onClick={()=>{ setShowMark({user:null,date:todayStr,bulk:true}); setMarkStatus('present'); setMarkNote(''); }}>
                ✅ Mark Today
              </Btn>
            )}
          </div>
        </div>

        {loading && <div style={{textAlign:'center',padding:60}}><Spinner size={28}/></div>}

        {/* ── TODAY VIEW ── */}
        {!loading && view==='today' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {members.map((m,i) => {
              const rec = getRecord(m.id, todayStr);
              const st  = rec ? STATUS[rec.status] : null;
              return (
                <Card key={m.id} style={{border:st?`1px solid ${st.color}44`:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <Avatar name={m.name||m.email} image={m.image} size={42} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted2)'}}>{m.job_title||m.role}</div>
                    </div>
                  </div>
                  {st ? (
                    <div style={{padding:'8px 12px',borderRadius:9,background:st.bg,display:'flex',alignItems:'center',gap:8,marginBottom:isAdmin?10:0}}>
                      <span style={{fontSize:'1.1rem'}}>{st.icon}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:'.85rem',color:st.color}}>{st.label}</div>
                        {rec.note && <div style={{fontSize:'.7rem',color:'var(--muted2)'}}>{rec.note}</div>}
                      </div>
                    </div>
                  ) : (
                    <div style={{padding:'8px 12px',borderRadius:9,background:'var(--surface3)',color:'var(--muted)',fontSize:'.82rem',marginBottom:isAdmin?10:0,textAlign:'center'}}>
                      Not marked yet
                    </div>
                  )}
                  {isAdmin && (
                    <button onClick={()=>{setShowMark({user:m,date:todayStr});setMarkStatus(rec?.status||'present');setMarkNote(rec?.note||'');}}
                      style={{width:'100%',padding:'8px',background: rec ? st.bg : 'rgba(124,92,252,.12)', border:`1px solid ${rec ? st.color+'55' : 'rgba(124,92,252,.25)'}`,borderRadius:8,color: rec ? st.color : 'var(--purple2)',cursor:'pointer',fontSize:'.8rem',fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <span>✏️</span> {rec ? `Change from ${st.label}` : 'Mark Attendance'}
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {!loading && view==='month' && (
          <div>
            {/* Summary cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,marginBottom:24}}>
              {members.map((m,i) => {
                const s = userSummary(m.id);
                const pct = workDays > 0 ? Math.round((s.present + s.halfday*0.5 + s.wfh) / workDays * 100) : 0;
                return (
                  <Card key={m.id} style={{position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <Avatar name={m.name||m.email} image={m.image} size={36} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:'.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                        <div style={{fontSize:'.68rem',color:'var(--muted2)'}}>{m.job_title||m.role}</div>
                      </div>
                      <div style={{fontSize:'1rem',fontWeight:900,color:pct>=80?'var(--green)':pct>=60?'var(--yellow)':'var(--red)'}}>{pct}%</div>
                    </div>
                    {/* Progress bar */}
                    <div style={{height:4,background:'var(--surface3)',borderRadius:2,marginBottom:10,overflow:'hidden'}}>
                      <div style={{height:'100%',width:pct+'%',background:pct>=80?'var(--green)':pct>=60?'var(--yellow)':'var(--red)',borderRadius:2,transition:'width .4s'}}/>
                    </div>
                    {/* Status counts */}
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {Object.entries(s).filter(([,v])=>v>0).map(([k,v])=>(
                        <span key={k} style={{padding:'2px 7px',borderRadius:6,background:STATUS[k]?.bg,color:STATUS[k]?.color,fontSize:'.68rem',fontWeight:700}}>
                          {STATUS[k]?.icon} {v}
                        </span>
                      ))}
                      {Object.values(s).every(v=>v===0) && <span style={{fontSize:'.72rem',color:'var(--muted)'}}>No records yet</span>}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Monthly calendar grid */}
            {isAdmin && (
              <Card>
                <div style={{fontWeight:700,fontSize:'.9rem',marginBottom:16}}>📅 Monthly Grid — {monthName}</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
                    <thead>
                      <tr>
                        <th style={{padding:'8px 12px',textAlign:'left',fontSize:'.75rem',color:'var(--muted)',fontWeight:600,borderBottom:'1px solid var(--border)',minWidth:120}}>Member</th>
                        {Array.from({length:totalDays},(_,i)=>i+1).map(d=>{
                          const date = new Date(year,month-1,d);
                          const isSun = date.getDay()===0;
                          const isToday = dateStr(date)===todayStr;
                          return (
                            <th key={d} style={{padding:'4px 2px',fontSize:'.65rem',color:isSun?'var(--muted)':isToday?'var(--purple2)':'var(--muted2)',fontWeight:isToday?800:500,borderBottom:'1px solid var(--border)',minWidth:30,textAlign:'center',background:isSun?'rgba(255,255,255,.02)':undefined}}>
                              <div>{d}</div>
                              <div style={{fontSize:'.55rem'}}>{['S','M','T','W','T','F','S'][date.getDay()]}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m,mi)=>(
                        <tr key={m.id} style={{borderBottom:'1px solid var(--border)'}}>
                          <td style={{padding:'6px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <Avatar name={m.name} image={m.image} size={22} color={MEMBER_COLORS[mi%MEMBER_COLORS.length]}/>
                              <span style={{fontSize:'.78rem',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:80}}>{m.name}</span>
                            </div>
                          </td>
                          {Array.from({length:totalDays},(_,i)=>i+1).map(d=>{
                            const date = new Date(year,month-1,d);
                            const ds   = dateStr(date);
                            const isSun= date.getDay()===0;
                            const rec  = getRecord(m.id, ds);
                            const st   = rec ? STATUS[rec.status] : null;
                            const isFut= ds > todayStr;
                            return (
                              <td key={d} title={st?`${m.name}: ${st.label}${rec.note?` — ${rec.note}`:''}`:undefined}
                                onClick={()=>{ if(!isSun&&!isFut&&isAdmin){setShowMark({user:m,date:ds});setMarkStatus(rec?.status||'present');setMarkNote(rec?.note||'');} }}
                                style={{padding:'4px 2px',textAlign:'center',cursor:!isSun&&!isFut&&isAdmin?'pointer':'default',background:isSun?'rgba(255,255,255,.02)':undefined}}>
                                <div style={{width:24,height:24,borderRadius:6,background:st?st.bg:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem',margin:'0 auto',border:ds===todayStr?'1.5px solid var(--purple)':undefined,transition:'background .1s'}}>
                                  {st ? st.icon : isSun ? '' : isFut ? '' : <span style={{color:'var(--border2)',fontSize:'.55rem'}}>·</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:14,paddingTop:12,borderTop:'1px solid var(--border)'}}>
                  {Object.entries(STATUS).map(([k,v])=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:'.72rem',color:'var(--muted2)'}}>
                      <span style={{fontSize:'.85rem'}}>{v.icon}</span> {v.label}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── MARK ATTENDANCE MODAL ── */}
      {showMark && showMark.user && (
        <Modal open={true} title={`Mark Attendance — ${showMark.user.name}`} onClose={()=>setShowMark(null)}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{fontSize:'.78rem',color:'var(--muted2)',textAlign:'center'}}>
              📅 {new Date(showMark.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
            {/* Status picker */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {Object.entries(STATUS).map(([k,v])=>(
                <button key={k} onClick={()=>setMarkStatus(k)}
                  style={{padding:'10px 8px',border:`1.5px solid ${markStatus===k?v.color:'var(--border)'}`,borderRadius:10,background:markStatus===k?v.bg:'var(--surface3)',cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:4,transition:'all .15s'}}>
                  <span style={{fontSize:'1.3rem'}}>{v.icon}</span>
                  <span style={{fontSize:'.72rem',fontWeight:markStatus===k?700:400,color:markStatus===k?v.color:'var(--muted2)'}}>{v.label}</span>
                </button>
              ))}
            </div>
            {/* Note */}
            <div>
              <div style={{fontSize:'.75rem',fontWeight:600,marginBottom:5}}>Note (optional)</div>
              <input value={markNote} onChange={e=>setMarkNote(e.target.value)}
                placeholder="e.g. Medical leave, WFH approved by Manoj…"
                style={{width:'100%',background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:8,padding:'9px 12px',fontSize:'.84rem',color:'var(--text)',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',gap:10}}>
              <Btn variant="ghost" onClick={()=>setShowMark(null)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={markAttendance} disabled={marking} style={{flex:2,background:STATUS[markStatus]?.color}}>
                {marking?'⏳ Saving…':`${STATUS[markStatus]?.icon} Mark ${STATUS[markStatus]?.label}`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── BULK MARK TODAY MODAL ── */}
      {showMark && showMark.bulk && (
        <Modal open={true} title="✅ Mark Attendance — Today" onClose={()=>setShowMark(null)} width={680}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontSize:'.78rem',color:'var(--muted2)',textAlign:'center'}}>
              📅 {new Date(todayStr+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:400,overflowY:'auto'}}>
              {members.map((m,i) => {
                const rec = getRecord(m.id, todayStr);
                const st  = rec ? STATUS[rec.status] : null;
                return (
                  <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--surface2)',borderRadius:10,border:'1px solid var(--border)'}}>
                    <Avatar name={m.name} image={m.image} size={34} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'.86rem'}}>{m.name}</div>
                      <div style={{fontSize:'.7rem',color:'var(--muted2)'}}>{m.job_title||m.role}</div>
                    </div>
                    {st && <span style={{padding:'3px 10px',borderRadius:20,background:st.bg,color:st.color,fontSize:'.7rem',fontWeight:700}}>{st.icon} {st.label}</span>}
                    <div style={{display:'flex',gap:4}}>
                      {Object.entries(STATUS).slice(0,5).map(([k,v])=>(
                        <button key={k} title={v.label}
                          onClick={async()=>{
                            await api('/api/attendance','POST',{user_id:m.id,date:todayStr,status:k,note:'',});
                            toast.success(`${v.icon} ${m.name} — ${v.label}`);
                            load();
                          }}
                          style={{width:28,height:28,border:`1.5px solid ${rec?.status===k?v.color:'var(--border)'}`,borderRadius:7,background:rec?.status===k?v.bg:'var(--surface3)',cursor:'pointer',fontSize:'.82rem',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}>
                          {v.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Btn variant="ghost" onClick={()=>setShowMark(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    <style>{`.att-cell:hover > div { background: rgba(124,92,252,.15) !important; border-color: rgba(124,92,252,.4) !important; }`}</style>
    </Layout>
  );
}
