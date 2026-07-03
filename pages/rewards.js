import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Spinner, EmptyState, Ring, ProgressBar, launchConfetti, toast, sounds } from '../components/UI';
import { v4 as uuid } from 'uuid';

async function fetchJSON(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined });
  return r.json();
}

export default function Rewards() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const [rewards,  setRewards]  = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({ name:'', emoji:'🎁', description:'', coin_cost:500, reward_type:'weekly' });
  const [confirm,  setConfirm]  = useState(null);

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => { if (status==='authenticated') loadAll(); }, [status]);

  async function loadAll() {
    const [r, t] = await Promise.all([fetchJSON('/api/rewards'), fetchJSON('/api/tasks')]);
    setRewards(Array.isArray(r) ? r : []);
    setTasks(Array.isArray(t) ? t : []);
    setLoading(false);
  }

  function openCreate() { setEditing(null); setForm({ name:'', emoji:'🎁', description:'', coin_cost:500, reward_type:'weekly' }); setModal(true); }
  function openEdit(r)  { setEditing(r); setForm({ name:r.name, emoji:r.emoji, description:r.description||'', coin_cost:r.coin_cost, reward_type:r.reward_type }); setModal(true); }

  async function save() {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (!form.emoji.trim()) { toast.error('Emoji required'); return; }
    if (editing) {
      const res = await fetchJSON('/api/rewards', 'PATCH', { id:editing.id, ...form });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Reward updated!');
    } else {
      const res = await fetchJSON('/api/rewards', 'POST', form);
      if (res.error) { toast.error(res.error); return; }
      toast.success('Reward added! 🎁'); sounds.pop();
    }
    setModal(false); setEditing(null); loadAll();
  }

  async function del(id) {
    const res = await fetchJSON('/api/rewards?id='+id, 'DELETE');
    if (res.error) { toast.error(res.error); return; }
    toast.info('Reward removed'); setConfirm(null); loadAll();
  }

  function celebrate(r) {
    const pct = tasks.length > 0 ? Math.round((tasks.filter(t=>t.status==='done').length / tasks.length) * 100) : 0;
    if (pct >= 100) { launchConfetti(); sounds.unlock(); toast.success(r.name + ' unlocked! 🎉'); }
    else toast.info('Complete all tasks to unlock this reward 🔒');
  }

  const done    = tasks.filter(t => t.status==='done').length;
  const total   = tasks.length;
  const pct     = total > 0 ? Math.round((done/total)*100) : 0;
  const weekly  = rewards.filter(r => r.reward_type==='weekly');
  const monthly = rewards.filter(r => r.reward_type==='monthly');
  const totalCoins = 0; // would come from members

  if (loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><Spinner size={28}/></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:4 }}>🎁 Rewards</h2>
            <p style={{ fontSize:'.82rem', color:'var(--muted2)' }}>{rewards.length} rewards · {pct}% tasks done this week</p>
          </div>
          {isAdmin && <Btn onClick={openCreate}>+ Add Reward</Btn>}
        </div>

        {/* Progress bar */}
        <Card style={{ background:'rgba(255,214,10,.04)', borderColor:'rgba(255,214,10,.2)', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--yellow)', marginBottom:6 }}>Weekly Progress</div>
              <div style={{ fontSize:'1rem', fontWeight:800, marginBottom:4 }}>{done} of {total} tasks done — {pct}%</div>
              <div style={{ fontSize:'.8rem', color:'var(--muted2)' }}>{pct >= 100 ? '🎉 All done! Unlock your reward!' : pct >= 50 ? '⚡ Over halfway there!' : '💪 Keep going!'}</div>
              <ProgressBar value={pct} color="var(--yellow)" style={{ marginTop:12 }}/>
            </div>
            <Ring value={pct} max={100} size={90} color="var(--yellow)" label={pct+'%'} sublabel="done"/>
          </div>
        </Card>

        {/* No rewards yet (admin prompt) */}
        {rewards.length === 0 && (
          <EmptyState
            emoji="🎁"
            title="No rewards yet"
            subtitle={isAdmin ? 'Add your first reward for the team.' : 'Your admin will add rewards soon.'}
            action={isAdmin ? <Btn onClick={openCreate}>+ Add First Reward</Btn> : null}
          />
        )}

        {/* Weekly rewards */}
        {weekly.length > 0 && (
          <>
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', color:'var(--muted)', marginBottom:14 }}>Weekly Rewards</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:14, marginBottom:24 }}>
              {weekly.map(r => {
                const unlocked = pct >= 100;
                return (
                  <div key={r.id}
                    style={{ background:unlocked?'rgba(0,229,160,.06)':'var(--surface2)', border:'1px solid '+(unlocked?'rgba(0,229,160,.3)':'var(--border)'), borderRadius:'var(--r)', padding:20, position:'relative', transition:'transform .18s,box-shadow .18s' }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                    {/* Admin controls */}
                    {isAdmin && (
                      <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:5 }} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>openEdit(r)} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:'.7rem', color:'var(--muted2)' }}>✏️</button>
                        <button onClick={()=>setConfirm(r)} style={{ background:'rgba(255,77,109,.1)', border:'1px solid rgba(255,77,109,.2)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:'.7rem', color:'var(--red)' }}>🗑</button>
                      </div>
                    )}
                    <div style={{ textAlign:'center', marginTop: isAdmin ? 24 : 0 }}>
                      <div style={{ fontSize:'2.4rem', marginBottom:8 }}>{r.emoji}</div>
                      <div style={{ fontWeight:800, fontSize:'.9rem', marginBottom:4 }}>{r.name}</div>
                      {r.description && <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:10, lineHeight:1.5 }}>{r.description}</div>}
                      <div style={{ fontSize:'.72rem', color:'var(--muted2)', marginBottom:12 }}>🪙 {(r.coin_cost||0).toLocaleString()} coins</div>
                      <button onClick={()=>celebrate(r)} style={{ width:'100%', padding:'8px', borderRadius:9, border:'none', background:unlocked?'var(--green)':'rgba(255,255,255,.06)', color:unlocked?'#000':'var(--muted2)', fontSize:'.78rem', fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .18s' }}>
                        {unlocked ? '🎉 Celebrate!' : '🔒 '+(pct)+'% / 100%'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Monthly rewards */}
        {monthly.length > 0 && (
          <>
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', color:'var(--muted)', marginBottom:14 }}>Monthly / Trip Goals</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {monthly.map(r => (
                <Card key={r.id} style={{ background:'linear-gradient(135deg,rgba(124,92,252,.1),rgba(0,212,255,.06))', borderColor:'rgba(124,92,252,.25)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                    <div style={{ fontSize:'2.5rem' }}>{r.emoji}</div>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ fontWeight:900, fontSize:'1.1rem', marginBottom:4 }}>{r.name}</div>
                      {r.description && <div style={{ fontSize:'.8rem', color:'var(--muted2)', marginBottom:10 }}>{r.description}</div>}
                      <ProgressBar value={done * 50} max={r.coin_cost||13000} color="var(--grad2)"/>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.72rem', color:'var(--muted2)', marginTop:5 }}>
                        <span>🪙 {Math.min(done*50, r.coin_cost||13000).toLocaleString()} earned</span>
                        <span>Goal: {(r.coin_cost||13000).toLocaleString()}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display:'flex', gap:8 }}>
                        <Btn variant="ghost" size="sm" onClick={()=>openEdit(r)}>✏️</Btn>
                        <Btn variant="danger" size="sm" onClick={()=>setConfirm(r)}>🗑</Btn>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal open={modal} onClose={()=>{setModal(false);setEditing(null);}} title={editing?'Edit Reward':'Add New Reward'} width={460}>
        <div style={{ display:'grid', gridTemplateColumns:'72px 1fr', gap:12 }}>
          <Input label="Emoji" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="🎁"/>
          <Input label="Reward Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Team Lunch"/>
        </div>
        <Input label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What is this reward about?"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Coin Cost 🪙" type="number" min="0" step="50" value={form.coin_cost} onChange={e=>setForm(f=>({...f,coin_cost:parseInt(e.target.value)||0}))}/>
          <Select label="Type" value={form.reward_type} onChange={e=>setForm(f=>({...f,reward_type:e.target.value}))}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly / Trip</option>
          </Select>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={()=>{setModal(false);setEditing(null);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} style={{flex:2}}>{editing?'Save Changes':'Add Reward'}</Btn>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirm} onClose={()=>setConfirm(null)} title="Remove Reward?" width={360}>
        {confirm && <>
          <div style={{ textAlign:'center', padding:'12px 0 20px' }}>
            <div style={{ fontSize:'3rem', marginBottom:8 }}>{confirm.emoji}</div>
            <div style={{ fontWeight:700, marginBottom:4 }}>{confirm.name}</div>
            <div style={{ fontSize:'.8rem', color:'var(--muted2)' }}>This will permanently remove this reward.</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn variant="ghost" onClick={()=>setConfirm(null)} style={{flex:1}}>Cancel</Btn>
            <Btn variant="danger" onClick={()=>del(confirm.id)} style={{flex:1}}>Remove</Btn>
          </div>
        </>}
      </Modal>
    </Layout>
  );
}
