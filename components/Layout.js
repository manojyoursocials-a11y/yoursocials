import React, { useState, useEffect } from 'react';
import NotificationBell from './NotificationBell';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, ToastContainer } from './UI';

const NAV = [
  { path:'/',            icon:'🏠', label:'Dashboard' },
  { path:'/tasks',       icon:'✅', label:'Tasks',      badge:'tasks' },
  { path:'/calendar',    icon:'📅', label:'Calendar' },
  { section:'Team' },
  { path:'/team',        icon:'👥', label:'Members' },
  { path:'/leaderboard', icon:'🏆', label:'Leaderboard' },
  { path:'/rewards',     icon:'🎁', label:'Rewards' },
  { section:'Work' },
  { path:'/clients',     icon:'🏢', label:'Clients' },
  { path:'/followups',   icon:'📩', label:'Follow-ups', badge:'followups' },
  { path:'/analytics',   icon:'📊', label:'Analytics' },

];

// Live coins — polls /api/me every 8s so coins update without re-login
// Quick notify-all function
async function sendTestToAll() {
  try {
    const r = await fetch('/api/test-notif', { method: 'POST' });
    const d = await r.json();
    if (d.ok) alert('✅ Test notification sent to all ' + d.sent_to + ' members! They should hear sound + see popup within 4 seconds.');
    else alert('❌ Error: ' + (d.error || 'Unknown'));
  } catch(e) { alert('❌ ' + e.message); }
}

function useLiveCoins(sessionCoins) {
  const [coins, setCoins] = useState(sessionCoins || 0);
  useEffect(() => {
    let mounted = true;
    async function fetchCoins() {
      try {
        const r = await fetch('/api/me');
        if (!r.ok) return;
        const d = await r.json();
        if (mounted && d.coins !== undefined) setCoins(d.coins);
      } catch(e) {}
    }
    fetchCoins();
    const t = setInterval(fetchCoins, 8000);
    return () => { mounted = false; clearInterval(t); };
  }, []);
  return coins;
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const date = now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
  const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
  return (
    <div style={{ textAlign:'right', lineHeight:1.3 }}>
      <div style={{ fontSize:'.75rem', color:'var(--muted2)', fontWeight:500 }}>{date}</div>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', fontFamily:'monospace' }}>{time}</div>
    </div>
  );
}

export default function Layout({ children, badges = {} }) {
  const router   = useRouter();
  const { data: session } = useSession();
  const isAdmin  = session?.user?.role === 'admin';
  const [open,   setOpen]   = useState(false); // mobile menu open
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [router.pathname]);

  const allNav = [
    ...NAV,
    ...(isAdmin ? [{ section:'Admin' }, { path:'/admin', icon:'⚙️', label:'Manage Users' }, { path:'/finance', icon:'💰', label:'Finance' }] : []),
  ];

  function NavItem({ item, i }) {
    if (item.section) {
      return (
        <div style={{ fontSize:'.62rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', padding:'14px 12px 5px' }}>
          {item.section}
        </div>
      );
    }
    const active = router.pathname === item.path;
    const count  = item.badge ? (badges[item.badge] || 0) : 0;
    return (
      <div
        onClick={() => { router.push(item.path); setOpen(false); }}
        style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px', borderRadius:10, cursor:'pointer', fontSize:'.85rem', fontWeight:500, color:active?'var(--purple2)':'var(--muted2)', background:active?'rgba(124,92,252,.14)':'transparent', borderLeft:`3px solid ${active?'var(--purple)':'transparent'}`, transition:'all .15s' }}
        onMouseEnter={e => !active && (e.currentTarget.style.background='var(--surface2)')}
        onMouseLeave={e => !active && (e.currentTarget.style.background='transparent')}
      >
        <span style={{ fontSize:'1.1rem', width:22, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
        <span style={{ flex:1 }}>{item.label}</span>
        {count > 0 && (
          <span style={{ background:'var(--purple)', color:'#fff', fontSize:'.62rem', fontWeight:700, padding:'2px 7px', borderRadius:20, marginLeft:'auto' }}>{count}</span>
        )}
      </div>
    );
  }

  const sidebarContent = (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Logo */}
      <div style={{ padding:'16px 14px 14px', borderBottom:'1px solid var(--border)', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo.png" alt="Your Socials" style={{ height:44, width:'auto', maxWidth:170, objectFit:'contain' }}/>
        {mobile && (
          <button onClick={() => setOpen(false)} style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--muted)', fontSize:'1rem', flexShrink:0 }}>✕</button>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 8px', paddingBottom:8 }}>
        {allNav.map((item, i) => <NavItem key={item.path||item.section+i} item={item} i={i}/>)}
      </div>

      {/* User footer */}
      <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <Avatar name={session?.user?.name || 'You'} size={34} color="#7C5CFC"/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'.8rem', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{session?.user?.name || 'You'}</div>
          <div style={{ fontSize:'.68rem', color:'var(--muted)' }}>{session?.user?.role || 'member'}</div>
        </div>
        <button onClick={() => signOut({ callbackUrl:'/login' })} title="Sign out" style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'1.2rem', padding:4, flexShrink:0 }}>↩</button>
      </div>
    </div>
  );

  const liveCoins = useLiveCoins(session?.user?.coins || 0);

  return (
    <div style={{ display:'flex', height:'100dvh', overflow:'hidden', position:'relative' }}>

      {/* ── DESKTOP SIDEBAR ───────────────────────── */}
      {!mobile && (
        <aside style={{ width:210, minWidth:210, background:'var(--surface)', borderRight:'1px solid var(--border)', overflow:'hidden', flexShrink:0 }}>
          {sidebarContent}
        </aside>
      )}

      {/* ── MOBILE DRAWER OVERLAY ─────────────────── */}
      {mobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:200, backdropFilter:'blur(4px)' }}
        />
      )}
      {mobile && (
        <aside style={{ position:'fixed', top:0, left:0, bottom:0, width:240, background:'var(--surface)', borderRight:'1px solid var(--border)', zIndex:201, transform:open?'translateX(0)':'translateX(-100%)', transition:'transform .28s cubic-bezier(.4,0,.2,1)', overflow:'hidden' }}>
          {sidebarContent}
        </aside>
      )}

      {/* ── MAIN CONTENT ──────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Top bar */}
        <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 16px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* Hamburger on mobile */}
            {mobile && (
              <button onClick={() => setOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--text)', fontSize:'1.4rem', display:'flex', alignItems:'center', lineHeight:1 }}>☰</button>
            )}
            <span className="live-dot"/>
            <span style={{ fontSize:'.75rem', color:'var(--muted)', fontWeight:500 }}>Live</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <span style={{ color:'var(--yellow)', fontWeight:700, fontSize:'.82rem' }}>🪙 {liveCoins.toLocaleString()}</span>
            <span style={{ fontSize:'.75rem', color:'var(--muted2)' }}>
  <LiveClock />
            </span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex:1, overflow:'auto', padding: mobile ? '16px 14px 24px' : '24px 28px 40px' }}>
          {children}
        </div>
      </div>

      <ToastContainer/>
    </div>
  );
}
