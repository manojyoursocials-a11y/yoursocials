import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Login() {
  const { data:session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ if(session) router.replace('/'); },[session]);

  async function handleGoogle() {
    setLoading(true);
    await signIn('google', { callbackUrl:'/' });
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:16 }}>
      <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)', width:600, height:300, background:'radial-gradient(ellipse,rgba(124,92,252,.18) 0%,transparent 70%)', pointerEvents:'none', filter:'blur(40px)' }}/>
      <div className="scale-in" style={{ background:'var(--surface2)', border:'1px solid rgba(255,255,255,.13)', borderRadius:'var(--r-lg)', padding:'40px 36px', width:'100%', maxWidth:400, textAlign:'center', position:'relative', zIndex:1 }}>
        <div style={{ width:60, height:60, borderRadius:18, background:'var(--grad1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem', margin:'0 auto 20px' }}>⚡</div>
        <h1 style={{ fontSize:'1.6rem', fontWeight:900, marginBottom:8 }}>Your Socials OS</h1>
        <p style={{ fontSize:'.85rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:32 }}>The AI-powered operating system for creative teams that move fast and celebrate hard.</p>
        <button onClick={handleGoogle} disabled={loading} style={{ width:'100%', padding:'13px 20px', background:'var(--surface3)', border:'1px solid rgba(255,255,255,.13)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontSize:'.9rem', fontWeight:600, color:'var(--text)', cursor:loading?'not-allowed':'pointer', fontFamily:'Inter,sans-serif', transition:'all .18s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';e.currentTarget.style.background='rgba(124,92,252,.08)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.13)';e.currentTarget.style.background='var(--surface3)';}}
        >
          {loading
            ? <div style={{ width:20,height:20,borderRadius:'50%',border:'2px solid rgba(255,255,255,.2)',borderTopColor:'var(--purple)',animation:'spin .8s linear infinite' }}/>
            : <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
        <div style={{ display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center', marginTop:24 }}>
          {['🔥 Streaks','🤖 AI Manager','🏆 Rewards','✈️ Trip Goal'].map(f=><span key={f} style={{ fontSize:'.7rem', color:'var(--muted)' }}>{f}</span>)}
        </div>
      </div>
    </div>
  );
}
