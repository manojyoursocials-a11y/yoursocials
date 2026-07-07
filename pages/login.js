import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Login() {
  const { status } = useSession();
  const router     = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status]);

  async function handleSubmit(e) {
    e.preventDefault();
    const emailVal = email.trim().toLowerCase();
    if (!emailVal || !password) {
      setError('Please enter your email/phone and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email:    emailVal,
        password: password,
        redirect: false,
        callbackUrl: '/',
      });
      if (result?.ok && !result?.error) {
        // Force hard navigation — Safari sometimes won't update with router.replace
        window.location.href = result.url || '/';
      } else {
        setError('Incorrect email/phone or password. Please try again.');
        setLoading(false);
      }
    } catch(err) {
      setError('Connection error. Please check your internet and try again.');
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    background: '#1C1C28',
    border: '1.5px solid rgba(255,255,255,.15)',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: '16px',          // prevents iOS zoom-in on focus
    color: '#F0EFFF',
    fontFamily: 'Inter, -apple-system, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',  // removes iOS default styling
    appearance: 'none',
    transition: 'border-color .2s',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#09090F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', fontFamily: 'Inter, -apple-system, sans-serif', WebkitTextSizeAdjust: '100%' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/logo.png" alt="Your Socials" style={{ height: 52, objectFit: 'contain', marginBottom: 24 }}/>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F0EFFF', margin: '0 0 8px' }}>Welcome back</h1>
          <p style={{ fontSize: '.87rem', color: '#9090AA', lineHeight: 1.5, margin: 0 }}>Sign in to Your Socials OS</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Email / Phone */}
          <div>
            <label style={{ fontSize: '.72rem', fontWeight: 700, color: '#9090AA', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
              Email or Phone
            </label>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yoursocials.in"
              required
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              style={inputStyle}
              onFocus={e  => e.target.style.borderColor = '#7C5CFC'}
              onBlur={e   => e.target.style.borderColor = 'rgba(255,255,255,.15)'}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: '.72rem', fontWeight: 700, color: '#9090AA', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                autoCorrect="off"
                autoCapitalize="none"
                style={{ ...inputStyle, paddingRight: 48 }}
                onFocus={e  => e.target.style.borderColor = '#7C5CFC'}
                onBlur={e   => e.target.style.borderColor = 'rgba(255,255,255,.15)'}
              />
              {/* Show/hide password — important for iPhone users */}
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6B6B8A', cursor: 'pointer', fontSize: '1rem', padding: 4, lineHeight: 1 }}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(255,77,109,.1)', border: '1px solid rgba(255,77,109,.3)', borderRadius: 10, padding: '11px 14px', fontSize: '.82rem', color: '#FF4D6D', lineHeight: 1.5 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '15px', background: loading ? 'rgba(124,92,252,.5)' : 'linear-gradient(135deg,#7C5CFC,#FF5FA0)', border: 'none', borderRadius: 14, color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4, WebkitAppearance: 'none', appearance: 'none', transition: 'opacity .2s', minHeight: 52 }}
          >
            {loading ? '⏳ Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '.76rem', color: '#6B6B8A', marginTop: 28, lineHeight: 1.6 }}>
          Contact your admin if you need access
        </p>
      </div>
    </div>
  );
}
