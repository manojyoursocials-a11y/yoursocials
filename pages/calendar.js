import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Select, Textarea, Avatar, Spinner, toast, MEMBER_COLORS } from '../components/UI';

// ── Mobile detection ──────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return m;
}

// ── Constants ─────────────────────────────────────────────────
const STATUS_CONFIG = {
  planning:    { label:'Planning',    color:'#9090AA', bg:'rgba(144,144,170,.15)', emoji:'🗓' },
  in_progress: { label:'In Progress', color:'#00D4FF', bg:'rgba(0,212,255,.15)',   emoji:'⚡' },
  review:      { label:'Review',      color:'#FFD60A', bg:'rgba(255,214,10,.15)',   emoji:'👁️' },
  approved:    { label:'Approved',    color:'#7C5CFC', bg:'rgba(124,92,252,.15)',   emoji:'✅' },
  scheduled:   { label:'Scheduled',   color:'#FF9F43', bg:'rgba(255,159,67,.15)',   emoji:'📅' },
  live:        { label:'Live',        color:'#00E5A0', bg:'rgba(0,229,160,.15)',    emoji:'🟢' },
  cancelled:   { label:'Cancelled',   color:'#FF4D6D', bg:'rgba(255,77,109,.15)',   emoji:'❌' },
};
const PLATFORMS     = ['Instagram','Facebook','Twitter/X','LinkedIn','YouTube','TikTok','Pinterest','Snapchat','WhatsApp','Email','Website','Other'];
const CONTENT_TYPES = {
  'Reel':         { color:'#FF5FA0', bg:'rgba(255,95,160,.15)',  emoji:'🎬' },
  'Story':        { color:'#FFD60A', bg:'rgba(255,214,10,.15)',  emoji:'📸' },
  'Carousel':     { color:'#7C5CFC', bg:'rgba(124,92,252,.15)', emoji:'🔄' },
  'Static Post':  { color:'#00D4FF', bg:'rgba(0,212,255,.15)',  emoji:'🖼️' },
  'Video':        { color:'#FF9F43', bg:'rgba(255,159,67,.15)', emoji:'🎥' },
  'Blog':         { color:'#00E5A0', bg:'rgba(0,229,160,.15)',  emoji:'📝' },
  'Newsletter':   { color:'#A78BFA', bg:'rgba(167,139,250,.15)' ,emoji:'📧' },
  'Ad Creative':  { color:'#FF4D6D', bg:'rgba(255,77,109,.15)', emoji:'📢' },
  'UGC':          { color:'#34D399', bg:'rgba(52,211,153,.15)', emoji:'👤' },
  'Infographic':  { color:'#60A5FA', bg:'rgba(96,165,250,.15)', emoji:'📊' },
  'Other':        { color:'#9090AA', bg:'rgba(144,144,170,.15)',emoji:'📌' },
};
const CAL_COLORS    = ['#7C5CFC','#FF5FA0','#00D4FF','#FFD60A','#00E5A0','#FF9F43','#FF4D6D','#A78BFA','#34D399','#60A5FA'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function apiFetch(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined });
  return r.json();
}

const blankPost = (calId='') => ({ calendar_id:calId, title:'', content_description:'', platform:'Instagram', content_type:'Reel', status:'planning', assigned_to:'', topic_tags:'', target_audience:'', publish_date:'', publish_time:'09:00', links:'', notes:'' });
const blankCal  = ()         => ({ name:'', color:'#7C5CFC', description:'', client_id:'' });

// ── Main component ────────────────────────────────────────────
export default function Calendar() {
  const { status, data: session } = useSession();
  const router  = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';

  const [calendars,         setCalendars]         = useState([]);
  const [posts,             setPosts]             = useState([]);
  const [members,           setMembers]           = useState([]);
  const [clients,           setClients]           = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [activeCalId,       setActiveCalId]       = useState('all');
  const [viewMode,          setViewMode]          = useState('month');
  const [curDate,           setCurDate]           = useState(new Date());
  const [selectedDay,       setSelectedDay]       = useState(null);
  const [sidebarExpanded,   setSidebarExpanded]   = useState(false);

  // Calendar modal
  const [calModal,    setCalModal]    = useState(false);
  const [editingCal,  setEditingCal]  = useState(null);
  const [calForm,     setCalForm]     = useState(blankCal());

  // Post modal
  const [postModal,   setPostModal]   = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [postForm,    setPostForm]    = useState(blankPost());
  const [detailPost,  setDetailPost]  = useState(null);

  // Import/Export
  const [importModal, setImportModal] = useState(false);
  const [importData,  setImportData]  = useState([]);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState('');

  // Important days / festivals
  const [importantDays,    setImportantDays]    = useState([]);
  const [showDayPanel,     setShowDayPanel]     = useState(false);
  const [showClearMenu,    setShowClearMenu]    = useState(false);

  // Close clear menu on outside click — MUST be after showClearMenu is declared
  useEffect(() => {
    if (!showClearMenu) return;
    const h = e => {
      try {
        const wrap = document.querySelector('.clear-menu-wrap');
        if (wrap && !wrap.contains(e.target)) setShowClearMenu(false);
      } catch(err) { setShowClearMenu(false); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showClearMenu]);
  const [dayForm,          setDayForm]          = useState({ title:'', date:'', color:'#FF4D6D', emoji:'🎉', recurring:true });
  const [addingDay,        setAddingDay]        = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Data loading ───────────────────────────────────────────
  async function loadImportantDays() {
    const d = await fetch('/api/important-days').then(r=>r.json());
    setImportantDays(Array.isArray(d) ? d : []);
  }

  async function loadMonthPosts(date) {
    const y = date.getFullYear(), m = date.getMonth();
    const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const last  = new Date(y, m+1, 0).getDate();
    const to    = `${y}-${String(m+1).padStart(2,'0')}-${last}`;
    const ps = await apiFetch(`/api/calendar?from=${from}&to=${to}`);
    setPosts(Array.isArray(ps) ? ps : []);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cals, ms, cls] = await Promise.all([apiFetch('/api/calendar'), apiFetch('/api/members'), apiFetch('/api/clients')]);
    setCalendars(Array.isArray(cals) ? cals : []);
    setMembers(Array.isArray(ms) ? ms : []);
    setClients(Array.isArray(cls) ? cls : []);
    await loadMonthPosts(curDate);
    setLoading(false);
  }, [curDate]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadAll();
    loadImportantDays();
  }, [status]);

  // ── Month navigation ───────────────────────────────────────
  function prevMonth() { const d = new Date(curDate.getFullYear(), curDate.getMonth()-1, 1); setCurDate(d); loadMonthPosts(d); }
  function nextMonth() { const d = new Date(curDate.getFullYear(), curDate.getMonth()+1, 1); setCurDate(d); loadMonthPosts(d); }
  function goToday()   { const d = new Date(); setCurDate(d); loadMonthPosts(d); }

  // ── Calendar CRUD ──────────────────────────────────────────
  async function saveCal() {
    if (!calForm.name.trim()) { toast.error('Name required'); return; }
    if (editingCal) {
      await apiFetch('/api/calendar','PATCH',{ id:editingCal.id, type:'calendar', ...calForm });
      toast.success('Calendar updated!');
    } else {
      await apiFetch('/api/calendar','POST',{ type:'calendar', ...calForm });
      toast.success('Calendar created! 🎉');
    }
    setCalModal(false); setEditingCal(null); setCalForm(blankCal()); loadAll();
  }

  async function deleteCal(cal) {
    if (!confirm(`Delete "${cal.name}"? All posts will be removed.`)) return;
    await apiFetch('/api/calendar?id='+cal.id+'&type=calendar','DELETE');
    toast.info('Calendar deleted');
    if (activeCalId === cal.id) setActiveCalId('all');
    loadAll();
  }

  // ── Post CRUD ──────────────────────────────────────────────
  function openNewPost(date) {
    const calId = activeCalId !== 'all' ? activeCalId : (calendars[0]?.id || '');
    setEditingPost(null);
    setPostForm({ ...blankPost(calId), publish_date: date || todayStr });
    setPostModal(true);
  }

  function openEditPost(post) {
    setDetailPost(null);
    setEditingPost(post);
    const tags  = (() => { try { return JSON.parse(post.topic_tags||'[]'); } catch { return []; } })();
    const links = (() => { try { return JSON.parse(post.links||'[]'); } catch { return []; } })();
    setPostForm({
      calendar_id: post.calendar_id, title: post.title,
      content_description: post.content_description||'', platform: post.platform||'Instagram',
      content_type: post.content_type||'Reel', status: post.status||'planning',
      assigned_to: post.assigned_to||'', topic_tags: tags.join(', '),
      target_audience: post.target_audience||'',
      publish_date: post.publish_date ? String(post.publish_date).slice(0,10) : '',
      publish_time: post.publish_time||'09:00', links: links.join('\n'), notes: post.notes||'',
    });
    setPostModal(true);
  }

  async function savePost() {
    if (!postForm.title.trim()) { toast.error('Title required'); return; }
    if (!postForm.calendar_id)  { toast.error('Select a calendar'); return; }
    const payload = {
      ...postForm,
      topic_tags: JSON.stringify(postForm.topic_tags.split(',').map(t=>t.trim()).filter(Boolean)),
      links:      JSON.stringify(postForm.links.split('\n').map(l=>l.trim()).filter(Boolean)),
    };
    if (editingPost) {
      await apiFetch('/api/calendar','PATCH',{ id:editingPost.id, type:'post', ...payload });
      toast.success('Post updated!');
    } else {
      await apiFetch('/api/calendar','POST',{ type:'post', ...payload });
      toast.success('Post added! 📅');
    }
    setPostModal(false); setEditingPost(null);
    loadMonthPosts(curDate);
  }

  async function deletePost(post) {
    if (!confirm(`Delete "${post.title}"?`)) return;
    await apiFetch('/api/calendar?id='+post.id+'&type=post','DELETE');
    toast.info('Post deleted');
    setDetailPost(null);
    loadMonthPosts(curDate);
  }

  async function quickStatus(post, newStatus) {
    const tags  = (() => { try { return post.topic_tags; } catch { return '[]'; } })();
    const links = (() => { try { return post.links; } catch { return '[]'; } })();
    await apiFetch('/api/calendar','PATCH',{ id:post.id, type:'post', ...post, status:newStatus, topic_tags:tags, links:links });
    setDetailPost(p => p ? {...p, status:newStatus} : p);
    loadMonthPosts(curDate);
    toast.success('Status updated');
  }

  // ── Export ─────────────────────────────────────────────────
  function exportCSV(calIdOverride) {
    const calId    = calIdOverride || activeCalId;
    const target   = calId === 'all' ? filteredPosts : filteredPosts.filter(p => p.calendar_id === calId);
    const cal      = calendars.find(c => c.id === calId);
    const calName  = cal ? cal.name : 'All-Calendars';
    const month    = `${MONTHS[curDate.getMonth()]}-${curDate.getFullYear()}`;
    const header   = ['Calendar','Title','Platform','Content Type','Status','Publish Date','Publish Time','Assigned To','Topic Tags','Target Audience','Content Description','Notes','Reference Links'];
    const rows     = target.map(p => {
      const tags  = (() => { try { return JSON.parse(p.topic_tags||'[]').join(', '); } catch { return ''; } })();
      const links = (() => { try { return JSON.parse(p.links||'[]').join(' | '); } catch { return ''; } })();
      return [p.calendar_name||calName, p.title, p.platform||'', p.content_type||'', STATUS_CONFIG[p.status]?.label||p.status, p.publish_date?String(p.publish_date).slice(0,10):'', p.publish_time||'', p.assignee_name||'', tags, p.target_audience||'', p.content_description||'', p.notes||'', links];
    });
    const csv  = [header,...rows].map(r => r.map(cell => '"'+String(cell||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${calName.replace(/[^a-z0-9]/gi,'-')}-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${target.length} posts`);
  }

  function downloadTemplate() {
    const header  = ['Calendar Name','Title','Platform','Content Type','Status','Publish Date (YYYY-MM-DD)','Publish Time (HH:MM)','Assigned To (Name)','Topic Tags (comma separated)','Target Audience','Content Description','Notes','Reference Links (pipe separated)'];
    const example = [calendars[0]?.name||'Brand Name','Summer Sale Reel','Instagram','Reel','Planning',`${curDate.getFullYear()}-${String(curDate.getMonth()+1).padStart(2,'0')}-15`,'09:00','','summer, sale','Women 25-40','Caption here','Internal notes','https://drive.google.com/file'];
    const csv  = [header,example].map(r => r.map(c => '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'calendar-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.info('Template downloaded');
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    function parseLine(line) {
      const result = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      result.push(cur.trim()); return result;
    }
    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g,''));
    return lines.slice(1).filter(l=>l.trim()).map(line => {
      const vals = parseLine(line), row = {};
      headers.forEach((h,i) => { row[h] = vals[i]||''; });
      return row;
    });
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try { const rows = parseCSV(ev.target.result); if (!rows.length) { setImportError('No data rows found'); return; } setImportData(rows); }
      catch(err) { setImportError('Could not parse: '+err.message); }
    };
    reader.readAsText(file); e.target.value = '';
  }

  async function runImport() {
    if (!importData.length) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const row of importData) {
      try {
        const calName  = row['calendarname']||row['calendar']||'';
        const matched  = calendars.find(c=>c.name.toLowerCase()===calName.toLowerCase()) || (activeCalId!=='all'?calendars.find(c=>c.id===activeCalId):calendars[0]);
        if (!matched) { fail++; continue; }
        const assignee = members.find(m=>(m.name||'').toLowerCase()===(row['assignedtoname']||row['assignedto']||'').toLowerCase());
        const statusRaw = (row['status']||'planning').toLowerCase().replace(/ /g,'_');
        const statusMap = { planning:'planning', in_progress:'in_progress', inprogress:'in_progress', review:'review', approved:'approved', scheduled:'scheduled', live:'live', cancelled:'cancelled' };
        const status = statusMap[statusRaw]||'planning';
        const tags  = (row['topictagscommaseparated']||row['topictags']||row['tags']||'').split(',').map(t=>t.trim()).filter(Boolean);
        const links = (row['referencelinks']||row['links']||'').split('|').map(l=>l.trim()).filter(Boolean);
        const res = await apiFetch('/api/calendar','POST',{
          type:'post', calendar_id:matched.id, title:row['title']||'Imported Post',
          platform:row['platform']||'Instagram', content_type:row['contenttype']||row['type']||'Reel',
          status, publish_date:row['publishdateyyymmdd']||row['publishdate']||row['date']||'',
          publish_time:row['publishtimehhmm']||row['publishtime']||'09:00',
          assigned_to:assignee?.id||null, topic_tags:JSON.stringify(tags),
          target_audience:row['targetaudience']||'', content_description:row['contentdescription']||row['description']||'',
          notes:row['notes']||'', links:JSON.stringify(links),
        });
        if (res.error) fail++; else ok++;
      } catch(e) { fail++; }
    }
    setImporting(false); setImportModal(false); setImportData([]);
    loadMonthPosts(curDate);
    if (ok > 0)   toast.success(`Imported ${ok} posts! 🎉`);
    if (fail > 0) toast.error(`${fail} rows failed`);
  }

  // ── Month grid ─────────────────────────────────────────────
  function buildGrid() {
    const y = curDate.getFullYear(), m = curDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const grid = []; let day = 1 - firstDay;
    for (let row = 0; row < 6; row++) {
      const week = [];
      for (let col = 0; col < 7; col++, day++) {
        const inMonth = day >= 1 && day <= daysInMonth;
        const dateStr = inMonth ? `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
        const dayPosts = dateStr ? filteredPosts.filter(p => p.publish_date && String(p.publish_date).slice(0,10) === dateStr) : [];
        week.push({ day: inMonth ? day : null, dateStr, posts: dayPosts });
      }
      grid.push(week);
      if (day > daysInMonth) break;
    }
    return grid;
  }

  const filteredPosts = posts.filter(p => activeCalId === 'all' || p.calendar_id === activeCalId);
  const grid = buildGrid();

  // ── Render helpers ─────────────────────────────────────────
  function CalSidebar() {
    return (
      <div style={{ background:'var(--surface)', borderBottom: isMobile ? '1px solid var(--border)' : 'none', borderRight: isMobile ? 'none' : '1px solid var(--border)', width: isMobile ? '100%' : 240, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontWeight:800, fontSize:'.95rem' }}>📅 Calendars</div>
              {isMobile && (
                <button onClick={() => setSidebarExpanded(s => !s)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.85rem', padding:4 }}>
                  {sidebarExpanded ? '▲' : '▼'}
                </button>
              )}
            </div>
            <button onClick={() => { setEditingCal(null); setCalForm(blankCal()); setCalModal(true); }}
              style={{ background:'var(--purple)', border:'none', borderRadius:7, padding:'4px 10px', color:'#fff', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
              + New
            </button>
          </div>
        </div>

        {/* Collapsible content on mobile */}
        <div style={{ display: (!isMobile || sidebarExpanded) ? 'flex' : 'none', flexDirection:'column', flex:1, overflow:'hidden' }}>
          {/* Mini month picker */}
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <button onClick={prevMonth} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.9rem', padding:4 }}>‹</button>
              <div style={{ fontSize:'.78rem', fontWeight:700 }}>{MONTHS[curDate.getMonth()].slice(0,3)} {curDate.getFullYear()}</div>
              <button onClick={nextMonth} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.9rem', padding:4 }}>›</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, textAlign:'center' }}>
              {DAYS.map(d => <div key={d} style={{ fontSize:'.55rem', fontWeight:700, color:'var(--muted)', padding:'2px 0' }}>{d[0]}</div>)}
              {buildGrid().flat().map((cell, i) => {
                const isToday  = cell.dateStr === todayStr;
                const hasPosts = cell.posts.length > 0;
                return (
                  <button key={i} onClick={() => cell.dateStr && setSelectedDay(cell.dateStr)}
                    style={{ background: isToday ? 'var(--purple)' : selectedDay===cell.dateStr ? 'rgba(124,92,252,.2)' : 'transparent', border:'none', borderRadius:5, padding:'3px 0', fontSize:'.7rem', color: cell.day ? (isToday ? '#fff' : 'var(--muted2)') : 'var(--border)', cursor: cell.day ? 'pointer' : 'default', fontWeight: isToday ? 700 : hasPosts ? 600 : 400, position:'relative' }}>
                    {cell.day || ''}
                    {hasPosts && !isToday && <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--purple)', margin:'0 auto', marginTop:1 }}/>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar list */}
          <div style={{ flex:1, overflowY:'auto', padding:'8px 10px', maxHeight: isMobile ? 220 : undefined }}>
            <button onClick={() => { setActiveCalId('all'); setSelectedDay(null); setSidebarExpanded(false); }}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, border:'none', background: activeCalId==='all' ? 'rgba(124,92,252,.12)' : 'transparent', cursor:'pointer', fontFamily:'Inter,sans-serif', marginBottom:4, textAlign:'left', transition:'all .15s' }}>
              <div style={{ width:12, height:12, borderRadius:3, background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)', flexShrink:0 }}/>
              <span style={{ fontSize:'.83rem', fontWeight: activeCalId==='all' ? 700 : 500, color: activeCalId==='all' ? 'var(--purple2)' : 'var(--muted2)', flex:1 }}>All Calendars</span>
              <span style={{ fontSize:'.65rem', color:'var(--muted)' }}>{posts.length}</span>
            </button>

            {calendars.length === 0 && <div style={{ padding:'16px 10px', textAlign:'center', color:'var(--muted)', fontSize:'.78rem' }}>No calendars yet</div>}

            {calendars.map(cal => (
              <div key={cal.id} style={{ position:'relative', marginBottom:2 }}
                onMouseEnter={e => e.currentTarget.querySelector('.cal-btns').style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.querySelector('.cal-btns').style.opacity = '0'}>
                <button onClick={() => { setActiveCalId(cal.id); setSelectedDay(null); setSidebarExpanded(false); }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, border:'none', background: activeCalId===cal.id ? cal.color+'22' : 'transparent', cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', transition:'all .15s' }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:cal.color, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.83rem', fontWeight: activeCalId===cal.id ? 700 : 500, color: activeCalId===cal.id ? cal.color : 'var(--muted2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cal.name}</div>
                    {cal.client_name && <div style={{ fontSize:'.65rem', color:'var(--muted)' }}>{cal.client_name}</div>}
                  </div>
                  <span style={{ fontSize:'.65rem', color:'var(--muted)' }}>{cal.post_count||0}</span>
                </button>
                <div className="cal-btns" style={{ position:'absolute', top:6, right:6, display:'flex', gap:4, opacity:0, transition:'opacity .15s' }}>
                  <button onClick={() => { setEditingCal(cal); setCalForm({ name:cal.name, color:cal.color, description:cal.description||'', client_id:cal.client_id||'' }); setCalModal(true); }}
                    style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:5, padding:'2px 6px', cursor:'pointer', fontSize:'.62rem', color:'var(--muted2)' }}>✏️</button>
                  <button onClick={() => deleteCal(cal)}
                    style={{ background:'rgba(255,77,109,.1)', border:'none', borderRadius:5, padding:'2px 6px', cursor:'pointer', fontSize:'.62rem', color:'var(--red)' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
          <Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading calendar…</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(100dvh - 110px)', gap:0, overflow: isMobile ? 'auto' : 'hidden' }}>

        {/* Sidebar */}
        <CalSidebar/>

        {/* Main area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow: isMobile ? 'visible' : 'hidden', minWidth:0, minHeight: isMobile ? '70vh' : undefined }}>

          {/* Top bar */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, background:'var(--surface)', flexWrap:'wrap', rowGap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={prevMonth} style={{ background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'5px 10px', color:'var(--muted2)', cursor:'pointer', fontSize:'.8rem' }}>‹</button>
              <button onClick={goToday}   style={{ background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'5px 12px', color:'var(--muted2)', cursor:'pointer', fontSize:'.78rem', fontWeight:600 }}>Today</button>
              <button onClick={nextMonth} style={{ background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'5px 10px', color:'var(--muted2)', cursor:'pointer', fontSize:'.8rem' }}>›</button>
            </div>
            <h2 style={{ fontWeight:900, fontSize:'1rem', flex:1 }}>{MONTHS[curDate.getMonth()]} {curDate.getFullYear()}</h2>
            <div style={{ display:'flex', gap:4, background:'var(--surface2)', padding:3, borderRadius:9, border:'1px solid var(--border)' }}>
              {[['month','Month'],['list','List']].map(([v,l]) => (
                <button key={v} onClick={() => setViewMode(v)} style={{ padding:'4px 10px', borderRadius:7, border:'none', background: viewMode===v ? 'var(--surface)' : 'transparent', color: viewMode===v ? 'var(--text)' : 'var(--muted)', fontSize:'.76rem', fontWeight: viewMode===v ? 700 : 500, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>{l}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <Btn variant="ghost" size="sm" onClick={() => exportCSV('all')}>📥 Export</Btn>
              <Btn variant="ghost" size="sm" onClick={() => { setImportData([]); setImportError(''); setImportModal(true); }}>📤 Import</Btn>
              <button onClick={()=>setShowDayPanel(o=>!o)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:showDayPanel?'rgba(255,77,109,.15)':'var(--surface2)', border:`1px solid ${showDayPanel?'rgba(255,77,109,.4)':'var(--border)'}`, borderRadius:8, color:showDayPanel?'#FF4D6D':'var(--muted2)', cursor:'pointer', fontSize:'.76rem', fontWeight:600, fontFamily:'Inter,sans-serif', transition:'all .15s', whiteSpace:'nowrap' }}>
                🎉 Festivals{importantDays.length>0?' ('+importantDays.length+')':''}
              </button>
              {isAdmin && (
                <div style={{ position:'relative' }} className="clear-menu-wrap">
                  <button
                    onClick={()=>setShowClearMenu(o=>!o)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:'rgba(255,77,109,.08)', border:'1px solid rgba(255,77,109,.25)', borderRadius:8, color:'#FF4D6D', cursor:'pointer', fontSize:'.76rem', fontWeight:600, fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}>
                    🗑 Clear
                  </button>
                  {showClearMenu && (
                    <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.4)', zIndex:999, minWidth:220, overflow:'hidden' }}>
                      <div style={{ padding:'8px 12px', fontSize:'.68rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', borderBottom:'1px solid var(--border)' }}>Clear Calendar Posts</div>
                      {/* Clear specific calendar */}
                      {calendars.map(cal => (
                        <button key={cal.id}
                          onClick={async () => {
                            if (!confirm(`Clear ALL posts from "${cal.name}"? This cannot be undone.`)) return;
                            setShowClearMenu(false);
                            await fetch(`/api/calendar?clear=${cal.id}`, { method: 'DELETE' });
                            toast.success(`Cleared all posts from ${cal.name}`);
                            loadMonthPosts(new Date(currentYear, currentMonth));
                          }}
                          style={{ width:'100%', padding:'9px 14px', background:'none', border:'none', textAlign:'left', color:'var(--text)', cursor:'pointer', fontSize:'.82rem', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='none'}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background:cal.color, flexShrink:0 }}/>
                          Clear {cal.name}
                        </button>
                      ))}
                      {/* Clear ALL */}
                      <button
                        onClick={async () => {
                          if (!confirm('⚠️ Clear ALL posts from ALL calendars? This CANNOT be undone.')) return;
                          if (!confirm('Are you absolutely sure? All calendar content will be permanently deleted.')) return;
                          setShowClearMenu(false);
                          await fetch('/api/calendar?clear=all', { method: 'DELETE' });
                          toast.success('All calendar posts cleared');
                          loadMonthPosts(new Date(currentYear, currentMonth));
                        }}
                        style={{ width:'100%', padding:'10px 14px', background:'rgba(255,77,109,.08)', border:'none', textAlign:'left', color:'#FF4D6D', cursor:'pointer', fontSize:'.82rem', fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,77,109,.15)'}
                        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,77,109,.08)'}>
                        🗑 Clear ALL Calendars
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Btn onClick={() => openNewPost(selectedDay || todayStr)}>+ New Post</Btn>
          </div>

          {/* Month view */}
          {viewMode === 'month' && (
            <div style={{ flex:1, overflow:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)', background:'var(--surface2)', position:'sticky', top:0, zIndex:10 }}>
                {DAYS.map(d => <div key={d} style={{ padding: isMobile ? '8px 4px' : '10px 12px', fontSize: isMobile ? '.62rem' : '.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', textAlign:'center' }}>{isMobile ? d[0] : d}</div>)}
              </div>
              {/* Content type legend */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'8px 12px', background:'var(--surface)', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                <span style={{ fontSize:'.62rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginRight:4 }}>Types:</span>
                {Object.entries(CONTENT_TYPES).map(([type, cfg]) => (
                  <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:'.65rem', fontWeight:600, color:cfg.color, background:cfg.bg, padding:'2px 7px', borderRadius:20, whiteSpace:'nowrap' }}>
                    {cfg.emoji} {type}
                  </span>
                ))}
              </div>
              {grid.map((week, wi) => (
                <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)', minHeight: isMobile ? 70 : 120 }}>
                  {week.map((cell, ci) => {
                    const isToday = cell.dateStr === todayStr;
                    const isSel   = cell.dateStr === selectedDay;
                    return (
                      <div key={ci} onClick={() => cell.dateStr && setSelectedDay(cell.dateStr)}
                        style={{ borderRight: ci<6 ? '1px solid var(--border)' : 'none', padding: isMobile ? '5px 4px' : '8px 8px 6px', background: (() => {
                          if (isSel) return 'rgba(124,92,252,.06)';
                          if (isToday) return 'rgba(124,92,252,.04)';
                          const hasFest = cell.dateStr && importantDays.some(d => {
                            if (!d || !d.date) return false;
                            const dStr = String(d.date).slice(0, 10);
                            return d.recurring ? dStr.slice(5) === cell.dateStr.slice(5) : dStr === cell.dateStr;
                          });
                          return hasFest ? 'rgba(255,77,109,.03)' : 'transparent';
                        })(), cursor:'pointer', transition:'background .1s', position:'relative' }}>
                        {/* Festival badge for this date */}
                        {cell.dateStr && (() => {
                          const cellFestivals = importantDays.filter(d => {
                            if (!d || !d.date) return false;
                            const dStr = String(d.date).slice(0, 10);
                            if (d.recurring) return dStr.slice(5) === cell.dateStr.slice(5);
                            return dStr === cell.dateStr;
                          });
                          return cellFestivals.length > 0 ? (
                            <div style={{ marginBottom: 3 }}>
                              {cellFestivals.slice(0, 2).map(fd => (
                                <div key={fd.id}
                                  title={fd.title}
                                  style={{ display:'flex', alignItems:'center', gap:3, padding: isMobile?'1px 4px':'2px 6px', borderRadius:5, background:fd.color+'20', borderLeft:`3px solid ${fd.color}`, marginBottom:2, fontSize: isMobile?'.55rem':'.65rem', fontWeight:700, color:fd.color, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                                  <span>{fd.emoji}</span>
                                  {!isMobile && <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{fd.title}</span>}
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ width: isMobile?20:24, height: isMobile?20:24, borderRadius:'50%', background: isToday ? 'var(--purple)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize: isMobile ? '.65rem' : '.78rem', fontWeight: isToday ? 700 : 500, color: !cell.day ? 'var(--border2)' : isToday ? '#fff' : 'var(--muted2)' }}>
                            {cell.day || ''}
                          </span>
                        </div>
                        {cell.posts.slice(0, isMobile?2:3).map(p => {
                          const cal     = calendars.find(c => c.id === p.calendar_id);
                          const sc      = STATUS_CONFIG[p.status] || STATUS_CONFIG.planning;
                          const calColor = cal?.color || '#7C5CFC';
                          const ct      = CONTENT_TYPES[p.content_type];
                          // Content type color drives the pill; calendar color is the left border
                          const pillColor = ct ? ct.color : calColor;
                          const pillBg    = ct ? ct.bg    : calColor+'22';
                          return (
                            <div key={p.id} onClick={e => { e.stopPropagation(); setDetailPost(p); }}
                              title={`${p.content_type||''} · ${p.title}`}
                              style={{ padding: isMobile ? '1px 3px' : '3px 7px', borderRadius: isMobile ? 3 : 5, background: pillBg, borderLeft: `${isMobile?2:3}px solid ${calColor}`, marginBottom: isMobile ? 2 : 3, fontSize: isMobile ? '.56rem' : '.68rem', fontWeight:600, color: pillColor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer', transition:'opacity .12s' }}>
                              {ct && <span style={{marginRight:2}}>{ct.emoji}</span>}{p.title}
                            </div>
                          );
                        })}
                        {cell.posts.length > (isMobile?2:3) && <div style={{ fontSize: isMobile ? '.55rem' : '.62rem', color:'var(--muted)', padding:'0 4px' }}>+{cell.posts.length-(isMobile?2:3)}</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && (
            <div style={{ flex:1, overflow:'auto', padding:'16px 16px' }}>
              {filteredPosts.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 0', color:'var(--muted)' }}>
                  <div style={{ fontSize:'3rem', marginBottom:12 }}>📅</div>
                  <div style={{ fontWeight:700, marginBottom:8 }}>No posts this month</div>
                  <Btn onClick={() => openNewPost(todayStr)}>+ Add First Post</Btn>
                </div>
              )}
              {Object.entries(
                filteredPosts.reduce((acc, p) => {
                  const d = String(p.publish_date).slice(0,10);
                  if (!acc[d]) acc[d] = [];
                  acc[d].push(p);
                  return acc;
                }, {})
              ).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayPosts]) => (
                <div key={date} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:'.73rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10, paddingBottom:6, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                    {new Date(date+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
                    {date === todayStr && <span style={{ background:'var(--purple)', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'1px 7px', borderRadius:20 }}>Today</span>}
                  </div>
                  {dayPosts.map(p => {
                    const cal   = calendars.find(c => c.id === p.calendar_id);
                    const sc    = STATUS_CONFIG[p.status] || STATUS_CONFIG.planning;
                    const color = cal?.color || '#7C5CFC';
                    const tags  = (() => { try { return JSON.parse(p.topic_tags||'[]'); } catch { return []; } })();
                    return (
                      <div key={p.id} onClick={() => setDetailPost(p)}
                        style={{ padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderLeft:`4px solid ${(()=>{const ct=CONTENT_TYPES[p.content_type];return ct?ct.color:color;})()}`, borderRadius:10, marginBottom:8, cursor:'pointer', transition:'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = 'var(--surface3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)'; }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:sc.color, flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:3 }}>{p.title}</div>
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                              {p.platform && <span style={{ fontSize:'.7rem', background:'rgba(255,255,255,.07)', color:'var(--muted2)', padding:'1px 7px', borderRadius:20 }}>{p.platform}</span>}
                              {p.content_type && (()=>{const ct=CONTENT_TYPES[p.content_type]||CONTENT_TYPES['Other'];return <span style={{fontSize:'.7rem',background:ct.bg,color:ct.color,padding:'1px 7px',borderRadius:20,fontWeight:600}}>{ct.emoji} {p.content_type}</span>})()}
                              {p.publish_time && <span style={{ fontSize:'.7rem', color:'var(--cyan)' }}>⏰ {p.publish_time}</span>}
                              {tags.slice(0,3).map(t => <span key={t} style={{ fontSize:'.67rem', background:color+'22', color, padding:'1px 6px', borderRadius:20 }}>#{t}</span>)}
                            </div>
                          </div>
                          <span style={{ background:sc.bg, color:sc.color, fontSize:'.72rem', fontWeight:700, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' }}>{sc.emoji} {sc.label}</span>
                          {p.assignee_name && <Avatar name={p.assignee_name} image={p.assignee_image} size={26} color={color}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Create/Edit Calendar Modal ── */}
      <Modal open={calModal} onClose={() => { setCalModal(false); setEditingCal(null); }} title={editingCal ? 'Edit Calendar' : 'New Calendar'} width={420}>
        <Input label="Calendar Name *" value={calForm.name} onChange={e => setCalForm(f => ({...f, name:e.target.value}))} placeholder="e.g. Fattoush — Content"/>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:'.73rem', fontWeight:600, color:'var(--muted2)', marginBottom:8 }}>COLOR</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {CAL_COLORS.map(col => (
              <button key={col} onClick={() => setCalForm(f => ({...f, color:col}))}
                style={{ width:30, height:30, borderRadius:8, background:col, border: calForm.color===col ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', boxShadow: calForm.color===col ? `0 0 0 2px ${col}` : 'none' }}/>
            ))}
          </div>
        </div>
        <Select label="Link to Client (optional)" value={calForm.client_id} onChange={e => setCalForm(f => ({...f, client_id:e.target.value}))}>
          <option value="">— No client —</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Textarea label="Description" value={calForm.description} onChange={e => setCalForm(f => ({...f, description:e.target.value}))} placeholder="What is this calendar for?"/>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => { setCalModal(false); setEditingCal(null); }} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={saveCal} style={{ flex:2, background:calForm.color }}>{editingCal ? 'Save Changes' : 'Create Calendar'}</Btn>
        </div>
      </Modal>

      {/* ── Create/Edit Post Modal ── */}
      <Modal open={postModal} onClose={() => { setPostModal(false); setEditingPost(null); }} title={editingPost ? '✏️ Edit Post' : '+ New Content Post'} width={580}>
        <Input label="Post Title *" value={postForm.title} onChange={e => setPostForm(f => ({...f, title:e.target.value}))} placeholder="e.g. Summer Sale Reel"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Select label="Calendar *" value={postForm.calendar_id} onChange={e => setPostForm(f => ({...f, calendar_id:e.target.value}))}>
            <option value="">Select calendar</option>
            {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Status" value={postForm.status} onChange={e => setPostForm(f => ({...f, status:e.target.value}))}>
            {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </Select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Select label="Platform" value={postForm.platform} onChange={e => setPostForm(f => ({...f, platform:e.target.value}))}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:8,letterSpacing:'.04em'}}>CONTENT TYPE</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:6}}>
              {Object.entries(CONTENT_TYPES).map(([type,cfg])=>(
                <button key={type} type="button" onClick={()=>setPostForm(f=>({...f,content_type:type}))}
                  style={{padding:'7px 10px',borderRadius:9,border:`1.5px solid ${postForm.content_type===type?cfg.color:'rgba(255,255,255,.08)'}`,background:postForm.content_type===type?cfg.bg:'rgba(255,255,255,.02)',color:postForm.content_type===type?cfg.color:'var(--muted2)',fontSize:'.75rem',fontWeight:postForm.content_type===type?700:500,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:5,transition:'all .15s'}}>
                  <span>{cfg.emoji}</span>{type}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <Input label="Publish Date" type="date" value={postForm.publish_date} onChange={e => setPostForm(f => ({...f, publish_date:e.target.value}))}/>
          <Input label="Publish Time" type="time" value={postForm.publish_time} onChange={e => setPostForm(f => ({...f, publish_time:e.target.value}))}/>
          <Select label="Assign To" value={postForm.assigned_to} onChange={e => setPostForm(f => ({...f, assigned_to:e.target.value}))}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name||m.email?.split('@')[0]}</option>)}
          </Select>
        </div>
        <Textarea label="Content Description" value={postForm.content_description} onChange={e => setPostForm(f => ({...f, content_description:e.target.value}))} placeholder="Caption / content plan…"/>
        <Input label="Target Audience" value={postForm.target_audience} onChange={e => setPostForm(f => ({...f, target_audience:e.target.value}))} placeholder="e.g. Women 25-40 Chennai"/>
        <Input label="Topic Tags (comma separated)" value={postForm.topic_tags} onChange={e => setPostForm(f => ({...f, topic_tags:e.target.value}))} placeholder="summer, sale, fashion"/>
        <Textarea label="Reference Links (one per line)" value={postForm.links} onChange={e => setPostForm(f => ({...f, links:e.target.value}))} placeholder="https://drive.google.com/..."/>
        <Textarea label="Notes" value={postForm.notes} onChange={e => setPostForm(f => ({...f, notes:e.target.value}))} placeholder="Internal notes for the team…"/>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => { setPostModal(false); setEditingPost(null); }} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={savePost} style={{ flex:2 }}>{editingPost ? 'Save Changes' : 'Add Post'}</Btn>
        </div>
      </Modal>

      {/* ── Post Detail Modal ── */}
      <Modal open={!!detailPost} onClose={() => setDetailPost(null)} title={detailPost?.title || ''} width={520}>
        {detailPost && (function() {
          const cal   = calendars.find(c => c.id === detailPost.calendar_id);
          const sc    = STATUS_CONFIG[detailPost.status] || STATUS_CONFIG.planning;
          const color = cal?.color || '#7C5CFC';
          const tags  = (() => { try { return JSON.parse(detailPost.topic_tags||'[]'); } catch { return []; } })();
          const links = (() => { try { return JSON.parse(detailPost.links||'[]'); } catch { return []; } })();
          return (
            <div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                <span style={{ background:sc.bg, color:sc.color, fontSize:'.75rem', fontWeight:700, padding:'4px 12px', borderRadius:20 }}>{sc.emoji} {sc.label}</span>
                {cal && <span style={{ background:color+'22', color, fontSize:'.75rem', fontWeight:700, padding:'4px 12px', borderRadius:20 }}>📅 {cal.name}</span>}
                {detailPost.platform && <span style={{ background:'rgba(255,255,255,.07)', color:'var(--muted2)', fontSize:'.75rem', padding:'4px 12px', borderRadius:20 }}>{detailPost.platform}</span>}
                {detailPost.content_type && (()=>{const ct=CONTENT_TYPES[detailPost.content_type]||CONTENT_TYPES['Other'];return(<span style={{background:ct.bg,color:ct.color,fontSize:'.75rem',fontWeight:700,padding:'4px 12px',borderRadius:20}}>{ct.emoji} {detailPost.content_type}</span>);})()}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ padding:'10px 12px', background:'var(--surface3)', borderRadius:10 }}>
                  <div style={{ fontSize:'.65rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:4 }}>Publish</div>
                  <div style={{ fontWeight:700, fontSize:'.85rem' }}>{detailPost.publish_date ? new Date(detailPost.publish_date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'Not set'}</div>
                  {detailPost.publish_time && <div style={{ fontSize:'.75rem', color:'var(--cyan)', marginTop:2 }}>⏰ {detailPost.publish_time}</div>}
                </div>
                <div style={{ padding:'10px 12px', background:'var(--surface3)', borderRadius:10 }}>
                  <div style={{ fontSize:'.65rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:4 }}>Assigned To</div>
                  {detailPost.assignee_name
                    ? <div style={{ display:'flex', alignItems:'center', gap:7 }}><Avatar name={detailPost.assignee_name} image={detailPost.assignee_image} size={24} color={color}/><span style={{ fontWeight:600, fontSize:'.82rem' }}>{detailPost.assignee_name}</span></div>
                    : <div style={{ color:'var(--muted)', fontSize:'.82rem' }}>Unassigned</div>}
                </div>
              </div>
              {detailPost.content_description && <div style={{ fontSize:'.83rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:14, padding:'10px 12px', background:'var(--surface3)', borderRadius:10 }}>{detailPost.content_description}</div>}
              {detailPost.target_audience && <div style={{ fontSize:'.8rem', color:'var(--muted2)', marginBottom:12 }}>🎯 <strong>Audience:</strong> {detailPost.target_audience}</div>}
              {tags.length > 0 && <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>{tags.map(t => <span key={t} style={{ background:color+'22', color, fontSize:'.72rem', fontWeight:600, padding:'2px 9px', borderRadius:20 }}>#{t}</span>)}</div>}
              {links.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>References</div>
                  {links.map((l,i) => <a key={i} href={l} target="_blank" rel="noopener noreferrer" style={{ display:'block', fontSize:'.78rem', color:'var(--purple2)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🔗 {l}</a>)}
                </div>
              )}
              {detailPost.notes && <div style={{ fontSize:'.8rem', color:'var(--muted)', fontStyle:'italic', marginBottom:14, padding:'8px 12px', background:'rgba(255,255,255,.03)', borderRadius:8 }}>📝 {detailPost.notes}</div>}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:'.68rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>Change Status</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(STATUS_CONFIG).map(([k,v]) => (
                    <button key={k} onClick={() => quickStatus(detailPost, k)}
                      style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${detailPost.status===k ? v.color : 'rgba(255,255,255,.1)'}`, background: detailPost.status===k ? v.bg : 'transparent', color: detailPost.status===k ? v.color : 'var(--muted2)', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s' }}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="ghost" onClick={() => openEditPost(detailPost)} style={{ flex:1 }}>✏️ Edit</Btn>
                <Btn variant="danger" onClick={() => deletePost(detailPost)}>🗑 Delete</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Import Modal ── */}
      <Modal open={importModal} onClose={() => { setImportModal(false); setImportData([]); setImportError(''); }} title="📤 Import Calendar Posts" width={560}>
        <div style={{ padding:'14px 16px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.2)', borderRadius:12, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:6 }}>Step 1 — Download the template</div>
          <div style={{ fontSize:'.78rem', color:'var(--muted2)', marginBottom:12 }}>Fill in your posts, then upload the CSV below.</div>
          <Btn variant="ghost" size="sm" onClick={downloadTemplate}>📥 Download Template CSV</Btn>
        </div>
        <div style={{ padding:'14px 16px', background:'rgba(124,92,252,.06)', border:'1px solid rgba(124,92,252,.2)', borderRadius:12, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:'.85rem', marginBottom:10 }}>Step 2 — Upload your filled CSV</div>
          <label style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--surface3)', border:'2px dashed rgba(124,92,252,.4)', borderRadius:10, cursor:'pointer' }}>
            <span style={{ fontSize:'1.5rem' }}>📂</span>
            <div>
              <div style={{ fontSize:'.82rem', fontWeight:600 }}>{importData.length > 0 ? `✅ ${importData.length} rows ready` : 'Choose CSV file'}</div>
              <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>Click to browse</div>
            </div>
            <input type="file" accept=".csv,text/csv" style={{ display:'none' }} onChange={handleImportFile}/>
          </label>
          {importError && <div style={{ fontSize:'.78rem', color:'var(--red)', marginTop:8 }}>⚠️ {importError}</div>}
        </div>
        {importData.length > 0 && (
          <div style={{ marginBottom:16, maxHeight:180, overflowY:'auto', border:'1px solid var(--border)', borderRadius:10 }}>
            {importData.slice(0,5).map((row, i) => {
              const calName   = row['calendarname']||row['calendar']||'';
              const matchedCal = calendars.find(c => c.name.toLowerCase() === calName.toLowerCase());
              return (
                <div key={i} style={{ padding:'9px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
                  {matchedCal ? <div style={{ width:8, height:8, borderRadius:3, background:matchedCal.color, flexShrink:0 }}/> : <span style={{ fontSize:'.7rem', color:'var(--red)' }}>⚠️</span>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.8rem', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row['title']||'(no title)'}</div>
                    <div style={{ fontSize:'.68rem', color:'var(--muted)' }}>{matchedCal ? matchedCal.name : <span style={{ color:'var(--red)' }}>No match: "{calName}"</span>}{row['publishdate']||row['publishdateyyymmdd'] ? ` · ${row['publishdate']||row['publishdateyyymmdd']}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => { setImportModal(false); setImportData([]); setImportError(''); }} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={runImport} disabled={importing || importData.length === 0} style={{ flex:2, opacity: importData.length===0 ? .5 : 1 }}>
            {importing ? '⏳ Importing…' : `📤 Import ${importData.length} Posts`}
          </Btn>
        </div>
      </Modal>
      {/* ── FESTIVALS PANEL ── */}
      {showDayPanel && (
        <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'min(340px,100vw)', background:'var(--surface)', borderLeft:'1px solid var(--border2)', zIndex:998, display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,.4)', animation:'slideInRight .2s ease' }}>
          <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ fontWeight:900, fontSize:'1rem' }}>🎉 Festivals & Important Days</div>
            <button onClick={()=>setShowDayPanel(false)} style={{ background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:8, width:28, height:28, cursor:'pointer', color:'var(--muted2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.85rem' }}>✕</button>
          </div>

          {/* Add form */}
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ fontSize:'.7rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Add Important Day</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', gap:8 }}>
                <input value={dayForm.emoji} onChange={e=>setDayForm(f=>({...f,emoji:e.target.value}))}
                  style={{ width:48, background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 4px', fontSize:'1.1rem', textAlign:'center', color:'var(--text)', fontFamily:'inherit', outline:'none' }}
                  placeholder="🎉" maxLength={4}/>
                <input value={dayForm.title} onChange={e=>setDayForm(f=>({...f,title:e.target.value}))}
                  placeholder="Festival or event name…"
                  style={{ flex:1, background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 10px', fontSize:'.82rem', color:'var(--text)', fontFamily:'inherit', outline:'none' }}
                  onKeyDown={e=>{ if(e.key==='Enter') document.getElementById('add-day-btn').click(); }}/>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input type="date" value={dayForm.date} onChange={e=>setDayForm(f=>({...f,date:e.target.value}))}
                  style={{ flex:1, background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 10px', fontSize:'.82rem', color:'var(--text)', fontFamily:'inherit', outline:'none' }}/>
                <input type="color" value={dayForm.color} onChange={e=>setDayForm(f=>({...f,color:e.target.value}))}
                  title="Pick colour" style={{ width:40, height:38, padding:2, background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, cursor:'pointer' }}/>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.78rem', color:'var(--muted2)', cursor:'pointer' }}>
                <input type="checkbox" checked={dayForm.recurring} onChange={e=>setDayForm(f=>({...f,recurring:e.target.checked}))} style={{ accentColor:'var(--purple)', width:15, height:15 }}/>
                Repeat every year
              </label>
              <button id="add-day-btn"
                disabled={addingDay || !dayForm.title.trim() || !dayForm.date}
                onClick={async()=>{
                  setAddingDay(true);
                  try {
                    await fetch('/api/important-days',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dayForm)});
                    setDayForm({title:'',date:'',color:'#FF4D6D',emoji:'🎉',recurring:true});
                    await loadImportantDays();
                  } catch(e) {}
                  setAddingDay(false);
                }}
                style={{ padding:'9px', background:'linear-gradient(135deg,#FF4D6D,#FF9F43)', border:'none', borderRadius:9, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'.82rem', fontFamily:'inherit', opacity:addingDay||!dayForm.title.trim()||!dayForm.date?0.5:1 }}>
                {addingDay ? '⏳ Adding…' : '🎉 Add to Calendar'}
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 18px' }}>
            {importantDays.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted2)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:8, opacity:.4 }}>🎉</div>
                <div style={{ fontSize:'.82rem' }}>No important days yet.<br/>Add Diwali, Pongal, birthdays…</div>
              </div>
            )}
            {importantDays.map(day => {
              const d = new Date(day.date + 'T00:00:00');
              const isToday = day.date === todayStr;
              const isPast  = new Date(day.date + 'T23:59:59') < new Date() && !isToday;
              return (
                <div key={day.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:isToday?day.color+'11':'var(--surface2)', border:`1px solid ${isToday?day.color+'55':'var(--border)'}`, borderRadius:10, marginBottom:6, opacity:isPast?0.5:1 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:day.color+'22', border:`1.5px solid ${day.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>
                    {day.emoji}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{day.title}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:2 }}>
                      {d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
                      {day.recurring && <span style={{ marginLeft:6, color:day.color, fontWeight:600 }}>↻ yearly</span>}
                    </div>
                  </div>
                  {isToday && <span style={{ fontSize:'.6rem', fontWeight:800, color:day.color, background:day.color+'18', padding:'2px 7px', borderRadius:20, flexShrink:0 }}>TODAY</span>}
                  <button onClick={async()=>{ await fetch('/api/important-days?id='+day.id,{method:'DELETE'}); loadImportantDays(); }}
                    style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.8rem', padding:4, opacity:.5, flexShrink:0 }}>🗑</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </Layout>
  );
}
