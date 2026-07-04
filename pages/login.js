import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Login() {
  const { data: session } = useSession();
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { if (session) router.replace('/'); }, [session]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) { setError('Incorrect email or password.'); setLoading(false); }
    else router.replace('/');
  }

  const iStyle = { width:'100%', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.13)', borderRadius:10, padding:'11px 14px', fontSize:'.88rem', color:'#F0EFFF', fontFamily:'Inter,sans-serif', outline:'none', transition:'border .18s', marginBottom:12 };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#09090F', padding:16 }}>
      <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)', width:600, height:300, background:'radial-gradient(ellipse,rgba(124,92,252,.2) 0%,transparent 70%)', pointerEvents:'none', filter:'blur(40px)' }} />
      <div className="scale-in" style={{ background:'#16161F', border:'1px solid rgba(255,255,255,.1)', borderRadius:24, padding:'40px 36px', width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', margin:'0 auto 16px' }}>⚡</div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:900, color:'#F0EFFF', marginBottom:6 }}>Your Socials OS</h1>
          <p style={{ fontSize:'.82rem', color:'#9090AA', lineHeight:1.5 }}>Sign in with your team credentials</p>
        </div>

        {error && (
          <div style={{ background:'rgba(255,77,109,.1)', border:'1px solid rgba(255,77,109,.3)', borderRadius:10, padding:'10px 14px', fontSize:'.8rem', color:'#FF4D6D', marginBottom:16, textAlign:'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ fontSize:'.72rem', fontWeight:600, color:'#9090AA', marginBottom:5, letterSpacing:'.04em' }}>Email or Phone</div>
          <input type="text" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@yoursocials.in or +91 98765 43210" required style={iStyle} onFocus={e=>e.target.style.borderColor='#7C5CFC'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.13)'} />
          <div style={{ fontSize:'.72rem', fontWeight:600, color:'#9090AA', marginBottom:5, letterSpacing:'.04em' }}>Password</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={iStyle} onFocus={e=>e.target.style.borderColor='#7C5CFC'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.13)'} />
          <button type="submit" disabled={loading} style={{ width:'100%', padding:'12px', background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)', border:'none', borderRadius:10, fontSize:'.9rem', fontWeight:700, color:'#fff', cursor:loading?'not-allowed':'pointer', marginTop:4, opacity:loading?.7:1, fontFamily:'Inter,sans-serif', transition:'opacity .18s' }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div style={{ marginTop:20, padding:'14px', background:'rgba(124,92,252,.08)', border:'1px solid rgba(124,92,252,.2)', borderRadius:10, fontSize:'.75rem', color:'#9090AA', textAlign:'center', lineHeight:1.6 }}>
          🔐 Accounts are created by your admin.<br/>Contact your team lead if you need access.
        </div>
      </div>
    </div>
  );
}
