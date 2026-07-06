import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Avatar, ProgressBar, Spinner, api, MEMBER_COLORS } from '../components/UI';

export default function Leaderboard() {
  const {status} = useSession();
  const router = useRouter();
  useEffect(()=>{if(status==='unauthenticated')router.replace('/login');},[status]);
  const [members,setMembers] = useState([]);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{if(status==='authenticated')api('/api/members').then(d=>{setMembers(Array.isArray(d)?d:[]);setLoading(false);});},[status]);
  if(loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><Spinner size={28}/></div></Layout>;
  const maxCoins = members[0]?.coins||1;
  const RANKS = ['🥇','🥈','🥉'];
  return (
    <Layout>
      <div className="fade-up">
        <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:6}}>Leaderboard 🏆</h2>
        <p style={{fontSize:'.82rem',color:'var(--muted2)',marginBottom:24}}>Ranked by coins earned</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}}>
          <Card>
            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:16}}>All Members</div>
            {members.length===0&&<div style={{color:'var(--muted)',fontSize:'.82rem'}}>No members yet.</div>}
            {members.map((m,i)=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,marginBottom:4,background:i===0?'rgba(255,214,10,.06)':'transparent',border:i===0?'1px solid rgba(255,214,10,.12)':'1px solid transparent'}}>
                <div style={{width:28,textAlign:'center',fontSize:i<3?'1.1rem':'.85rem',fontWeight:700,color:i===0?'var(--yellow)':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--muted)'}}>{i<3?RANKS[i]:i+1}</div>
                <Avatar name={m.name||m.email} image={m.image} size={34} color={MEMBER_COLORS[i%MEMBER_COLORS.length]}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'.84rem',fontWeight:700}}>{m.name||m.email?.split('@')[0]}</div>
                  <div style={{fontSize:'.68rem',color:'var(--muted)'}}>{m.job_title||m.role} · {m.done_tasks||0} tasks done</div>
                </div>
                <div style={{flex:1,padding:'0 12px'}}><ProgressBar value={m.coins||0} max={maxCoins} color={i===0?'var(--yellow)':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--purple)'} height={5}/></div>
                <div style={{fontWeight:900,fontSize:'.9rem',color:'var(--purple2)',whiteSpace:'nowrap'}}>🪙 {(m.coins||0).toLocaleString()}</div>
              </div>
            ))}
          </Card>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {members[0]&&<Card style={{textAlign:'center',background:'rgba(255,214,10,.04)',borderColor:'rgba(255,214,10,.2)'}}>
              <div style={{fontSize:'2rem',marginBottom:8}}>👑</div>
              <div style={{fontWeight:900,fontSize:'1rem',marginBottom:3}}>{members[0].name||members[0].email?.split('@')[0]}</div>
              <div style={{fontSize:'.75rem',color:'var(--muted2)',marginBottom:8}}>{members[0].job_title||members[0].role}</div>
              <div style={{fontSize:'.8rem',color:'var(--yellow)',fontWeight:700}}>🔥 {members[0].streak||0} day streak</div>
              <div style={{fontSize:'.75rem',color:'var(--green)',marginTop:4}}>✅ {members[0].done_tasks||0} tasks done</div>
            </Card>}
            <Card>
              <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:10}}>How to earn coins</div>
              {[['✅ Task created','+10 🪙'],['🏁 Task done','+50 🪙'],['📩 Follow-up sent','+30 🪙']].map(([a,v])=>(
                <div key={a} style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',color:'var(--muted2)',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                  <span>{a}</span><span style={{fontWeight:700,color:'var(--yellow)'}}>{v}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
