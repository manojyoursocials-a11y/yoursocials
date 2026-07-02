import React, { useEffect, useState } from 'react';

/* ── Btn ──────────────────────────────────────────────── */
export function Btn({ children, variant='primary', size='md', onClick, disabled, style, type='button' }) {
  const s = {
    border:'none', cursor:disabled?'not-allowed':'pointer', fontFamily:'Inter,sans-serif',
    fontWeight:600, borderRadius:10, transition:'all .18s', display:'inline-flex',
    alignItems:'center', justifyContent:'center', gap:6, opacity:disabled?.5:1,
    ...(size==='sm'?{padding:'5px 12px',fontSize:'.75rem'}:size==='lg'?{padding:'12px 24px',fontSize:'.95rem'}:{padding:'8px 16px',fontSize:'.82rem'}),
    ...(variant==='primary'?{background:'var(--grad1)',color:'#fff'}:
        variant==='ghost'  ?{background:'var(--surface3)',color:'var(--text)',border:'1px solid var(--border2)'}:
        variant==='danger' ?{background:'rgba(255,77,109,.15)',color:'var(--red)',border:'1px solid rgba(255,77,109,.25)'}:
                            {background:'transparent',color:'var(--muted2)',border:'1px dashed var(--border2)'}),
    ...style,
  };
  return <button type={type} style={s} onClick={disabled?undefined:onClick}>{children}</button>;
}

/* ── Card ─────────────────────────────────────────────── */
export function Card({ children, style, hover, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:20, transition:hover?'transform .18s,box-shadow .18s':undefined, cursor:onClick?'pointer':undefined, ...style }}
      onMouseEnter={hover?e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)';}:undefined}
      onMouseLeave={hover?e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}:undefined}
    >{children}</div>
  );
}

/* ── Modal ────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width=560 }) {
  useEffect(()=>{ const fn=e=>e.key==='Escape'&&onClose?.(); window.addEventListener('keydown',fn); return()=>window.removeEventListener('keydown',fn); },[onClose]);
  if (!open) return null;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose?.()} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(6px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div className="scale-in" style={{ background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:'var(--r-lg)',padding:28,width:'100%',maxWidth:width,maxHeight:'90vh',overflowY:'auto' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
          <div style={{ fontWeight:800,fontSize:'1rem' }}>{title}</div>
          <button onClick={onClose} style={{ background:'var(--surface3)',border:'1px solid var(--border)',borderRadius:8,width:32,height:32,cursor:'pointer',color:'var(--muted)',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Form inputs ──────────────────────────────────────── */
const iStyle = { width:'100%',background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:10,padding:'9px 12px',fontSize:'.83rem',color:'var(--text)',fontFamily:'Inter,sans-serif',outline:'none',transition:'border .18s' };
const focus  = e=>e.target.style.borderColor='var(--purple)';
const blur   = e=>e.target.style.borderColor='rgba(255,255,255,.13)';
const Lbl    = ({t})=><label style={{ display:'block',fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:5,letterSpacing:'.04em' }}>{t}</label>;
export function Input({ label,...p })  { return <div style={{ marginBottom:14 }}>{label&&<Lbl t={label}/>}<input  style={iStyle} onFocus={focus} onBlur={blur} {...p}/></div>; }
export function Select({ label,children,...p }) { return <div style={{ marginBottom:14 }}>{label&&<Lbl t={label}/>}<select style={{ ...iStyle,cursor:'pointer' }} onFocus={focus} onBlur={blur} {...p}>{children}</select></div>; }
export function Textarea({ label,...p }) { return <div style={{ marginBottom:14 }}>{label&&<Lbl t={label}/>}<textarea style={{ ...iStyle,resize:'vertical',minHeight:80 }} onFocus={focus} onBlur={blur} {...p}/></div>; }

/* ── Tag ──────────────────────────────────────────────── */
const P_S = { P1:{background:'rgba(255,77,109,.15)',color:'var(--red)'}, P2:{background:'rgba(255,140,66,.15)',color:'var(--orange)'}, P3:{background:'rgba(255,214,10,.12)',color:'var(--yellow)'}, P4:{background:'rgba(0,229,160,.10)',color:'var(--green)'} };
const ST_S= { todo:{background:'rgba(144,144,170,.12)',color:'var(--muted2)'}, inprogress:{background:'rgba(0,212,255,.12)',color:'var(--cyan)'}, review:{background:'rgba(255,214,10,.12)',color:'var(--yellow)'}, done:{background:'rgba(0,229,160,.10)',color:'var(--green)'} };
export function Tag({ text, style }) { const s={...P_S[text],...ST_S[text]}; return <span style={{ display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:6,fontSize:'.68rem',fontWeight:700,whiteSpace:'nowrap',...s,...style }}>{text}</span>; }

/* ── Avatar ───────────────────────────────────────────── */
export function Avatar({ name='', url, size=36, color='var(--purple)' }) {
  const i = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
  return <div style={{ width:size,height:size,borderRadius:'50%',background:url?'transparent':`${color}33`,border:`2px solid ${color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.35,fontWeight:800,color,flexShrink:0,overflow:'hidden' }}>{url?<img src={url} alt={name} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:i}</div>;
}

/* ── ProgressBar ──────────────────────────────────────── */
export function ProgressBar({ value=0, max=100, color='var(--grad1)', height=6, style }) {
  const p=Math.min(100,Math.max(0,(value/max)*100));
  return <div style={{ height,background:'var(--surface3)',borderRadius:height,overflow:'hidden',...style }}><div style={{ height:'100%',width:`${p}%`,background:color,borderRadius:height,transition:'width 1s ease' }}/></div>;
}

/* ── Ring ─────────────────────────────────────────────── */
export function Ring({ value=0, max=100, size=120, strokeWidth=8, color='#7C5CFC', label, sublabel }) {
  const r=size/2-strokeWidth, c=2*Math.PI*r, p=Math.min(1,value/max);
  return (
    <div style={{ position:'relative',width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)',position:'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={strokeWidth}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={c} strokeDashoffset={c-c*p} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1.2s ease' }}/>
      </svg>
      <div style={{ textAlign:'center',position:'relative' }}>
        {label&&<div style={{ fontSize:size*.16,fontWeight:800,color,lineHeight:1 }}>{label}</div>}
        {sublabel&&<div style={{ fontSize:size*.09,color:'var(--muted)',marginTop:2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

/* ── Spinner ──────────────────────────────────────────── */
export function Spinner({ size=24, color='var(--purple)' }) {
  return <div style={{ width:size,height:size,borderRadius:'50%',border:`2px solid rgba(255,255,255,.1)`,borderTopColor:color,animation:'spin .8s linear infinite' }}/>;
}

/* ── TypingDots ───────────────────────────────────────── */
export function TypingDots() {
  return <div style={{ display:'flex',gap:4,padding:'4px 0' }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'var(--purple2)',animation:`bounce .9s infinite`,animationDelay:`${i*.15}s` }}/>)}</div>;
}

/* ── Toast ────────────────────────────────────────────── */
let _add=null;
export function ToastContainer() {
  const [toasts,set]=useState([]);
  _add=(msg,icon='✅',type='success')=>{ const id=Date.now(); set(p=>[...p,{id,msg,icon,type}]); setTimeout(()=>set(p=>p.filter(t=>t.id!==id)),3200); };
  return (
    <div style={{ position:'fixed',top:20,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:8 }}>
      {toasts.map(t=><div key={t.id} style={{ background:'var(--surface2)',border:`1px solid ${t.type==='error'?'rgba(255,77,109,.3)':'rgba(0,229,160,.2)'}`,borderRadius:'var(--r-sm)',padding:'12px 16px',fontSize:'.82rem',display:'flex',alignItems:'center',gap:10,boxShadow:'var(--shadow-lg)',animation:'slideIn .3s ease',maxWidth:320 }}><span style={{ fontSize:'1rem' }}>{t.icon}</span><span>{t.msg}</span></div>)}
    </div>
  );
}
export const toast = { success:(m,i)=>_add?.(m,i||'✅','success'), error:(m,i)=>_add?.(m,i||'❌','error'), info:(m,i)=>_add?.(m,i||'💡','info') };

/* ── EmptyState ───────────────────────────────────────── */
export function EmptyState({ emoji, title, subtitle, action }) {
  return <div style={{ textAlign:'center',padding:'48px 20px',color:'var(--muted)' }}><div style={{ fontSize:'2.5rem',marginBottom:12 }}>{emoji}</div><div style={{ fontWeight:700,fontSize:'.9rem',color:'var(--text)',marginBottom:6 }}>{title}</div>{subtitle&&<div style={{ fontSize:'.78rem',marginBottom:16 }}>{subtitle}</div>}{action}</div>;
}

/* ── SectionLabel ─────────────────────────────────────── */
export function SectionLabel({ children }) {
  return <div style={{ fontSize:'.68rem',fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--muted)',marginBottom:14,marginTop:36,display:'flex',alignItems:'center',gap:12 }}>{children}<div style={{ flex:1,height:1,background:'var(--border)' }}/></div>;
}

/* ── Sounds ───────────────────────────────────────────── */
let _ac=null;
function ac(){ if(!_ac) try{_ac=new(window.AudioContext||window.webkitAudioContext)();}catch(e){} return _ac; }
function tone(f,d=.2,t='sine',v=.13){ const c=ac(); if(!c) return; const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type=t; o.frequency.value=f; g.gain.setValueAtTime(v,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d); o.start(); o.stop(c.currentTime+d); }
export const sounds = {
  click:    ()=>tone(440,.06,'sine',.07),
  success:  ()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.22,'sine',.12),i*70)),
  confetti: ()=>[880,1109,1319,1760].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.1),i*55)),
  badge:    ()=>[659,880,1109,1318].forEach((f,i)=>setTimeout(()=>tone(f,.28,'sine',.15),i*90)),
  error:    ()=>tone(220,.3,'sawtooth',.09),
  pop:      ()=>tone(660,.08,'sine',.09),
};

/* ── launchConfetti ───────────────────────────────────── */
export async function launchConfetti() {
  const m = await import('canvas-confetti');
  m.default({ particleCount:120, spread:80, origin:{y:.6}, colors:['#7C5CFC','#FF5FA0','#00D4FF','#00E5A0','#FFD60A'] });
}

/* ── useApi hook ──────────────────────────────────────── */
export async function api(url, method='GET', body) {
  const res = await fetch(url, {
    method, headers:{'Content-Type':'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function askAI(prompt) {
  const data = await api('/api/ai', 'POST', { prompt });
  return data.text || data.error || 'No response';
}

export const MEMBER_COLORS = ['#7C5CFC','#FF5FA0','#00D4FF','#00E5A0','#FF8C42','#FFD60A','#FF4D6D','#9D7FFF'];
