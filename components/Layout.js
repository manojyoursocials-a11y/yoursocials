import React from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, ToastContainer } from './UI';

const NAV = [
  { path:'/',            icon:'🏠', label:'Dashboard' },
  { path:'/tasks',       icon:'✅', label:'Tasks',      badge:'tasks' },
  { path:'/ai',          icon:'🤖', label:'AI Manager' },
  { section:'Team' },
  { path:'/team',        icon:'👥', label:'Members' },
  { path:'/leaderboard', icon:'🏆', label:'Leaderboard' },
  { path:'/rewards',     icon:'🎁', label:'Rewards' },
  { section:'Work' },
  { path:'/clients',     icon:'🏢', label:'Clients' },
  { path:'/followups',   icon:'📩', label:'Follow-ups', badge:'followups' },
  { path:'/analytics',   icon:'📊', label:'Analytics' },
];

export default function Layout({ children, badges={} }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <aside style={{ width:220, minWidth:220, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'20px 12px', gap:2, overflow:'hidden auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px 20px', borderBottom:'1px solid var(--border)', marginBottom:8 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'var(--grad1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>⚡</div>
          <span style={{ fontWeight:800, fontSize:'.88rem', background:'var(--grad1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Your Socials OS</span>
        </div>

        {NAV.map((item, i) => {
          if (item.section) return <div key={i} style={{ fontSize:'.62rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', padding:'14px 10px 5px' }}>{item.section}</div>;
          const active = router.pathname === item.path;
          const count  = item.badge ? (badges[item.badge] || 0) : 0;
          return (
            <div key={item.path} onClick={() => router.push(item.path)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:'var(--r-sm)', cursor:'pointer', fontSize:'.83rem', fontWeight:500, color:active?'var(--purple2)':'var(--muted2)', background:active?'rgba(124,92,252,.14)':'transparent', borderLeft:active?'3px solid var(--purple)':'3px solid transparent', transition:'all .18s' }}
              onMouseEnter={e => !active && (e.currentTarget.style.background='var(--surface2)')}
              onMouseLeave={e => !active && (e.currentTarget.style.background='transparent')}
            >
              <span style={{ fontSize:'1rem', width:20, textAlign:'center' }}>{item.icon}</span>
              {item.label}
              {count > 0 && <span style={{ marginLeft:'auto', background:'var(--purple)', color:'#fff', fontSize:'.62rem', fontWeight:700, padding:'2px 6px', borderRadius:20 }}>{count}</span>}
            </div>
          );
        })}

        {/* Admin-only */}
        {isAdmin && (
          <>
            <div style={{ fontSize:'.62rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', padding:'14px 10px 5px' }}>Admin</div>
            <div onClick={() => router.push('/admin')}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:'var(--r-sm)', cursor:'pointer', fontSize:'.83rem', fontWeight:500, color:router.pathname==='/admin'?'var(--purple2)':'var(--muted2)', background:router.pathname==='/admin'?'rgba(124,92,252,.14)':'transparent', borderLeft:router.pathname==='/admin'?'3px solid var(--purple)':'3px solid transparent', transition:'all .18s' }}
              onMouseEnter={e => router.pathname!=='/admin' && (e.currentTarget.style.background='var(--surface2)')}
              onMouseLeave={e => router.pathname!=='/admin' && (e.currentTarget.style.background='transparent')}
            >
              <span style={{ fontSize:'1rem', width:20, textAlign:'center' }}>⚙️</span>
              Manage Users
            </div>
          </>
        )}

        <div style={{ marginTop:'auto', paddingTop:16, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <Avatar name={session?.user?.name || 'You'} size={32} color="#7C5CFC" />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'.78rem', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{session?.user?.name || 'You'}</div>
            <div style={{ fontSize:'.65rem', color:'var(--muted)' }}>{session?.user?.role || 'member'}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl:'/login' })} title="Sign out" style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'1.1rem', padding:4 }}>↩</button>
        </div>
      </aside>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 28px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="live-dot" />
            <span style={{ fontSize:'.75rem', color:'var(--muted)', fontWeight:500 }}>Live</span>
          </div>
          <div style={{ fontSize:'.8rem', color:'var(--muted2)', display:'flex', alignItems:'center', gap:16 }}>
            {session?.user?.coins !== undefined && <span style={{ color:'var(--yellow)', fontWeight:700 }}>🪙 {(session.user.coins||0).toLocaleString()}</span>}
            <span>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'28px 28px 40px' }}>{children}</div>
      </div>
      <ToastContainer />
    </div>
  );
}
