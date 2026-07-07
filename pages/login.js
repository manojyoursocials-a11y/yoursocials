import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const iStyle = { width:'100%', background:'#1C1C28', border:'1px solid rgba(255,255,255,.13)', borderRadius:12, padding:'12px 16px', fontSize:'16px', color:'#F0EFFF', fontFamily:'Inter,sans-serif', outline:'none', boxSizing:'border-box', transition:'border-color .2s' };

export default function Login() {
  const { status } = useSession();
  const router     = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { if (status === 'authenticated') router.replace('/'); }, [status]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Please enter your email/phone and password.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { email: email.trim(), password, redirect: false });
      if (result?.error) {
        setError('Incorrect credentials. Please check your email/phone and password.');
      } else if (result?.ok) {
        router.replace('/');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch(e) {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#09090F', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <img src="/logo.png" alt="Your Socials" style={{ height:48, objectFit:'contain', marginBottom:20 }}/>
          <h1 style={{ fontSize:'1.4rem', fontWeight:900, color:'#F0EFFF', marginBottom:8 }}>Welcome back</h1>
          <p style={{ fontSize:'.85rem', color:'#9090AA', lineHeight:1.5 }}>Sign in with your team credentials</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:'.75rem', fontWeight:600, color:'#9090AA', letterSpacing:'.04em', display:'block', marginBottom:6 }}>EMAIL OR PHONE</label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yoursocials.in or +91 98765"
              required
              autoComplete="username"
              style={iStyle}
              onFocus={e => e.target.style.borderColor='#7C5CFC'}
              onBlur={e => e.target.style.borderColor='rgba(255,255,255,.13)'}
            />
          </div>

          <div>
            <label style={{ fontSize:'.75rem', fontWeight:600, color:'#9090AA', letterSpacing:'.04em', display:'block', marginBottom:6 }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={iStyle}
              onFocus={e => e.target.style.borderColor='#7C5CFC'}
              onBlur={e => e.target.style.borderColor='rgba(255,255,255,.13)'}
            />
          </div>

          {error && (
            <div style={{ background:'rgba(255,77,109,.1)', border:'1px solid rgba(255,77,109,.3)', borderRadius:10, padding:'10px 14px', fontSize:'.8rem', color:'#FF4D6D', lineHeight:1.5 }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13px', background: loading ? 'rgba(124,92,252,.5)' : 'linear-gradient(135deg,#7C5CFC,#FF5FA0)', border:'none', borderRadius:12, color:'#fff', fontSize:'.95rem', fontWeight:700, cursor: loading ? 'wait' : 'pointer', fontFamily:'Inter,sans-serif', marginTop:4, transition:'opacity .2s' }}>
            {loading ? '⏳ Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:'.75rem', color:'#6B6B8A', marginTop:24 }}>
          Contact your admin if you need access
        </p>
      </div>
    </div>
  );
}
