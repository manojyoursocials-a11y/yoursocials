import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Avatar, Spinner, Tag, toast, api, MEMBER_COLORS } from '../components/UI';

const STATUS_COLS = [
  { id:'todo',       label:'To Do',       color:'#9090AA' },
  { id:'inprogress', label:'In Progress', color:'#00D4FF' },
];

async function fetchJ(url) {
  const r = await fetch(url);
  return r.json();
}

export default function Team() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const userId  = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';

  const [members,     setMembers]     = useState([]);
  const [allTasks,    setAllTasks]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState('board');    // board | cards
  const [selectedMem, setSelectedMem] = useState(null);      // filter by member
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState({ job_title:'', image:'' });

  useEffect(() => {
    if (status === 'authenticated') loadAll();
  }, [status]);

  async function loadAll() {
    setLoading(true);
    const [ms, ts] = await Promise.all([fetchJ('/api/members'), fetchJ('/api/tasks')]);
    setMembers(Array.isArray(ms) ? ms : []);
    setAllTasks(Array.isArray(ts) ? ts : []);
    setLoading(false);
  }

  // Export one member's task board as a PNG image
  async function exportMemberImage(member) {
    const todo       = allTasks.filter(t => t.owner_id === member.id && t.status === 'todo');
    const inprogress = allTasks.filter(t => t.owner_id === member.id && t.status === 'inprogress');
    const color      = MEMBER_COLORS[members.indexOf(member) % MEMBER_COLORS.length] || '#7C5CFC';

    const W = 900, PAD = 28, COL_GAP = 20, HEADER_H = 80;
    const COL_W = (W - PAD * 2 - COL_GAP) / 2;
    const TASK_H = 56, TASK_GAP = 8;

    const maxTasks = Math.max(todo.length, inprogress.length, 1);
    const colH = 48 + maxTasks * (TASK_H + TASK_GAP) + 20;
    const H = HEADER_H + PAD + colH + PAD + 24;

    const canvas = document.createElement('canvas');
    canvas.width  = W * 2;  // 2x for retina
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#09090F';
    ctx.fillRect(0, 0, W, H);

    // Brand header strip
    ctx.fillStyle = color + '22';
    ctx.fillRect(0, 0, W, HEADER_H);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 5, HEADER_H);

    // Avatar circle
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(44, HEADER_H/2, 26, 0, 2*Math.PI); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((member.name||'?').slice(0,2).toUpperCase(), 44, HEADER_H/2);

    // Name + role
    ctx.fillStyle = '#F0EFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(member.name || member.email, 82, HEADER_H/2 - 10);
    ctx.fillStyle = '#9090AA';
    ctx.font = '13px Arial';
    ctx.fillText(member.job_title || member.role || 'Team Member', 82, HEADER_H/2 + 12);

    // Stats on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD60A';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('🪙 ' + (member.coins || 0), W - PAD, HEADER_H/2 - 10);
    ctx.fillStyle = '#00D4FF';
    ctx.font = '13px Arial';
    ctx.fillText(todo.length + inprogress.length + ' active tasks', W - PAD, HEADER_H/2 + 10);

    // Date top right
    ctx.fillStyle = '#6B6B8A';
    ctx.font = '11px Arial';
    const dateStr = new Date().toLocaleDateString('en-IN', {weekday:'short',day:'numeric',month:'short',year:'numeric'});
    ctx.fillText(dateStr, W - PAD, 14);

    // Watermark
    ctx.fillStyle = '#F0EFFF';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('YOUR SOCIALS OS', PAD, 14);

    // Draw columns
    function drawColumn(title, colColor, tasks, x) {
      // Column header
      ctx.fillStyle = '#16161F';
      ctx.beginPath();
      const rr = 10;
      ctx.roundRect(x, HEADER_H + PAD, COL_W, colH, rr);
      ctx.fill();

      // Column header bar
      ctx.fillStyle = colColor + '22';
      ctx.beginPath(); ctx.roundRect(x, HEADER_H + PAD, COL_W, 44, [rr, rr, 0, 0]); ctx.fill();
      ctx.fillStyle = colColor;
      ctx.fillRect(x, HEADER_H + PAD, 4, 44);

      ctx.fillStyle = colColor;
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(title, x + 14, HEADER_H + PAD + 22);

      // Count badge
      ctx.fillStyle = colColor + '33';
      const badgeX = x + COL_W - 38, badgeY = HEADER_H + PAD + 10, bW = 28, bH = 22;
      ctx.beginPath(); ctx.roundRect(badgeX, badgeY, bW, bH, 11); ctx.fill();
      ctx.fillStyle = colColor;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(tasks.length, badgeX + bW / 2, badgeY + bH / 2 + 1);

      // Tasks
      tasks.forEach((t, i) => {
        const ty = HEADER_H + PAD + 48 + i * (TASK_H + TASK_GAP);
        const tx = x + 8, tW = COL_W - 16;

        // Task card
        const overdue = t.deadline && String(t.deadline).slice(0,10) < today;
        ctx.fillStyle = overdue ? '#FF4D6D11' : '#1E1E2A';
        ctx.beginPath(); ctx.roundRect(tx, ty, tW, TASK_H, 8); ctx.fill();
        if (overdue) {
          ctx.strokeStyle = '#FF4D6D44';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(tx, ty, tW, TASK_H, 8); ctx.stroke();
        }

        // Priority badge
        const priColor = { P1:'#FF4D6D', P2:'#FF9F43', P3:'#FFD60A', P4:'#00E5A0' }[t.priority] || '#9090AA';
        ctx.fillStyle = priColor + '22';
        ctx.beginPath(); ctx.roundRect(tx + 8, ty + 8, 26, 16, 8); ctx.fill();
        ctx.fillStyle = priColor;
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t.priority || 'P3', tx + 21, ty + 16);

        // Title
        ctx.fillStyle = '#F0EFFF';
        ctx.font = '600 13px Arial';
        ctx.textAlign = 'left';
        const title_text = t.title.length > 38 ? t.title.slice(0, 38) + '…' : t.title;
        ctx.fillText(title_text, tx + 40, ty + 17);

        // Client + dates row
        ctx.fillStyle = '#9090AA';
        ctx.font = '11px Arial';
        let info = '';
        if (t.client_name) info += '🏢 ' + t.client_name;
        if (t.post_date)   info += (info?' · ':'') + '📤 ' + String(t.post_date).slice(0,10);
        if (t.deadline)    info += (info?' · ':'') + (overdue?'❗':'⏰ ') + String(t.deadline).slice(0,10);
        ctx.fillText(info || 'No date set', tx + 8, ty + 40);
      });

      if (tasks.length === 0) {
        ctx.fillStyle = '#6B6B8A';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Nothing here', x + COL_W / 2, HEADER_H + PAD + 90);
      }
    }

    drawColumn('📋 TO DO', '#9090AA', todo, PAD);
    drawColumn('⚡ IN PROGRESS', '#00D4FF', inprogress, PAD + COL_W + COL_GAP);

    // Footer
    ctx.fillStyle = '#3A3A50';
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = '#6B6B8A';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Generated by Your Socials OS — ' + new Date().toLocaleString('en-IN'), W / 2, H - 8);

    // Download
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = (member.name || 'member').replace(/ /g, '-') + '-tasks-' + new Date().toISOString().slice(0,10) + '.png';
    a.click();
    toast.success('Exported ' + (member.name?.split(' ')[0] || 'member') + "'s board as image 🖼️");
  }

  // Export ALL members as one combined image
  async function exportAllMembersImage() {
    toast.info('Generating team board image…');
    setTimeout(async () => {
      for (const m of displayMembers) {
        await exportMemberImage(m);
        await new Promise(r => setTimeout(r, 300));
      }
    }, 100);
  }

  function openEditProfile() {
    const me = members.find(m => m.email === session?.user?.email);
    setForm({ job_title: me?.job_title || session?.user?.job_title || '', image: me?.image || '' });
    setModal(true);
  }

  async function saveProfile() {
    const updates = { job_title: form.job_title };
    if (form.image !== (members.find(m=>m.email===session?.user?.email)?.image||'')) updates.image = form.image||null;
    const res = await api('/api/members','PATCH', updates);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Profile updated!');
    setModal(false);
    loadAll();
  }

  const today = new Date().toISOString().split('T')[0];

  // Tasks for a specific member, optionally filtered by status
  function memberTasks(memberId, statusId) {
    return allTasks.filter(t => t.owner_id === memberId && (!statusId || t.status === statusId));
  }

  // Summary stats per member
  function memberStats(memberId) {
    const tasks = allTasks.filter(t => t.owner_id === memberId);
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && String(t.deadline).slice(0,10) < today).length;
    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return { total: tasks.length, done, overdue, pct };
  }

  const displayMembers = selectedMem ? members.filter(m => m.id === selectedMem) : members;

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
        <Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading team…</span>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="fade-up">

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:4 }}>Team Board</h2>
            <p style={{ fontSize:'.82rem', color:'var(--muted2)' }}>{members.length} members · {allTasks.filter(t=>t.status!=='done').length} active tasks</p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {/* View toggle */}
            <div style={{ display:'flex', gap:4, background:'var(--surface2)', padding:3, borderRadius:9, border:'1px solid var(--border)' }}>
              {[['board','📋 Board'],['cards','👥 Members']].map(([v,l]) => (
                <button key={v} onClick={() => setView(v)} style={{ padding:'5px 12px', borderRadius:7, border:'none', background: view===v ? 'var(--surface)' : 'transparent', color: view===v ? 'var(--text)' : 'var(--muted)', fontSize:'.78rem', fontWeight: view===v ? 700 : 500, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>{l}</button>
              ))}
            </div>
            <Btn variant="ghost" onClick={openEditProfile}>✏️ My Profile</Btn>
            {view === 'board' && (
              <Btn variant="ghost" onClick={exportAllMembersImage}>📸 Export All</Btn>
            )}
          </div>
        </div>

        {/* Member filter strip */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, padding:'10px 14px', background:'var(--surface2)', borderRadius:12, border:'1px solid var(--border)' }}>
          <button onClick={() => setSelectedMem(null)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, border:'1px solid '+(selectedMem===null?'var(--purple)':'rgba(255,255,255,.1)'), background: selectedMem===null?'rgba(124,92,252,.15)':'transparent', color: selectedMem===null?'var(--purple2)':'var(--muted2)', fontSize:'.78rem', fontWeight: selectedMem===null?700:500, cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s' }}>
            All Members
          </button>
          {members.map((m,i) => (
            <button key={m.id} onClick={() => setSelectedMem(selectedMem===m.id ? null : m.id)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 12px 4px 6px', borderRadius:20, border:'1px solid '+(selectedMem===m.id?MEMBER_COLORS[i%MEMBER_COLORS.length]:'rgba(255,255,255,.1)'), background: selectedMem===m.id?MEMBER_COLORS[i%MEMBER_COLORS.length]+'22':'transparent', cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s' }}>
              <Avatar name={m.name||m.email} image={m.image} size={22} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
              <span style={{ fontSize:'.78rem', fontWeight: selectedMem===m.id?700:500, color: selectedMem===m.id?MEMBER_COLORS[i%MEMBER_COLORS.length]:'var(--muted2)' }}>{m.name?.split(' ')[0]||m.email?.split('@')[0]}</span>
              <span style={{ fontSize:'.65rem', color:'var(--muted)', background:'rgba(255,255,255,.06)', padding:'0 6px', borderRadius:20 }}>{memberTasks(m.id).filter(t=>t.status!=='done').length}</span>
            </button>
          ))}
        </div>

        {/* ── BOARD VIEW — everyone's tasks on one page ── */}
        {view === 'board' && (
          <div>
            {displayMembers.map((m, mi) => {
              const color  = MEMBER_COLORS[members.indexOf(m) % MEMBER_COLORS.length];
              const stats  = memberStats(m.id);
              const todoTasks       = memberTasks(m.id, 'todo');
              const inProgressTasks = memberTasks(m.id, 'inprogress');
              const allMTasks   = memberTasks(m.id);
              const hasActive   = allMTasks.filter(t=>t.status!=='done').length > 0;

              return (
                <div key={m.id} style={{ marginBottom:28 }}>
                  {/* Member header row */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, padding:'8px 12px', background:'var(--surface2)', borderRadius:10, border:'1px solid var(--border)', borderLeft:`4px solid ${color}` }}>
                    <Avatar name={m.name||m.email} image={m.image} size={38} color={color}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:'.92rem' }}>{m.name||m.email?.split('@')[0]}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>{m.job_title||m.role}</div>
                    </div>
                    {/* Coin balance */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <span style={{ color:'var(--yellow)', fontWeight:800, fontSize:'.88rem' }}>🪙 {(m.coins||0).toLocaleString()}</span>
                    </div>
                    {/* Quick stats */}
                    <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                      {[
                        [stats.total - stats.done, 'active', 'var(--cyan)'],
                        [stats.done, 'done', 'var(--green)'],
                        [stats.overdue, 'overdue', 'var(--red)'],
                      ].map(([v,l,c]) => v > 0 || l==='done' ? (
                        <div key={l} style={{ textAlign:'center', minWidth:36 }}>
                          <div style={{ fontSize:'.88rem', fontWeight:800, color:c }}>{v}</div>
                          <div style={{ fontSize:'.6rem', color:'var(--muted)', textTransform:'uppercase' }}>{l}</div>
                        </div>
                      ) : null)}
                    </div>
                    <Btn variant="ghost" size="sm" onClick={() => exportMemberImage(m)} style={{marginLeft:8,padding:'4px 10px',fontSize:'.72rem'}}>📸</Btn>
                  </div>

                  {/* Two columns: To Do + In Progress */}
                  {hasActive ? (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <TaskCol label="📋 To Do" color="#9090AA" tasks={todoTasks} allTasks={allTasks} today={today}/>
                      <TaskCol label="⚡ In Progress" color="#00D4FF" tasks={inProgressTasks} allTasks={allTasks} today={today}/>
                    </div>
                  ) : (
                    <div style={{ padding:'14px 18px', background:'rgba(0,229,160,.04)', border:'1px solid rgba(0,229,160,.15)', borderRadius:10, fontSize:'.82rem', color:'var(--green)' }}>
                      ✅ All tasks done for {m.name?.split(' ')[0]||'this member'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── MEMBERS CARDS VIEW ── */}
        {view === 'cards' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
            {members.map((m, i) => {
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
              const stats = memberStats(m.id);
              const isMe  = m.email === session?.user?.email;
              return (
                <Card key={m.id} hover onClick={() => setSelectedMem(selectedMem===m.id?null:m.id)}
                  style={{ position:'relative', border: selectedMem===m.id?`1px solid ${color}`:isMe?'1px solid rgba(124,92,252,.35)':undefined, cursor:'pointer', borderLeft:`4px solid ${color}` }}>
                  {isMe && <div style={{ position:'absolute', top:10, right:10, fontSize:'.62rem', fontWeight:700, background:'rgba(124,92,252,.15)', color:'var(--purple2)', padding:'2px 8px', borderRadius:20 }}>You</div>}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                    <Avatar name={m.name||m.email} image={m.image} size={48} color={color}/>
                    <div>
                      <div style={{ fontWeight:800, fontSize:'.92rem' }}>{m.name||m.email?.split('@')[0]}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:2 }}>{m.job_title||m.role}</div>
                      <div style={{ fontSize:'.78rem', color:'var(--yellow)', fontWeight:700 }}>🪙 {(m.coins||0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:10 }}>
                    {[['Done',stats.done,color],['On-Time',stats.pct+'%',stats.pct>=90?'var(--green)':'var(--yellow)'],['Overdue',stats.overdue,stats.overdue>0?'var(--red)':'var(--green)']].map(([l,v,c]) => (
                      <div key={l} style={{ background:'var(--surface3)', borderRadius:8, padding:'7px 8px', textAlign:'center' }}>
                        <div style={{ fontSize:'.88rem', fontWeight:800, color:c }}>{v}</div>
                        <div style={{ fontSize:'.6rem', color:'var(--muted)', marginTop:1 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10, fontSize:'.72rem', color:'var(--muted2)' }}>
                    <span>📋 {stats.total - stats.done} active</span>
                    <span>✅ {stats.done} done</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* When member selected in cards view — show their tasks below */}
        {view === 'cards' && selectedMem && (function() {
          const m     = members.find(m=>m.id===selectedMem);
          const color = MEMBER_COLORS[members.indexOf(m) % MEMBER_COLORS.length];
          const todo       = memberTasks(selectedMem, 'todo');
          const inProgress = memberTasks(selectedMem, 'inprogress');
          return (
            <div style={{ marginTop:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontWeight:800, fontSize:'1rem' }}>Tasks for {m?.name?.split(' ')[0]}</div>
                <Btn variant="ghost" size="sm" onClick={() => setSelectedMem(null)}>✕ Close</Btn>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <TaskCol label="📋 To Do" color="#9090AA" tasks={todo} allTasks={allTasks} today={today}/>
                <TaskCol label="⚡ In Progress" color="#00D4FF" tasks={inProgress} allTasks={allTasks} today={today}/>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Edit Profile Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Edit My Profile" width={420}>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:'.73rem', fontWeight:600, color:'var(--muted2)', marginBottom:10, letterSpacing:'.04em' }}>PROFILE PHOTO</div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:64, height:64, borderRadius:'50%', overflow:'hidden', background:'var(--surface3)', border:'3px solid var(--border2)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {form.image ? <img src={form.image} alt="profile" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.8rem', opacity:.4 }}>👤</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <label style={{ cursor:'pointer', padding:'7px 14px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, fontSize:'.8rem', color:'var(--text)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:7 }}>
                📷 {form.image ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 2*1024*1024) { toast.error('Max 2MB'); return; }
                  const reader = new FileReader();
                  reader.onload = ev => setForm(f => ({ ...f, image: ev.target.result }));
                  reader.readAsDataURL(file);
                }}/>
              </label>
              {form.image && <button onClick={() => setForm(f => ({ ...f, image: '' }))} style={{ padding:'6px 14px', background:'rgba(255,77,109,.1)', border:'1px solid rgba(255,77,109,.2)', borderRadius:9, fontSize:'.8rem', color:'var(--red)', fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>🗑 Remove</button>}
            </div>
          </div>
        </div>
        <Input label="Job Title" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Content Lead, Designer…"/>
        <div style={{ marginBottom:14, padding:'9px 12px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'.83rem', color:'var(--muted)' }}>{session?.user?.role || 'member'}</span>
          <span style={{ fontSize:'.7rem', color:'var(--muted)', background:'rgba(255,255,255,.06)', padding:'2px 8px', borderRadius:6 }}>🔒 set by admin</span>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => setModal(false)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={saveProfile} style={{ flex:2 }}>Save Profile</Btn>
        </div>
      </Modal>
    </Layout>
  );
}

// ── Task column component ──────────────────────────────────────
function TaskCol({ label, color, tasks, today }) {
  if (tasks.length === 0) {
    return (
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
        <div style={{ fontSize:'.72rem', fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label} (0)</div>
        <div style={{ fontSize:'.78rem', color:'var(--muted)', textAlign:'center', padding:'12px 0' }}>Nothing here</div>
      </div>
    );
  }

  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:'.75rem', fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</span>
        <span style={{ background:color+'22', color, fontSize:'.65rem', fontWeight:700, padding:'2px 8px', borderRadius:20 }}>{tasks.length}</span>
      </div>
      <div style={{ padding:'8px' }}>
        {tasks.map(t => {
          const overdue = t.deadline && t.status!=='done' && String(t.deadline).slice(0,10) < today;
          const postToday = t.post_date && String(t.post_date).slice(0,10) === today;
          return (
            <div key={t.id} style={{ padding:'7px 10px', background:'var(--surface3)', borderRadius:8, marginBottom:5, border:`1px solid ${overdue?'rgba(255,77,109,.35)':'var(--border)'}`, borderLeft:`3px solid ${color}` }}>
              <div style={{ fontWeight:600, fontSize:'.78rem', marginBottom:4, lineHeight:1.3 }}>{t.title}</div>
              <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                <Tag text={t.priority}/>
                {t.client_name && <span style={{ fontSize:'.67rem', color:'var(--muted)' }}>🏢 {t.client_name}</span>}
                {postToday && <span style={{ fontSize:'.63rem', background:'rgba(124,92,252,.15)', color:'var(--purple2)', padding:'1px 6px', borderRadius:4, fontWeight:600 }}>📤 Post today</span>}
                {t.post_date && <span style={{ fontSize:'.65rem', color:'var(--purple2)' }}>📤 {String(t.post_date).slice(0,10)}</span>}
                {t.deadline && <span style={{ fontSize:'.65rem', color: overdue?'var(--red)':'var(--muted)' }}>⏰ {String(t.deadline).slice(0,10)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
