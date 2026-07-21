import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Textarea, Spinner, toast, Avatar, MEMBER_COLORS } from '../components/UI';

const api = (url, method = 'GET', body) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const SOURCES   = ['LinkedIn', 'Instagram', 'Referral', 'Cold Email', 'Website', 'Event', 'Other'];
const INDUSTRIES= ['Social Media / Marketing', 'F&B / Restaurant', 'Retail / Fashion', 'Healthcare / Wellness', 'Real Estate', 'Education', 'Tech / SaaS', 'Finance', 'Beauty / Salon', 'Other'];
const CO_SIZES  = ['1–10', '11–50', '51–200', '201–500', '500+'];
const PRIORITIES= [{ v:'high', l:'🔴 High', c:'#FF4D6D' }, { v:'medium', l:'🟡 Medium', c:'#FFD60A' }, { v:'low', l:'🟢 Low', c:'#00E5A0' }];
const STATUSES  = [
  { v:'new',         l:'🆕 New',           c:'#00D4FF' },
  { v:'contacted',   l:'📩 Contacted',      c:'#FFD60A' },
  { v:'replied',     l:'💬 Replied',        c:'#7C5CFC' },
  { v:'meeting',     l:'📅 Meeting Set',    c:'#FF9F43' },
  { v:'proposal',    l:'📄 Proposal Sent',  c:'#00AC47' },
  { v:'won',         l:'🏆 Won',            c:'#00E5A0' },
  { v:'lost',        l:'❌ Lost',           c:'#FF4D6D' },
  { v:'nurture',     l:'🌱 Nurture',        c:'#9090AA' },
];
const INT_TYPES = ['📞 Called', '📩 DM Sent', '✉️ Email Sent', '📅 Meeting', '💬 Replied', '🔗 Connected', '📝 Note'];

function scoreColor(s) {
  if (s >= 80) return '#00E5A0';
  if (s >= 60) return '#FFD60A';
  if (s >= 40) return '#FF9F43';
  return '#FF4D6D';
}
function statusCfg(v) { return STATUSES.find(s => s.v === v) || STATUSES[0]; }
function priorityCfg(v) { return PRIORITIES.find(p => p.v === v) || PRIORITIES[1]; }
function ago(iso) {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.floor(m / 60) + 'h ago'; return Math.floor(m / 1440) + 'd ago';
}

export default function Leads() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const userId  = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';

  const [leads,        setLeads]        = useState([]);
  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState('board'); // board | list
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPri,    setFilterPri]    = useState('all');
  const [showForm,     setShowForm]     = useState(false);
  const [editLead,     setEditLead]     = useState(null);
  const [detailLead,   setDetailLead]   = useState(null);
  const [detailData,   setDetailData]   = useState(null);
  const [scoring,      setScoring]      = useState(false);
  const [drafting,     setDrafting]     = useState(false);
  const [intNote,      setIntNote]      = useState('');
  const [intType,      setIntType]      = useState('📩 DM Sent');

  const EMPTY = { name:'', company:'', title:'', industry:'', company_size:'', source:'LinkedIn', profile_url:'', email:'', phone:'', location:'', bio:'', recent_post:'', status:'new', priority:'medium', assigned_to:'', notes:'', tags:'' };
  const [form, setForm] = useState(EMPTY);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const [l, m] = await Promise.all([api('/api/leads'), api('/api/members')]);
    setLeads(Array.isArray(l) ? l : []);
    setMembers(Array.isArray(m) ? m : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (status === 'authenticated') load(); }, [status, load]);

  async function openDetail(lead) {
    setDetailLead(lead);
    const d = await api('/api/leads?id=' + lead.id);
    setDetailData(d);
  }

  // ── ICP Scoring via Claude ────────────────────────────────
  async function scoreWithAI(lead) {
    setScoring(true);
    try {
      const prompt = `You are an ICP (Ideal Customer Profile) scoring assistant for a social media marketing agency in Chennai, India called "Your Socials".

Score this lead from 0–100 based on fit and intent. Higher = better fit.

Lead info:
- Name: ${lead.name}
- Title: ${lead.title || 'Unknown'}
- Company: ${lead.company || 'Unknown'}
- Industry: ${lead.industry || 'Unknown'}
- Company size: ${lead.company_size || 'Unknown'}
- Location: ${lead.location || 'Unknown'}
- Bio: ${lead.bio || 'None'}
- Recent post/activity: ${lead.recent_post || 'None'}

Your Socials ICP: Small to mid-size businesses in Chennai/South India, industries like F&B, retail, beauty, healthcare, education who need social media management. Decision makers (founders, owners, marketing heads) are ideal.

Return ONLY a JSON object: {"score": <0-100>, "notes": "<2-3 sentence explanation of why>", "next_action": "<specific recommended first message or action>"}`;

      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 400 }),
      });
      const d = await r.json();
      const text = d.content || d.result || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        await api('/api/leads', 'PATCH', { id: lead.id, icp_score: parsed.score, icp_notes: parsed.notes, notes: lead.notes ? lead.notes + '\n\n🤖 AI Next Action: ' + parsed.next_action : '🤖 AI Next Action: ' + parsed.next_action });
        toast.success('ICP Score: ' + parsed.score + '/100');
        load();
        if (detailLead?.id === lead.id) openDetail({ ...lead, icp_score: parsed.score });
      }
    } catch(e) { toast.error('AI scoring failed: ' + e.message); }
    setScoring(false);
  }

  // ── Draft message via Claude ──────────────────────────────
  async function draftMessage(lead) {
    setDrafting(true);
    try {
      const prompt = `You are a social media marketing agency (Your Socials, Chennai) writing a personalized LinkedIn/Instagram DM to a potential client.

Lead:
- Name: ${lead.name}
- Title: ${lead.title || ''}
- Company: ${lead.company || ''}
- Industry: ${lead.industry || ''}
- Bio: ${lead.bio || ''}
- Recent post: ${lead.recent_post || ''}

Write a short, warm, personalized DM (3–4 sentences max) that:
1. References something specific about them or their business
2. Mentions a relevant result Your Socials has achieved (make it realistic)
3. Ends with a soft CTA — asking if they'd be open to a quick chat, NOT pushy

Return ONLY the message text, no intro or explanation.`;

      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 300 }),
      });
      const d  = await r.json();
      const msg = d.content || d.result || '';
      if (msg) {
        await api('/api/leads', 'PATCH', { id: lead.id, drafted_message: msg.trim() });
        toast.success('Message drafted! Check the lead detail.');
        load();
        if (detailLead?.id === lead.id) openDetail(lead);
      }
    } catch(e) { toast.error('Draft failed: ' + e.message); }
    setDrafting(false);
  }

  async function saveLead() {
    if (!form.name.trim()) return toast.error('Name is required');
    if (editLead) {
      await api('/api/leads', 'PATCH', { id: editLead.id, ...form });
      toast.success('Lead updated');
    } else {
      await api('/api/leads', 'POST', form);
      toast.success('Lead added!');
    }
    setShowForm(false); setEditLead(null); setForm(EMPTY);
    load();
  }

  async function deleteLead(id) {
    if (!confirm('Delete this lead?')) return;
    await api('/api/leads?id=' + id, 'DELETE');
    toast.success('Deleted');
    setDetailLead(null);
    load();
  }

  async function logInteraction() {
    if (!intNote.trim() && !intType) return;
    await api('/api/leads', 'POST', { action: 'interaction', lead_id: detailLead.id, type: intType, note: intNote });
    setIntNote('');
    openDetail(detailLead);
    toast.success('Interaction logged');
  }

  // Filter
  const filtered = leads.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (filterPri !== 'all' && l.priority !== filterPri) return false;
    if (search && !`${l.name} ${l.company} ${l.industry}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const stats = {
    total:    leads.length,
    new:      leads.filter(l => l.status === 'new').length,
    active:   leads.filter(l => ['contacted','replied','meeting','proposal'].includes(l.status)).length,
    won:      leads.filter(l => l.status === 'won').length,
    highScore:leads.filter(l => (l.icp_score||0) >= 70).length,
  };

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.2rem', margin:0 }}>🎯 Lead CRM</h2>
            <p style={{ fontSize:'.8rem', color:'var(--muted2)', margin:'4px 0 0' }}>Track, score and draft outreach — team access only</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:2 }}>
              {[['board','▦'],['list','☰']].map(([v,icon]) => (
                <button key={v} onClick={()=>setView(v)}
                  style={{ padding:'5px 12px', borderRadius:6, border:'none', background:view===v?'var(--surface3)':'transparent', color:view===v?'var(--text)':'var(--muted2)', cursor:'pointer', fontSize:'.85rem' }}>
                  {icon}
                </button>
              ))}
            </div>
            <Btn onClick={()=>{setShowForm(true);setForm(EMPTY);setEditLead(null);}}>+ Add Lead</Btn>
          </div>
        </div>

        {/* ── STATS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { l:'Total Leads',   v:stats.total,     c:'#00D4FF', bg:'rgba(0,212,255,.08)',    i:'🎯' },
            { l:'New',           v:stats.new,        c:'#FFD60A', bg:'rgba(255,214,10,.08)',   i:'🆕' },
            { l:'Active',        v:stats.active,     c:'#7C5CFC', bg:'rgba(124,92,252,.08)',  i:'⚡' },
            { l:'Won',           v:stats.won,        c:'#00E5A0', bg:'rgba(0,229,160,.08)',   i:'🏆' },
            { l:'High ICP Score',v:stats.highScore,  c:'#FF9F43', bg:'rgba(255,159,67,.08)',  i:'⭐' },
          ].map(s => (
            <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.c}33`, borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:'1.3rem', marginBottom:4 }}>{s.i}</div>
              <div style={{ fontSize:'1.3rem', fontWeight:900, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:'.7rem', color:'var(--muted2)' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ── FILTERS ── */}
        <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search leads…"
            style={{ flex:1, minWidth:180, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, padding:'8px 14px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit', outline:'none' }}/>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, padding:'8px 12px', fontSize:'.82rem', color:'var(--text)', fontFamily:'inherit', cursor:'pointer' }}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <select value={filterPri} onChange={e=>setFilterPri(e.target.value)}
            style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, padding:'8px 12px', fontSize:'.82rem', color:'var(--text)', fontFamily:'inherit', cursor:'pointer' }}>
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>

        {loading && <div style={{ textAlign:'center', padding:60 }}><Spinner size={28}/></div>}

        {/* ── BOARD VIEW ── */}
        {!loading && view === 'board' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
            {filtered.length === 0 && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 20px', color:'var(--muted2)' }}>
                <div style={{ fontSize:'3rem', marginBottom:12, opacity:.4 }}>🎯</div>
                <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:8, color:'var(--muted)' }}>No leads yet</div>
                <div style={{ fontSize:'.84rem', marginBottom:20 }}>Add your first lead and use AI to score and draft outreach.</div>
                <Btn onClick={()=>{setShowForm(true);setForm(EMPTY);}}>+ Add First Lead</Btn>
              </div>
            )}
            {filtered.map((lead, i) => {
              const st  = statusCfg(lead.status);
              const pri = priorityCfg(lead.priority);
              const score = lead.icp_score || 0;
              return (
                <div key={lead.id} onClick={()=>openDetail(lead)}
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', cursor:'pointer', transition:'all .15s', position:'relative' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';e.currentTarget.style.transform='translateY(-2px)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
                  {/* Priority dot */}
                  <div style={{ position:'absolute', top:12, right:12, width:8, height:8, borderRadius:'50%', background:pri.c }}/>

                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:MEMBER_COLORS[i%MEMBER_COLORS.length]+'33', border:`1.5px solid ${MEMBER_COLORS[i%MEMBER_COLORS.length]}`, display:'flex', alignItems:'center', justifyContent:'center', color:MEMBER_COLORS[i%MEMBER_COLORS.length], fontWeight:800, fontSize:'.9rem', flexShrink:0 }}>
                      {lead.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.name}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--muted2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.title}{lead.company?` @ ${lead.company}`:''}</div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, background:st.c+'18', color:st.c, fontSize:'.67rem', fontWeight:700 }}>{st.l}</span>
                    {lead.industry && <span style={{ padding:'2px 8px', borderRadius:20, background:'var(--surface3)', color:'var(--muted2)', fontSize:'.67rem' }}>{lead.industry}</span>}
                    {lead.source   && <span style={{ padding:'2px 8px', borderRadius:20, background:'var(--surface3)', color:'var(--muted2)', fontSize:'.67rem' }}>📌 {lead.source}</span>}
                  </div>

                  {/* ICP Score bar */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:'.68rem', color:'var(--muted2)' }}>ICP Score</span>
                      <span style={{ fontSize:'.72rem', fontWeight:700, color:scoreColor(score) }}>{score}/100</span>
                    </div>
                    <div style={{ height:5, background:'var(--surface3)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:score+'%', background:scoreColor(score), borderRadius:3, transition:'width .4s' }}/>
                    </div>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'.67rem', color:'var(--muted)' }}>Updated {ago(lead.updated_at)}</span>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={e=>{e.stopPropagation();scoreWithAI(lead);}}
                        title="AI Score"
                        style={{ padding:'3px 8px', background:'rgba(124,92,252,.15)', border:'1px solid rgba(124,92,252,.3)', borderRadius:6, color:'var(--purple2)', cursor:'pointer', fontSize:'.68rem', fontWeight:700, fontFamily:'inherit' }}>
                        {scoring ? '…' : '⭐ Score'}
                      </button>
                      <button onClick={e=>{e.stopPropagation();draftMessage(lead);}}
                        title="Draft message"
                        style={{ padding:'3px 8px', background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.25)', borderRadius:6, color:'var(--cyan)', cursor:'pointer', fontSize:'.68rem', fontFamily:'inherit' }}>
                        {drafting ? '…' : '✍️'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {!loading && view === 'list' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {filtered.map((lead, i) => {
              const st  = statusCfg(lead.status);
              const pri = priorityCfg(lead.priority);
              const score = lead.icp_score || 0;
              return (
                <div key={lead.id} onClick={()=>openDetail(lead)}
                  style={{ display:'flex', alignItems:'center', gap:14, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', cursor:'pointer', transition:'all .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--purple)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  <div style={{ width:36, height:36, borderRadius:9, background:MEMBER_COLORS[i%MEMBER_COLORS.length]+'33', border:`1.5px solid ${MEMBER_COLORS[i%MEMBER_COLORS.length]}`, display:'flex', alignItems:'center', justifyContent:'center', color:MEMBER_COLORS[i%MEMBER_COLORS.length], fontWeight:800, fontSize:'.85rem', flexShrink:0 }}>
                    {lead.name.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'.88rem' }}>{lead.name}</div>
                    <div style={{ fontSize:'.72rem', color:'var(--muted2)' }}>{lead.title}{lead.company?` @ ${lead.company}`:''} {lead.industry?`· ${lead.industry}`:''}</div>
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:20, background:st.c+'18', color:st.c, fontSize:'.68rem', fontWeight:700, flexShrink:0 }}>{st.l}</span>
                  <div style={{ width:70, textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'.75rem', fontWeight:800, color:scoreColor(score) }}>{score}/100</div>
                    <div style={{ height:4, background:'var(--surface3)', borderRadius:2, marginTop:3 }}>
                      <div style={{ height:'100%', width:score+'%', background:scoreColor(score), borderRadius:2 }}/>
                    </div>
                  </div>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:pri.c, flexShrink:0 }}/>
                  <span style={{ fontSize:'.67rem', color:'var(--muted)', flexShrink:0 }}>{ago(lead.updated_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ADD / EDIT LEAD MODAL ── */}
      <Modal open={showForm} title={editLead ? '✏️ Edit Lead' : '+ Add New Lead'} onClose={()=>{setShowForm(false);setEditLead(null);setForm(EMPTY);}} width={640}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {/* Name */}
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Full Name *</div>
            <Input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Ravi Kumar"/>
          </div>
          {/* Title + Company */}
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Job Title</div>
            <Input value={form.title} onChange={e=>f('title',e.target.value)} placeholder="Founder, CEO, Marketing Head…"/>
          </div>
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Company</div>
            <Input value={form.company} onChange={e=>f('company',e.target.value)} placeholder="Company name"/>
          </div>
          {/* Industry + Size */}
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Industry</div>
            <select value={form.industry} onChange={e=>f('industry',e.target.value)}
              style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit' }}>
              <option value="">Select…</option>
              {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Company Size</div>
            <select value={form.company_size} onChange={e=>f('company_size',e.target.value)}
              style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit' }}>
              <option value="">Select…</option>
              {CO_SIZES.map(s=><option key={s} value={s}>{s} employees</option>)}
            </select>
          </div>
          {/* Source + Location */}
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Source</div>
            <select value={form.source} onChange={e=>f('source',e.target.value)}
              style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit' }}>
              {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Location</div>
            <Input value={form.location} onChange={e=>f('location',e.target.value)} placeholder="Chennai, Bangalore…"/>
          </div>
          {/* Contact */}
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Email</div>
            <Input type="email" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="email@company.com"/>
          </div>
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Phone</div>
            <Input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 9XXXXXXXXX"/>
          </div>
          {/* Profile URL */}
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Profile URL</div>
            <Input value={form.profile_url} onChange={e=>f('profile_url',e.target.value)} placeholder="https://linkedin.com/in/..."/>
          </div>
          {/* Bio */}
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Bio / About</div>
            <Textarea value={form.bio} onChange={e=>f('bio',e.target.value)} placeholder="Paste their LinkedIn bio or description…" rows={2}/>
          </div>
          {/* Recent post */}
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Recent Post / Activity</div>
            <Textarea value={form.recent_post} onChange={e=>f('recent_post',e.target.value)} placeholder="Paste their recent LinkedIn post or activity — AI uses this for scoring and drafting…" rows={2}/>
          </div>
          {/* Status + Priority + Assign */}
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Status</div>
            <select value={form.status} onChange={e=>f('status',e.target.value)}
              style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit' }}>
              {STATUSES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Priority</div>
            <select value={form.priority} onChange={e=>f('priority',e.target.value)}
              style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit' }}>
              {PRIORITIES.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Assign To</div>
            <select value={form.assigned_to} onChange={e=>f('assigned_to',e.target.value)}
              style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:9, padding:'10px 12px', fontSize:'.84rem', color:'var(--text)', fontFamily:'inherit' }}>
              <option value="">Unassigned</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email}</option>)}
            </select>
          </div>
          {/* Notes */}
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, marginBottom:5 }}>Notes</div>
            <Textarea value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Internal notes…" rows={2}/>
          </div>
          {/* Actions */}
          <div style={{ gridColumn:'1/-1', display:'flex', gap:10 }}>
            <Btn variant="ghost" onClick={()=>{setShowForm(false);setEditLead(null);setForm(EMPTY);}} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={saveLead} style={{ flex:2 }}>{editLead ? '💾 Save Changes' : '+ Add Lead'}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── LEAD DETAIL DRAWER ── */}
      {detailLead && (
        <div style={{ position:'fixed', inset:0, zIndex:998, display:'flex' }}>
          <div onClick={()=>setDetailLead(null)} style={{ flex:1, background:'rgba(0,0,0,.5)' }}/>
          <div style={{ width:'min(540px,100vw)', background:'var(--surface)', borderLeft:'1px solid var(--border2)', overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {detailData ? (() => {
              const lead = detailData.lead;
              const interactions = detailData.interactions || [];
              const st  = statusCfg(lead.status);
              const pri = priorityCfg(lead.priority);
              const score = lead.icp_score || 0;
              return (
                <>
                  {/* Detail header */}
                  <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexShrink:0 }}>
                    <div>
                      <div style={{ fontWeight:900, fontSize:'1.1rem', marginBottom:4 }}>{lead.name}</div>
                      <div style={{ fontSize:'.8rem', color:'var(--muted2)' }}>{lead.title}{lead.company?` @ ${lead.company}`:''}</div>
                      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, background:st.c+'18', color:st.c, fontSize:'.7rem', fontWeight:700 }}>{st.l}</span>
                        <span style={{ padding:'3px 10px', borderRadius:20, background:pri.c+'18', color:pri.c, fontSize:'.7rem', fontWeight:700 }}>{pri.l}</span>
                        {lead.source && <span style={{ padding:'3px 10px', borderRadius:20, background:'var(--surface2)', color:'var(--muted2)', fontSize:'.7rem' }}>📌 {lead.source}</span>}
                      </div>
                    </div>
                    <button onClick={()=>setDetailLead(null)} style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, cursor:'pointer', color:'var(--muted2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                  </div>

                  <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>

                    {/* ICP Score */}
                    <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={{ fontWeight:700, fontSize:'.88rem' }}>⭐ ICP Score</div>
                        <span style={{ fontSize:'1.3rem', fontWeight:900, color:scoreColor(score) }}>{score}<span style={{ fontSize:'.8rem', color:'var(--muted2)' }}>/100</span></span>
                      </div>
                      <div style={{ height:8, background:'var(--surface3)', borderRadius:4, marginBottom:8 }}>
                        <div style={{ height:'100%', width:score+'%', background:scoreColor(score), borderRadius:4, transition:'width .5s' }}/>
                      </div>
                      {lead.icp_notes && <div style={{ fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.6 }}>{lead.icp_notes}</div>}
                      <button onClick={()=>scoreWithAI(lead)}
                        style={{ marginTop:10, padding:'6px 14px', background:'rgba(124,92,252,.15)', border:'1px solid rgba(124,92,252,.3)', borderRadius:8, color:'var(--purple2)', cursor:'pointer', fontSize:'.78rem', fontWeight:700, fontFamily:'inherit' }}>
                        {scoring ? '⏳ Scoring…' : '🤖 Re-score with AI'}
                      </button>
                    </div>

                    {/* Drafted message */}
                    <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:8 }}>✍️ Drafted Message</div>
                      {lead.drafted_message
                        ? <>
                            <div style={{ fontSize:'.82rem', color:'var(--text)', lineHeight:1.7, background:'var(--surface3)', borderRadius:8, padding:'10px 12px', marginBottom:8, whiteSpace:'pre-wrap' }}>{lead.drafted_message}</div>
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={()=>navigator.clipboard.writeText(lead.drafted_message).then(()=>toast.success('Copied!'))}
                                style={{ padding:'5px 12px', background:'rgba(0,229,160,.12)', border:'1px solid rgba(0,229,160,.25)', borderRadius:7, color:'var(--green)', cursor:'pointer', fontSize:'.75rem', fontFamily:'inherit' }}>
                                📋 Copy
                              </button>
                              <button onClick={()=>draftMessage(lead)}
                                style={{ padding:'5px 12px', background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.25)', borderRadius:7, color:'var(--cyan)', cursor:'pointer', fontSize:'.75rem', fontFamily:'inherit' }}>
                                {drafting ? '⏳' : '🔄 Redraft'}
                              </button>
                            </div>
                          </>
                        : <button onClick={()=>draftMessage(lead)}
                            style={{ padding:'8px 16px', background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.25)', borderRadius:8, color:'var(--cyan)', cursor:'pointer', fontSize:'.8rem', fontWeight:700, fontFamily:'inherit' }}>
                            {drafting ? '⏳ Drafting…' : '🤖 Draft AI Message'}
                          </button>
                      }
                    </div>

                    {/* Contact info */}
                    <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:10 }}>Contact Info</div>
                      {[
                        ['📧', 'Email',    lead.email,       lead.email       ? `mailto:${lead.email}`    : null],
                        ['📞', 'Phone',    lead.phone,       lead.phone       ? `tel:${lead.phone}`       : null],
                        ['🔗', 'Profile',  lead.profile_url ? 'View Profile' : null, lead.profile_url],
                        ['📍', 'Location', lead.location,    null],
                        ['🏢', 'Industry', lead.industry,    null],
                        ['👥', 'Size',     lead.company_size ? lead.company_size + ' employees' : null, null],
                      ].filter(([,,v])=>v).map(([icon,label,val,href])=>(
                        <div key={label} style={{ display:'flex', gap:8, marginBottom:7 }}>
                          <span style={{ color:'var(--muted)', fontSize:'.82rem', flexShrink:0 }}>{icon}</span>
                          <span style={{ fontSize:'.75rem', color:'var(--muted)', flexShrink:0, minWidth:60 }}>{label}</span>
                          {href
                            ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize:'.82rem', color:'var(--purple2)', textDecoration:'none', fontWeight:600 }}>{val}</a>
                            : <span style={{ fontSize:'.82rem', color:'var(--text)' }}>{val}</span>
                          }
                        </div>
                      ))}
                    </div>

                    {/* Status change */}
                    <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:10 }}>Update Status</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {STATUSES.map(s=>(
                          <button key={s.v} onClick={async()=>{await api('/api/leads','PATCH',{id:lead.id,status:s.v});toast.success('Status updated');openDetail(lead);load();}}
                            style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${s.c}44`, background: lead.status===s.v?s.c+'22':'transparent', color:lead.status===s.v?s.c:'var(--muted2)', cursor:'pointer', fontSize:'.72rem', fontWeight:lead.status===s.v?700:400, fontFamily:'inherit' }}>
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {lead.notes && (
                      <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                        <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:8 }}>📝 Notes</div>
                        <div style={{ fontSize:'.82rem', color:'var(--muted2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{lead.notes}</div>
                      </div>
                    )}

                    {/* Log interaction */}
                    <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:10 }}>📋 Log Interaction</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                        {INT_TYPES.map(t=>(
                          <button key={t} onClick={()=>setIntType(t)}
                            style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${intType===t?'var(--purple)':'var(--border)'}`, background:intType===t?'rgba(124,92,252,.15)':'transparent', color:intType===t?'var(--purple2)':'var(--muted2)', cursor:'pointer', fontSize:'.7rem', fontFamily:'inherit' }}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <Textarea value={intNote} onChange={e=>setIntNote(e.target.value)} placeholder="What happened? Any details…" rows={2} style={{ marginBottom:8 }}/>
                      <Btn onClick={logInteraction} style={{ width:'100%' }}>Log Interaction</Btn>
                    </div>

                    {/* Interaction history */}
                    {interactions.length > 0 && (
                      <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 16px' }}>
                        <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:10 }}>🕐 History</div>
                        {interactions.map(int=>(
                          <div key={int.id} style={{ display:'flex', gap:10, marginBottom:10, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
                            <div style={{ fontSize:'.85rem', flexShrink:0 }}>{int.type?.split(' ')[0]||'📋'}</div>
                            <div>
                              <div style={{ fontSize:'.78rem', fontWeight:600 }}>{int.type}</div>
                              {int.note && <div style={{ fontSize:'.75rem', color:'var(--muted2)', lineHeight:1.5 }}>{int.note}</div>}
                              <div style={{ fontSize:'.67rem', color:'var(--muted)', marginTop:3 }}>{int.creator_name} · {ago(int.created_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, flexShrink:0 }}>
                    <Btn variant="ghost" onClick={()=>{setEditLead(lead);setForm({name:lead.name||'',company:lead.company||'',title:lead.title||'',industry:lead.industry||'',company_size:lead.company_size||'',source:lead.source||'LinkedIn',profile_url:lead.profile_url||'',email:lead.email||'',phone:lead.phone||'',location:lead.location||'',bio:lead.bio||'',recent_post:lead.recent_post||'',status:lead.status||'new',priority:lead.priority||'medium',assigned_to:lead.assigned_to||'',notes:lead.notes||'',tags:lead.tags||''});setShowForm(true);}} style={{ flex:1 }}>✏️ Edit</Btn>
                    {isAdmin && <Btn variant="ghost" onClick={()=>deleteLead(lead.id)} style={{ color:'#FF4D6D', borderColor:'rgba(255,77,109,.3)' }}>🗑 Delete</Btn>}
                  </div>
                </>
              );
            })() : <div style={{ padding:40, textAlign:'center' }}><Spinner size={24}/></div>}
          </div>
        </div>
      )}
    </Layout>
  );
}
