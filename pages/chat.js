import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  // Check if Google session cookie exists by pinging a Google endpoint
  useEffect(() => {
    // We open a hidden iframe to test if Google session is active
    const test = document.createElement('iframe');
    test.src = 'https://accounts.google.com/CheckCookie?continue=https://www.google.com&followup=https://www.google.com&chtml=LoginDoneHtml';
    test.style.display = 'none';
    test.onload = () => {
      // If they have a Google session, assume signed in
      setGoogleSignedIn(true);
      setCheckingAuth(false);
    };
    test.onerror = () => {
      setGoogleSignedIn(false);
      setCheckingAuth(false);
    };
    // Fallback — stop checking after 3s
    setTimeout(() => setCheckingAuth(false), 3000);
    document.body.appendChild(test);
    return () => { try { document.body.removeChild(test); } catch(e) {} };
  }, []);

  function openGoogleSignIn() {
    // Open Google sign-in in a popup window
    const w = window.open(
      'https://accounts.google.com/signin/v2/identifier?continue=https://chat.google.com&hl=en',
      'google-signin',
      'width=500,height=600,left=400,top=100,toolbar=no,menubar=no'
    );
    // Watch for popup to close, then show chat
    const timer = setInterval(() => {
      if (w && w.closed) {
        clearInterval(timer);
        setGoogleSignedIn(true);
        // Reload iframe
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.src;
        }
      }
    }, 500);
  }

  if (status === 'loading' || status === 'unauthenticated') return null;

  return (
    <Layout noPadding>
      <div style={{ display:'flex', flexDirection:'column', height:'calc(100dvh - 60px)', overflow:'hidden' }}>

        {/* Header bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img
              src="https://www.gstatic.com/images/branding/product/2x/chat_2023_48dp.png"
              width={24} height={24} alt="Google Chat"
              style={{ borderRadius:4 }}
              onError={e => { e.target.style.display='none'; }}
            />
            <span style={{ fontWeight:800, fontSize:'.92rem' }}>Google Chat</span>
            {googleSignedIn && (
              <span style={{ fontSize:'.65rem', background:'rgba(0,172,71,.15)', color:'#00AC47', padding:'2px 9px', borderRadius:20, fontWeight:700 }}>
                ● Connected
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {!googleSignedIn && !checkingAuth && (
              <button onClick={openGoogleSignIn}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:'pointer', fontFamily:'Google Sans, Arial, sans-serif', fontSize:'.82rem', fontWeight:600, color:'#3c4043' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={16} height={16} alt="Google"/>
                Sign in with Google
              </button>
            )}
            {googleSignedIn && (
              <button onClick={openGoogleSignIn}
                style={{ padding:'5px 12px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--muted2)', fontSize:'.75rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                Switch account
              </button>
            )}
            <a href="https://chat.google.com" target="_blank" rel="noopener noreferrer"
              style={{ padding:'5px 12px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--muted2)', fontSize:'.75rem', fontWeight:600, textDecoration:'none', fontFamily:'inherit' }}>
              ↗ Full screen
            </a>
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

          {/* Not signed in */}
          {!checkingAuth && !googleSignedIn && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, padding:32, textAlign:'center', zIndex:10, background:'var(--surface)' }}>
              <img src="https://www.gstatic.com/images/branding/product/2x/chat_2023_48dp.png"
                width={64} height={64} style={{ borderRadius:16 }}
                onError={e=>e.target.style.display='none'}/>
              <div>
                <div style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:8 }}>Sign in to Google Chat</div>
                <div style={{ fontSize:'.88rem', color:'var(--muted2)', lineHeight:1.7, maxWidth:380 }}>
                  Sign in with your Google account to access all your Spaces — Fattoush SM Marketing, BeWAXed, Sewaro Craft Salon, Scale Up and more.
                </div>
              </div>

              <button onClick={openGoogleSignIn}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 28px', background:'#fff', border:'2px solid #dadce0', borderRadius:12, cursor:'pointer', fontFamily:'Google Sans, Arial, sans-serif', fontSize:'.95rem', fontWeight:600, color:'#3c4043', boxShadow:'0 2px 8px rgba(0,0,0,.12)' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={22} height={22} alt="Google"/>
                Sign in with Google
              </button>

              {/* Spaces preview */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', maxWidth:520 }}>
                {['Fattoush SM Marketing','BeWAXed','Sewaro Craft Salon','Tip & Toe – Chennai','Scale Up','Sagar Rehab'].map((name, i) => {
                  const colors = ['#00AC47','#EA4335','#9C27B0','#FF6D00','#1A73E8','#FBBC04'];
                  return (
                    <div key={name} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:20 }}>
                      <div style={{ width:18, height:18, borderRadius:5, background:colors[i%colors.length], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'.6rem', fontWeight:800 }}>
                        {name[0]}
                      </div>
                      <span style={{ fontSize:'.75rem', color:'var(--muted2)', fontWeight:500 }}>{name}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6, maxWidth:360, marginTop:-8 }}>
                A popup will open to sign you in to Google. Once done, Google Chat loads right here inside Your Socials OS.
              </div>
            </div>
          )}

          {/* Loading */}
          {checkingAuth && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:12, color:'var(--muted2)', fontSize:'.88rem', background:'var(--surface)', zIndex:10 }}>
              <span style={{ fontSize:'1.5rem', animation:'spin 1s linear infinite' }}>⟳</span>
              Checking Google session…
            </div>
          )}

          {/* Google Chat iframe — always rendered, hidden until signed in */}
          <iframe
            ref={iframeRef}
            src="https://chat.google.com"
            style={{ width:'100%', height:'100%', border:'none', display: googleSignedIn ? 'block' : 'none' }}
            allow="camera; microphone; clipboard-read; clipboard-write; notifications; autoplay"
            title="Google Chat"
            onLoad={() => {
              if (!checkingAuth) setGoogleSignedIn(true);
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </Layout>
  );
}
