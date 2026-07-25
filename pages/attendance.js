import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Card, Spinner, Avatar, MEMBER_COLORS, toast } from '../components/UI';

const api = (url, method='GET', body) =>
  fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined }).then(r=>r.json());

const STATUS = {
  present:  { label:'Present',        icon:'✅', color:'#00E5A0', bg:'rgba(0,229,160,.15)'  },
  absent:   { label:'Absent',         icon:'❌', color:'#FF4D6D', bg:'rgba(255,77,109,.15)' },
  halfday:  { label:'Half Day',       icon:'🌓', color:'#FFD60A', bg:'rgba(255,214,10,.15)' },
  leave:    { label:'Leave',          icon:'🏖️', color:'#7C5CFC', bg:'rgba(124,92,252,.15)' },
  wfh:      { label:'Work From Home', icon:'🏠', color:'#00D4FF', bg:'rgba(0,212,255,.15)'  },
  holiday:  { label:'Holiday',        icon:'🎉', color:'#FF9F43', bg:'rgba(255,159,67,.15)' },
};

function toDateStr(d) { return d.toISOString().split('T')[0]; }

export default function Attendance() {
  const { data:session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';
  const today   = new Date();
  const todayStr = toDateStr(today);

  const [year,    setYear]    = useState(today.getFullYear());
  const [month,   setMonth]   = useState(today.getMonth() + 1);
  const [records, setRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [view,    setView]    = useState('today');

  // Modal state — simple object: { user, date } or null
  const [modal,       setModal]       = useState(null);
  const [modalStatus, setModalStatus] = useState('present');
  const [modalNote,   setModalNote]   = useState('');

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

  function getRecord(uid, date) {
    return records.find(r => r.user_id === uid && String(r.date).slice(0,10) === date) || null;
  }

  function openModal(user, date) {
    const rec = getRecord(user.id, date);
    setModal({ user, date });
    setModalStatus(rec?.status || 'present');
    setModalNote(rec?.note || '');
  }

  async function saveAttendance() {
    if (!modal) return;
    setSaving(true);
    try {
      await api('/api/attendance', 'POST', {
        user_id: modal.user.id,
        date:    modal.date,
        status:  modalStatus,
        note:    modalNote,
      });
      toast.success(`${STATUS[modalStatus].icon} ${modal.user.name} — ${STATUS[modalStatus].label}`);
      setModal(null);
      load();
    } catch(e) {
      toast.error('Failed to save');
    }
    setSaving(false);
  }

  const totalDays = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month-1).toLocaleString('en-IN',{month:'long',year:'numeric'});

  function userSummary(uid) {
    const ur = records.filter(r => r.user_id === uid);
    const s = {};
    Object.keys(STATUS).forEach(k => s[k] = ur.filter(r=>r.status===k).length);
    return s;
  }

  const workDays = Array.from({length:totalDays},(_,i)=>i+1)
    .filter(d => new Date(year,month-1,d).getDay() !== 0).length;

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.2rem',margin:0}}>📋 Attendance</h2>
            <p style={{fontSize:'.78rem',color:'var(--muted2)',margin:'4px 0 0'}}>
              {isAdmin ? 'Mark and manage team attendance — admin only' : 'Your attendance record'}
            </p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {/* Month nav */}
            <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'4px 10px'}}>
              <button onClick={()=>{let m=month-1,y=year;if(m<1){m=12;y--;}setMonth(m);setYear(y);}} style={{background:'none',border:'none',color:'var(--muted2)',cursor:'pointer',fontSize:'1.1rem',lineHeight:1,padding:'0 4px'}}>‹</button>
              <span style={{fontSize:'.85rem',fontWeight:700,minWidth:140,textAlign:'center'}}>{monthName}</span>
              <button onClick={()=>{let m=month+1,y=year;if(m>12){m=1;y++;}setMonth(m);setYear(y);}} style={{background:'none',border:'none',color:'var(--muted2)',cursor:'pointer',fontSize:'1.1rem',lineHeight:1,padding:'0 4px'}}>›</button>
            </div>
            {/* View tabs */}
            <div style={{display:'flex',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:9,padding:3,gap:2}}>
              {[['today','📌 Today'],['month','📅 Month']].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{padding:'6px 14px',borderRadius:7,border:'none',background:view===v?'var(--surface3)':'transparent',color:view===v?'var(--text)':'var(--muted2)',fontSize:'.8rem',fontWeight:view===v?700:400,cursor:'pointer',fontFamily:'inherit'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && <div style={{textAlign:'center',padding:60}}><Spinner size={28}/></div>}

        {/* ── TODAY VIEW ── */}
        {!loading && view==='today' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:12}}>
            {members.map((m,i) => {
              const rec = getRecord(m.id, todayStr);
              const st  = rec ? STATUS[rec.status] : null;
              return (
                <Card key={m.id} style={{border:st?`1.5px solid ${st.color}44`:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <Avatar name={m.name||m.email} image={m.image} size={44} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'.92rem'}}>{m.name}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted2)'}}>{m.job_title||m.role}</div>
                    </div>
                  </div>

                  {/* Current status */}
                  {st ? (
                    <div style={{padding:'10px 12px',borderRadius:10,background:st.bg,display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <span style={{fontSize:'1.3rem'}}>{st.icon}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:'.88rem',color:st.color}}>{st.label}</div>
                        {rec.note && <div style={{fontSize:'.7rem',color:'var(--muted2)',marginTop:2}}>{rec.note}</div>}
                      </div>
                    </div>
                  ) : (
                    <div style={{padding:'10px 12px',borderRadius:10,background:'var(--surface3)',fontSize:'.82rem',color:'var(--muted)',textAlign:'center',marginBottom:10}}>
                      Not marked yet
                    </div>
                  )}

                  {/* Admin edit button */}
                  {isAdmin && (
                    <button
                      onClick={() => openModal(m, todayStr)}
                      style={{width:'100%',padding:'9px',background:st?st.bg:'rgba(124,92,252,.12)',border:`1px solid ${st?st.color+'55':'rgba(124,92,252,.3)'}`,borderRadius:9,color:st?st.color:'var(--purple2)',cursor:'pointer',fontSize:'.82rem',fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      ✏️ {st ? `Edit (${st.label})` : 'Mark Attendance'}
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
            {/* Summary row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,marginBottom:24}}>
              {members.map((m,i) => {
                const s   = userSummary(m.id);
                const pct = workDays>0 ? Math.round(((s.present||0)+(s.halfday||0)*0.5+(s.wfh||0))/workDays*100) : 0;
                return (
                  <Card key={m.id}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <Avatar name={m.name} image={m.image} size={34} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:'.84rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                        <div style={{fontSize:'.68rem',color:'var(--muted2)'}}>{m.job_title}</div>
                      </div>
                      <div style={{fontSize:'1rem',fontWeight:900,color:pct>=80?'#00E5A0':pct>=60?'#FFD60A':'#FF4D6D'}}>{pct}%</div>
                    </div>
                    <div style={{height:4,background:'var(--surface3)',borderRadius:2,marginBottom:8,overflow:'hidden'}}>
                      <div style={{height:'100%',width:pct+'%',background:pct>=80?'#00E5A0':pct>=60?'#FFD60A':'#FF4D6D',borderRadius:2}}/>
                    </div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {Object.entries(s).filter(([,v])=>v>0).map(([k,v])=>(
                        <span key={k} style={{padding:'1px 7px',borderRadius:5,background:STATUS[k].bg,color:STATUS[k].color,fontSize:'.67rem',fontWeight:700}}>
                          {STATUS[k].icon} {v}
                        </span>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Calendar grid */}
            {isAdmin && (
              <Card>
                <div style={{fontWeight:700,marginBottom:14,fontSize:'.92rem'}}>📅 {monthName} — Click any cell to mark/edit</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
                    <thead>
                      <tr>
                        <th style={{padding:'6px 10px',textAlign:'left',fontSize:'.72rem',color:'var(--muted)',borderBottom:'1px solid var(--border)',minWidth:130,whiteSpace:'nowrap'}}>Member</th>
                        {Array.from({length:totalDays},(_,i)=>i+1).map(d=>{
                          const date  = new Date(year,month-1,d);
                          const isSun = date.getDay()===0;
                          const ds    = toDateStr(date);
                          return (
                            <th key={d} style={{padding:'4px 1px',fontSize:'.62rem',fontWeight:ds===todayStr?800:500,color:isSun?'rgba(255,255,255,.2)':ds===todayStr?'var(--purple2)':'var(--muted)',borderBottom:'1px solid var(--border)',width:28,textAlign:'center'}}>
                              <div>{d}</div>
                              <div style={{fontSize:'.52rem',opacity:.6}}>{['S','M','T','W','T','F','S'][date.getDay()]}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m,mi)=>(
                        <tr key={m.id} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                          <td style={{padding:'5px 10px',whiteSpace:'nowrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <Avatar name={m.name} image={m.image} size={20} color={MEMBER_COLORS[mi%MEMBER_COLORS.length]}/>
                              <span style={{fontSize:'.76rem',fontWeight:600}}>{m.name?.split(' ')[0]}</span>
                            </div>
                          </td>
                          {Array.from({length:totalDays},(_,i)=>i+1).map(d=>{
                            const date  = new Date(year,month-1,d);
                            const ds    = toDateStr(date);
                            const isSun = date.getDay()===0;
                            const isFut = ds > todayStr;
                            const rec   = getRecord(m.id, ds);
                            const st    = rec ? STATUS[rec.status] : null;
                            const isToday = ds===todayStr;

                            return (
                              <td key={d}
                                onClick={()=>{ if(!isSun && !isFut) openModal(m, ds); }}
                                title={st ? `${m.name}: ${st.label}${rec?.note?' — '+rec.note:''}` : !isSun&&!isFut?`Click to mark ${m.name}`:''}
                                style={{padding:'3px 1px',textAlign:'center',cursor:!isSun&&!isFut?'pointer':'default'}}>
                                <div style={{
                                  width:24,height:24,borderRadius:6,margin:'0 auto',
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:'.78rem',
                                  background: st ? st.bg : isSun ? 'transparent' : isFut ? 'transparent' : 'rgba(255,255,255,.03)',
                                  border: isToday ? '1.5px solid var(--purple2)' : st ? `1px solid ${st.color}55` : isSun||isFut ? 'none' : '1px solid rgba(255,255,255,.06)',
                                  transition:'all .1s',
                                }}>
                                  {st ? st.icon : isSun ? <span style={{opacity:.15,fontSize:'.5rem'}}>—</span> : isFut ? '' : <span style={{opacity:.25,fontSize:'.65rem'}}>+</span>}
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
                <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:14,paddingTop:12,borderTop:'1px solid var(--border)'}}>
                  {Object.entries(STATUS).map(([k,v])=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:'.72rem',color:'var(--muted2)'}}>
                      <span>{v.icon}</span>{v.label}
                    </div>
                  ))}
                  <div style={{fontSize:'.72rem',color:'var(--muted)',marginLeft:'auto'}}>Click any cell to mark or edit</div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── MARK / EDIT MODAL ── */}
      {modal !== null && (
        <div onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',backdropFilter:'blur(6px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:16,padding:28,width:'100%',maxWidth:480,boxShadow:'0 24px 80px rgba(0,0,0,.6)'}}>

            {/* Modal header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <div style={{fontWeight:800,fontSize:'1rem'}}>
                Mark Attendance — {modal.user.name}
              </div>
              <button onClick={()=>setModal(null)} style={{background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:8,width:32,height:32,cursor:'pointer',color:'var(--muted)',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>

            {/* Date */}
            <div style={{textAlign:'center',fontSize:'.82rem',color:'var(--muted2)',marginBottom:18,padding:'8px',background:'var(--surface3)',borderRadius:8}}>
              📅 {new Date(modal.date+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>

            {/* Status grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
              {Object.entries(STATUS).map(([k,v])=>(
                <button key={k} onClick={()=>setModalStatus(k)}
                  style={{padding:'12px 8px',border:`2px solid ${modalStatus===k?v.color:'var(--border)'}`,borderRadius:12,background:modalStatus===k?v.bg:'var(--surface3)',cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:5,transition:'all .15s'}}>
                  <span style={{fontSize:'1.4rem'}}>{v.icon}</span>
                  <span style={{fontSize:'.72rem',fontWeight:modalStatus===k?700:400,color:modalStatus===k?v.color:'var(--muted2)'}}>{v.label}</span>
                </button>
              ))}
            </div>

            {/* Note */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:'.75rem',fontWeight:600,marginBottom:6,color:'var(--muted2)'}}>Note (optional)</div>
              <input value={modalNote} onChange={e=>setModalNote(e.target.value)}
                placeholder="e.g. Doctor appointment, WFH approved…"
                onKeyDown={e=>e.key==='Enter'&&saveAttendance()}
                style={{width:'100%',background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:9,padding:'10px 14px',fontSize:'.85rem',color:'var(--text)',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
            </div>

            {/* Actions */}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setModal(null)}
                style={{flex:1,padding:'11px',background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:10,color:'var(--muted2)',cursor:'pointer',fontSize:'.88rem',fontFamily:'inherit',fontWeight:600}}>
                Cancel
              </button>
              <button onClick={saveAttendance} disabled={saving}
                style={{flex:2,padding:'11px',background:STATUS[modalStatus].color,border:'none',borderRadius:10,color:'#fff',cursor:'pointer',fontSize:'.88rem',fontFamily:'inherit',fontWeight:700,opacity:saving?.6:1}}>
                {saving ? '⏳ Saving…' : `${STATUS[modalStatus].icon} Save ${STATUS[modalStatus].label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
