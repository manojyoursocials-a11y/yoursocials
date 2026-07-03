import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Ring, ProgressBar, Spinner, launchConfetti, toast, sounds, api } from '../components/UI';

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
  const [delConfirm, setDelConfirm] = useState(null);

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (status==='authenticated') fetchAll();
  }, [status]);

  async function fetchAll() {
    const [r, t] = await Promise.all([api('/api/rewards'), api('/api/tasks')]);
    setRewards(Array.isArray(r)?r:[]);
    setTasks(Array.isArray(t)?t:[]);
    setLoading(false);
  }

  function openCreate() { setEditing(null); setForm({name:'',emoji:'🎁',description:'',coin_cost:500,reward_type:'weekly'}); setModal(true); }
  function openEdit(r)  { setEditing(r); setForm({name:r.name,emoji:r.emoji,description:r.description||'',coin_cost:r.coin_cost,reward_type:r.reward_type}); setModal(true); }

  async function saveReward() {
    if (!form.name||!form.emoji) { toast.error('Name and emoji required'); return; }
    if (editing) {
      await api('/api/rewards','PATCH',{id:editing.id,...form});
      toast.success('Reward updated!');
    } else {
      await api('/api/rewards','POST',form);
      toast.success('Reward added! 🎁');
      sounds.pop();
    }
    setModal(false); setEditing(null); fetchAll();
  }

  async function deleteReward(id) {
    await api('/api/rewards?id='+id,'DELETE');
    toast.info('Reward removed'); setDelConfirm(null); fetchAll();
  }

  const done    = tasks.filter(t=>t.status==='done').length;
  const total   = tasks.length;
  const pct     = total>0?Math.round((done/total)*100):0;
  const weekly  = rewards.filter(r=>r.reward_type==='weekly');
  const trip    = rewards.find(r=>r.reward_type==='monthly');

  function celebrate(r) {
    if (pct>=100||r.status==='unlocked') { launchConfetti(); sounds.unlock(); toast.success(r.name+' — Let\'s go team! 🎉','🎉'); }
    else toast.info('Complete all tasks this week to unlock!','🔒');
  }

  if (loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}><Spinner size={28}/></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <h2 style={{fontWeight:900,fontSize:'1.3rem'}}>Rewards</h2>
          {isAdmin&&<Btn onClick={openCreate}>+ Add Reward</Btn>}
        </div>

        {/* Status bar */}
        <Card style={{background:'rgba(255,214,10,.04)',borderColor:'rgba(255,214,10,.15)',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
            <div>
              <div style={{fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--yellow)',marginBottom:6}}>Weekly Reward Status</div>
              <div style={{fontSize:'.95rem',fontWeight:800,marginBottom:4}}>Team completion: {pct}%</div>
              <div style={{fontSize:'.8rem',color:'var(--muted2)'}}>{done} of {total} tasks done · {pct>=100?'🎉 Unlock your reward!':'Keep going!'}</div>
            </div>
            <Ring value={pct} max={100} size={90} color="var(--yellow)" label={pct+'%'} sublabel="done"/>
          </div>
          <ProgressBar value={pct} color="var(--yellow)" style={{marginTop:14}}/>
        </Card>

        {/* Monthly trip */}
        {trip&&(
          <Card style={{background:'linear-gradient(135deg,rgba(124,92,252,.12),rgba(0,212,255,.07))',borderColor:'rgba(124,92,252,.25)',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:16,flex:1}}>
                <div style={{fontSize:'2.5rem'}}>{trip.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--purple2)',marginBottom:4}}>Monthly Trip Challenge ✈️</div>
                  <div style={{fontWeight:900,fontSize:'1.1rem',marginBottom:4}}>{trip.name}</div>
                  <div style={{fontSize:'.8rem',color:'var(--muted2)',marginBottom:10}}>{trip.description}</div>
                  <ProgressBar value={done*50} max={trip.coin_cost||13000} color="var(--grad2)"/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'.72rem',color:'var(--muted2)',marginTop:5}}>
                    <span>🪙 {Math.min(done*50,trip.coin_cost||13000).toLocaleString()}</span>
                    <span>Goal: 🪙{(trip.coin_cost||13000).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {isAdmin&&(
                <div style={{display:'flex',gap:6,flexDirection:'column'}}>
                  <Btn variant="ghost" size="sm" onClick={()=>openEdit(trip)}>✏️ Edit</Btn>
                  <Btn variant="danger" size="sm" onClick={()=>setDelConfirm(trip)}>🗑</Btn>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Weekly rewards grid */}
        <div style={{fontSize:'.68rem',fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--muted)',marginBottom:14}}>This Week&apos;s Options</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>
          {weekly.map(r=>{
            const unlocked=pct>=100||r.status==='unlocked';
            return (
              <div key={r.id} style={{background:unlocked?'rgba(0,229,160,.06)':'var(--surface2)',border:'1px solid '+(unlocked?'rgba(0,229,160,.3)':'var(--border)'),borderRadius:'var(--r)',padding:20,textAlign:'center',cursor:'pointer',transition:'all .2s',position:'relative',opacity:unlocked?1:.65}}
                onClick={()=>celebrate(r)}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                {isAdmin&&(
                  <div style={{position:'absolute',top:8,left:8,display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>openEdit(r)} style={{background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:'.7rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✏️</button>
                    <button onClick={()=>setDelConfirm(r)} style={{background:'rgba(255,77,109,.1)',border:'1px solid rgba(255,77,109,.2)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:'.7rem',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--red)'}}>🗑</button>
                  </div>
                )}
                <div style={{position:'absolute',top:10,right:12,fontSize:'.8rem'}}>{unlocked?'🔓':'🔒'}</div>
                <div style={{fontSize:'2.2rem',marginBottom:8,marginTop:isAdmin?8:0}}>{r.emoji}</div>
                <div style={{fontWeight:700,fontSize:'.85rem',marginBottom:4}}>{r.name}</div>
                <div style={{fontSize:'.7rem',color:'var(--muted)',marginBottom:8}}>{r.description}</div>
                <div style={{fontSize:'.7rem',color:'var(--muted2)'}}>🪙 {(r.coin_cost||0).toLocaleString()}</div>
                <div style={{fontSize:'.72rem',fontWeight:600,color:unlocked?'var(--green)':'var(--muted2)',marginTop:6}}>{unlocked?'🎉 Tap to celebrate!':'Complete all tasks'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal open={modal} onClose={()=>{setModal(false);setEditing(null);}} title={editing?'Edit Reward':'Add New Reward'} width={440}>
        <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:12}}>
          <Input label="Emoji" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="🎁"/>
          <Input label="Reward Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Team Lunch"/>
        </div>
        <Input label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What is this reward?"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Coin Cost 🪙" type="number" min="0" value={form.coin_cost} onChange={e=>setForm(f=>({...f,coin_cost:parseInt(e.target.value)||0}))}/>
          <Select label="Type" value={form.reward_type} onChange={e=>setForm(f=>({...f,reward_type:e.target.value}))}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly Trip</option>
          </Select>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setModal(false);setEditing(null);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={saveReward} style={{flex:2}}>{editing?'Save Changes':'Add Reward'}</Btn>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Remove Reward" width={380}>
        {delConfirm&&<>
          <div style={{textAlign:'center',padding:'12px 0 20px'}}>
            <div style={{fontSize:'3rem',marginBottom:8}}>{delConfirm.emoji}</div>
            <div style={{fontWeight:700,marginBottom:6}}>{delConfirm.name}</div>
            <div style={{fontSize:'.8rem',color:'var(--muted2)'}}>This reward will be permanently removed.</div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <Btn variant="ghost" onClick={()=>setDelConfirm(null)} style={{flex:1}}>Cancel</Btn>
            <Btn variant="danger" onClick={()=>deleteReward(delConfirm.id)} style={{flex:1}}>Remove</Btn>
          </div>
        </>}
      </Modal>
    </Layout>
  );
}
