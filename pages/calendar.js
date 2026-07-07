import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Select, Textarea, Avatar, Spinner, Tag, toast, MEMBER_COLORS } from '../components/UI';

const STATUS_CONFIG = {
  planning:    { label:'Planning',    color:'#9090AA', bg:'rgba(144,144,170,.15)', emoji:'🗓' },
  in_progress: { label:'In Progress', color:'#00D4FF', bg:'rgba(0,212,255,.15)',   emoji:'⚡' },
  review:      { label:'Review',      color:'#FFD60A', bg:'rgba(255,214,10,.15)',   emoji:'👁️' },
  approved:    { label:'Approved',    color:'#7C5CFC', bg:'rgba(124,92,252,.15)',   emoji:'✅' },
  scheduled:   { label:'Scheduled',   color:'#FF9F43', bg:'rgba(255,159,67,.15)',   emoji:'📅' },
  live:        { label:'Live',        color:'#00E5A0', bg:'rgba(0,229,160,.15)',    emoji:'🟢' },
  cancelled:   { label:'Cancelled',   color:'#FF4D6D', bg:'rgba(255,77,109,.15)',   emoji:'❌' },
};

const PLATFORMS = ['Instagram','Facebook','Twitter/X','LinkedIn','YouTube','TikTok','Pinterest','Snapchat','WhatsApp','Email','Website','Other'];
const CONTENT_TYPES = ['Reel','Story','Carousel','Static Post','Video','Blog','Newsletter','Ad Creative','UGC','Infographic','Other'];
const CALENDAR_COLORS = ['#7C5CFC','#FF5FA0','#00D4FF','#FFD60A','#00E5A0','#FF9F43','#FF4D6D','#A78BFA','#34D399','#60A5FA'];

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function req(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined });
  return r.json();
}

function blankPost(calId='') {
  return { calendar_id:calId, title:'', content_description:'', platform:'Instagram', content_type:'Reel', status:'planning', assigned_to:'', topic_tags:'', target_audience:'', publish_date:'', publish_time:'09:00', links:'', notes:'' };
}

function blankCal() {
  return { name:'', color:'#7C5CFC', description:'', client_id:'' };
}

export default function Calendar() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';

  const [calendars,   setCalendars]   = useState([]);
  const [posts,       setPosts]       = useState([]);
  const [members,     setMembers]     = useState([]);
  const [clients,     setClients]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeCalId, setActiveCalId] = useState('all');
  const [viewMode,    setViewMode]    = useState('month'); // month | list
  const [curDate,     setCurDate]     = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Modals
  const [calModal,    setCalModal]    = useState(false);
  const [editingCal,  setEditingCal]  = useState(null);
  const [calForm,     setCalForm]     = useState(blankCal());
  const [postModal,   setPostModal]   = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [postForm,    setPostForm]    = useState(blankPost());
  const [detailPost,  setDetailPost]  = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [importData,  setImportData]  = useState([]); // parsed rows
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [cals, ms, cls] = await Promise.all([
      req('/api/calendar'),
      req('/api/members'),
      req('/api/clients'),
    ]);
    setCalendars(Array.isArray(cals) ? cals : []);
    setMembers(Array.isArray(ms) ? ms : []);
    setClients(Array.isArray(cls) ? cls : []);

    // Load posts for current month range
    const y = curDate.getFullYear(), m = curDate.getMonth();
    const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m+1, 0).getDate();
    const to = `${y}-${String(m+1).padStart(2,'0')}-${lastDay}`;
    const ps = await req(`/api/calendar?from=${from}&to=${to}`);
    setPosts(Array.isArray(ps) ? ps : []);
    setLoading(false);
  }, [curDate]);

  useEffect(() => { if (status === 'authenticated') load(); }, [status, load]);

  // Load posts when month changes
  async function loadMonthPosts(date) {
    const y = date.getFullYear(), m = date.getMonth();
    const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m+1, 0).getDate();
    const to = `${y}-${String(m+1).padStart(2,'0')}-${lastDay}`;
    const ps = await req(`/api/calendar?from=${from}&to=${to}`);
    setPosts(Array.isArray(ps) ? ps : []);
  }

  function prevMonth() { const d = new Date(curDate.getFullYear(), curDate.getMonth()-1, 1); setCurDate(d); loadMonthPosts(d); }
  function nextMonth() { const d = new Date(curDate.getFullYear(), curDate.getMonth()+1, 1); setCurDate(d); loadMonthPosts(d); }
  function goToday()   { const d = new Date(); setCurDate(d); loadMonthPosts(d); }

  // ── CALENDAR CRUD ───────────────────────────────────────────
  async function saveCal() {
    if (!calForm.name.trim()) { toast.error('Name required'); return; }
    if (editingCal) {
      await req('/api/calendar','PATCH',{ id:editingCal.id, type:'calendar', ...calForm });
      toast.success('Calendar updated!');
    } else {
      await req('/api/calendar','POST',{ type:'calendar', ...calForm });
      toast.success('Calendar created! 🎉');
    }
    setCalModal(false); setEditingCal(null); setCalForm(blankCal()); load();
  }

  async function deleteCal(cal) {
    if (!confirm(`Delete "${cal.name}"? All posts will be removed.`)) return;
    await req('/api/calendar?id='+cal.id+'&type=calendar','DELETE');
    toast.info('Calendar deleted');
    if (activeCalId === cal.id) setActiveCalId('all');
    load();
  }

  // ── POST CRUD ───────────────────────────────────────────────
  function openNewPost(date='') {
    const calId = activeCalId !== 'all' ? activeCalId : (calendars[0]?.id || '');
    setEditingPost(null);
    setPostForm({ ...blankPost(calId), publish_date: date });
    setPostModal(true);
  }

  function openEditPost(post) {
    setDetailPost(null);
    setEditingPost(post);
    setPostForm({
      calendar_id:         post.calendar_id,
      title:               post.title,
      content_description: post.content_description || '',
      platform:            post.platform || 'Instagram',
      content_type:        post.content_type || 'Reel',
      status:              post.status || 'planning',
      assigned_to:         post.assigned_to || '',
      topic_tags:          (JSON.parse(post.topic_tags||'[]')).join(', '),
      target_audience:     post.target_audience || '',
      publish_date:        post.publish_date ? String(post.publish_date).slice(0,10) : '',
      publish_time:        post.publish_time || '09:00',
      links:               (JSON.parse(post.links||'[]')).join('\n'),
      notes:               post.notes || '',
    });
    setPostModal(true);
  }

  async function savePost() {
    if (!postForm.title.trim())    { toast.error('Title required'); return; }
    if (!postForm.calendar_id)     { toast.error('Select a calendar'); return; }
    const payload = {
      ...postForm,
      topic_tags: JSON.stringify(postForm.topic_tags.split(',').map(t=>t.trim()).filter(Boolean)),
      links:      JSON.stringify(postForm.links.split('\n').map(l=>l.trim()).filter(Boolean)),
    };
    if (editingPost) {
      await req('/api/calendar','PATCH',{ id:editingPost.id, type:'post', ...payload });
      toast.success('Post updated!');
    } else {
      await req('/api/calendar','POST',{ type:'post', ...payload });
      toast.success('Post added! 📅');
    }
    setPostModal(false); setEditingPost(null);
    loadMonthPosts(curDate);
  }

  async function deletePost(post) {
    if (!confirm(`Delete "${post.title}"?`)) return;
    await req('/api/calendar?id='+post.id+'&type=post','DELETE');
    toast.info('Post deleted');
    setDetailPost(null);
    loadMonthPosts(curDate);
  }

  // ── EXPORT ──────────────────────────────────────────────────
  function exportCSV(calIdOverride) {
    const calId = calIdOverride || activeCalId;
    const targetPosts = calId === 'all' ? filteredPosts : filteredPosts.filter(p => p.calendar_id === calId);
    const cal = calendars.find(c => c.id === calId);
    const calName = cal ? cal.name : 'All-Calendars';
    const monthLabel = `${MONTHS[curDate.getMonth()]}-${curDate.getFullYear()}`;

    const header = ['Calendar','Title','Platform','Content Type','Status','Publish Date','Publish Time','Assigned To','Topic Tags','Target Audience','Content Description','Notes','Reference Links'];
    const rows = targetPosts.map(p => {
      const tags  = (() => { try { return JSON.parse(p.topic_tags||'[]').join(', '); } catch { return ''; } })();
      const links = (() => { try { return JSON.parse(p.links||'[]').join(' | '); } catch { return ''; } })();
      const status = STATUS_CONFIG[p.status]?.label || p.status;
      return [
        p.calendar_name || calName,
        p.title,
        p.platform || '',
        p.content_type || '',
        status,
        p.publish_date ? String(p.publish_date).slice(0,10) : '',
        p.publish_time || '',
        p.assignee_name || '',
        tags,
        p.target_audience || '',
        p.content_description || '',
        p.notes || '',
        links,
      ];
    });

    const csv = [header, ...rows].map(row =>
      row.map(cell => '"' + String(cell||'').replace(/"/g,'""') + '"').join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${calName.replace(/[^a-z0-9]/gi,'-')}-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${targetPosts.length} posts as CSV 📥`);
  }

  function downloadTemplate() {
    const header = ['Calendar Name','Title','Platform','Content Type','Status','Publish Date (YYYY-MM-DD)','Publish Time (HH:MM)','Assigned To (Name)','Topic Tags (comma separated)','Target Audience','Content Description','Notes','Reference Links (pipe separated)'];
    const example = [
      calendars[0]?.name || 'Brand Name',
      'Summer Sale Reel',
      'Instagram',
      'Reel',
      'Planning',
      `${curDate.getFullYear()}-${String(curDate.getMonth()+1).padStart(2,'0')}-15`,
      '09:00',
      '',
      'summer, sale, fashion',
      'Women 25-40 Chennai',
      'Show the new summer collection with trending audio',
      'Use bright colors, energetic vibe',
      'https://drive.google.com/file | https://figma.com/file',
    ];
    const csv = [header, example].map(row =>
      row.map(cell => '"' + String(cell||'').replace(/"/g,'""') + '"').join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `calendar-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info('Template downloaded — fill it in and import');
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    // Parse CSV respecting quoted fields
    function parseLine(line) {
      const result = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
          result.push(cur.trim()); cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g,''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseLine(lines[i]);
      const row  = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
      rows.push(row);
    }
    return rows;
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCSV(ev.target.result);
        if (!rows.length) { setImportError('No data rows found in file'); return; }
        setImportData(rows);
      } catch(err) {
        setImportError('Could not parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function runImport() {
    if (!importData.length) return;
    setImporting(true);
    let successCount = 0, errorCount = 0;

    for (const row of importData) {
      try {
        // Match calendar by name (case-insensitive)
        const calName = row['calendarname'] || row['calendar'] || '';
        const matchedCal = calendars.find(cal =>
          cal.name.toLowerCase() === calName.toLowerCase()
        ) || (activeCalId !== 'all' ? calendars.find(c=>c.id===activeCalId) : calendars[0]);

        if (!matchedCal) { errorCount++; continue; }

        // Match assignee by name
        const assigneeName = row['assignedtoname'] || row['assignedto'] || '';
        const matchedMember = members.find(m =>
          (m.name||'').toLowerCase() === assigneeName.toLowerCase()
        );

        // Parse status
        const statusInput = (row['status'] || 'planning').toLowerCase().replace(/ /g,'_');
        const validStatuses = Object.keys(STATUS_CONFIG);
        const statusMap = { 'in_progress':'in_progress', 'inprogress':'in_progress', 'planning':'planning', 'review':'review', 'approved':'approved', 'scheduled':'scheduled', 'live':'live', 'cancelled':'cancelled' };
        const status = statusMap[statusInput] || (validStatuses.find(s => STATUS_CONFIG[s].label.toLowerCase() === statusInput.replace(/_/g,' '))) || 'planning';

        // Parse platform
        const platformInput = row['platform'] || 'Instagram';
        const platform = PLATFORMS.find(p => p.toLowerCase() === platformInput.toLowerCase()) || platformInput || 'Instagram';

        // Parse content type
        const ctInput = row['contenttype'] || row['type'] || 'Reel';
        const content_type = CONTENT_TYPES.find(t => t.toLowerCase() === ctInput.toLowerCase()) || ctInput || 'Reel';

        // Tags
        const tagsRaw = row['topictagscommaseparated'] || row['topictags'] || row['tags'] || '';
        const topic_tags = JSON.stringify(tagsRaw.split(',').map(t=>t.trim()).filter(Boolean));

        // Links
        const linksRaw = row['referencelinks'] || row['links'] || '';
        const links = JSON.stringify(linksRaw.split('|').map(l=>l.trim()).filter(Boolean));

        const payload = {
          type:                'post',
          calendar_id:         matchedCal.id,
          title:               row['title'] || 'Imported Post',
          platform,
          content_type,
          status,
          publish_date:        row['publishdateyyymmdd'] || row['publishdate'] || row['date'] || '',
          publish_time:        row['publishtimehhmm'] || row['publishtime'] || row['time'] || '09:00',
          assigned_to:         matchedMember?.id || null,
          topic_tags,
          target_audience:     row['targetaudience'] || '',
          content_description: row['contentdescription'] || row['description'] || '',
          notes:               row['notes'] || '',
          links,
        };

        const result = await req('/api/calendar', 'POST', payload);
        if (result.error) errorCount++;
        else successCount++;
      } catch(e) {
        errorCount++;
      }
    }

    setImporting(false);
    setImportModal(false);
    setImportData([]);
    loadMonthPosts(curDate);

    if (successCount > 0) toast.success(`Imported ${successCount} posts successfully! 🎉`);
    if (errorCount > 0)   toast.error(`${errorCount} rows had errors (missing calendar match)`);
  }

  // ── CALENDAR GRID ────────────────────────────────────────────
  const filteredPosts = posts.filter(p =>
    activeCalId === 'all' || p.calendar_id === activeCalId
  );

  function buildMonthGrid() {
    const y = curDate.getFullYear(), m = curDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const grid = [];
    let day = 1 - firstDay;
    for (let row = 0; row < 6; row++) {
      const week = [];
      for (let col = 0; col < 7; col++, day++) {
        const isCurrentMonth = day >= 1 && day <= daysInMonth;
        const dateStr = isCurrentMonth ? `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
        const dayPosts = dateStr ? filteredPosts.filter(p => p.publish_date && String(p.publish_date).slice(0,10) === dateStr) : [];
        week.push({ day: isCurrentMonth ? day : null, dateStr, posts: dayPosts });
      }
      grid.push(week);
      if (day > daysInMonth) break;
    }
    return grid;
  }

  const grid = buildMonthGrid();
  const todayStr = new Date().toISOString().split('T')[0];
  const activeCal = calendars.find(c => c.id === activeCalId);

  if (loading) return (
    <Layout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
        <Spinner size={28}/><span style={{color:'var(--muted2)'}}>Loading calendar…</span>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{display:'flex',height:'calc(100dvh - 110px)',gap:0,overflow:'hidden'}}>

        {/* ── LEFT SIDEBAR: Calendar list ──────────────── */}
        <div style={{width:240,minWidth:240,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
          {/* Header */}
          <div style={{padding:'14px 14px 10px',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:'.95rem'}}>📅 Calendars</div>
              <button onClick={()=>{setEditingCal(null);setCalForm(blankCal());setCalModal(true);}}
                style={{background:'var(--purple)',border:'none',borderRadius:7,padding:'4px 10px',color:'#fff',fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                + New
              </button>
            </div>
          </div>

          {/* Mini month picker */}
          <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <button onClick={prevMonth} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'.9rem',padding:4}}>‹</button>
              <div style={{fontSize:'.78rem',fontWeight:700,color:'var(--text)'}}>{MONTHS[curDate.getMonth()].slice(0,3)} {curDate.getFullYear()}</div>
              <button onClick={nextMonth} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'.9rem',padding:4}}>›</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,textAlign:'center'}}>
              {DAYS.map(d=><div key={d} style={{fontSize:'.55rem',fontWeight:700,color:'var(--muted)',padding:'2px 0'}}>{d.slice(0,1)}</div>)}
              {buildMonthGrid().flat().map((cell,i)=>{
                const isToday = cell.dateStr === todayStr;
                const hasPosts = cell.posts.length > 0;
                return (
                  <button key={i} onClick={()=>cell.dateStr&&setSelectedDay(cell.dateStr)}
                    style={{background:isToday?'var(--purple)':selectedDay===cell.dateStr?'rgba(124,92,252,.2)':'transparent',border:'none',borderRadius:5,padding:'3px 0',fontSize:'.7rem',color:cell.day?isToday?'#fff':'var(--muted2)':'var(--border)',cursor:cell.day?'pointer':'default',fontWeight:isToday?700:hasPosts?600:400,position:'relative'}}>
                    {cell.day||''}
                    {hasPosts&&!isToday&&<div style={{width:4,height:4,borderRadius:'50%',background:'var(--purple)',margin:'0 auto',marginTop:1}}/>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar list */}
          <div style={{flex:1,overflowY:'auto',padding:'8px 10px'}}>
            {/* All calendars option */}
            <button onClick={()=>{setActiveCalId('all');setSelectedDay(null);}}
              style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:9,border:'none',background:activeCalId==='all'?'rgba(124,92,252,.12)':'transparent',cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:4,textAlign:'left',transition:'all .15s'}}
              onMouseEnter={e=>{if(activeCalId!=='all')e.currentTarget.style.background='var(--surface2)';}}
              onMouseLeave={e=>{if(activeCalId!=='all')e.currentTarget.style.background='transparent';}}>
              <div style={{width:12,height:12,borderRadius:3,background:'linear-gradient(135deg,#7C5CFC,#FF5FA0)',flexShrink:0}}/>
              <span style={{fontSize:'.83rem',fontWeight:activeCalId==='all'?700:500,color:activeCalId==='all'?'var(--purple2)':'var(--muted2)',flex:1}}>All Calendars</span>
              <span style={{fontSize:'.65rem',color:'var(--muted)'}}>{posts.length}</span>
            </button>

            {calendars.length === 0 && <div style={{padding:'16px 10px',textAlign:'center',color:'var(--muted)',fontSize:'.78rem'}}>No calendars yet. Create one!</div>}

            {calendars.map(cal => (
              <div key={cal.id} style={{position:'relative',marginBottom:2}}>
                <button onClick={()=>{setActiveCalId(cal.id);setSelectedDay(null);}}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:9,border:'none',background:activeCalId===cal.id?cal.color+'22':'transparent',cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'all .15s'}}
                  onMouseEnter={e=>{if(activeCalId!==cal.id)e.currentTarget.style.background='var(--surface2)';}}
                  onMouseLeave={e=>{if(activeCalId!==cal.id)e.currentTarget.style.background='transparent';}}>
                  <div style={{width:12,height:12,borderRadius:3,background:cal.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'.83rem',fontWeight:activeCalId===cal.id?700:500,color:activeCalId===cal.id?cal.color:'var(--muted2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{cal.name}</div>
                    {cal.client_name&&<div style={{fontSize:'.65rem',color:'var(--muted)'}}>{cal.client_name}</div>}
                  </div>
                  <span style={{fontSize:'.65rem',color:'var(--muted)'}}>{cal.post_count||0}</span>
                </button>
                {/* Edit/Delete on hover */}
                <div style={{position:'absolute',top:6,right:6,display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>{setEditingCal(cal);setCalForm({name:cal.name,color:cal.color,description:cal.description||'',client_id:cal.client_id||''});setCalModal(true);}}
                    style={{background:'rgba(255,255,255,.06)',border:'none',borderRadius:5,padding:'2px 6px',cursor:'pointer',fontSize:'.62rem',color:'var(--muted)',opacity:0,transition:'opacity .15s'}}
                    className="cal-action">✏️</button>
                  <button onClick={()=>deleteCal(cal)}
                    style={{background:'rgba(255,77,109,.1)',border:'none',borderRadius:5,padding:'2px 6px',cursor:'pointer',fontSize:'.62rem',color:'var(--red)',opacity:0,transition:'opacity .15s'}}
                    className="cal-action">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN: Calendar view ──────────────────────── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

          {/* Top bar */}
          <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,flexShrink:0,background:'var(--surface)'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={prevMonth} style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:8,padding:'5px 10px',color:'var(--muted2)',cursor:'pointer',fontSize:'.8rem'}}>‹</button>
              <button onClick={goToday}   style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:8,padding:'5px 12px',color:'var(--muted2)',cursor:'pointer',fontSize:'.78rem',fontWeight:600}}>Today</button>
              <button onClick={nextMonth} style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:8,padding:'5px 10px',color:'var(--muted2)',cursor:'pointer',fontSize:'.8rem'}}>›</button>
            </div>
            <h2 style={{fontWeight:900,fontSize:'1.1rem',flex:1}}>{MONTHS[curDate.getMonth()]} {curDate.getFullYear()}</h2>

            {/* View toggle */}
            <div style={{display:'flex',gap:4,background:'var(--surface2)',padding:3,borderRadius:9,border:'1px solid var(--border)'}}>
              {[['month','Month'],['list','List']].map(([v,l])=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'4px 12px',borderRadius:7,border:'none',background:viewMode===v?'var(--surface)':'transparent',color:viewMode===v?'var(--text)':'var(--muted)',fontSize:'.76rem',fontWeight:viewMode===v?700:500,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:viewMode===v?'var(--shadow)':'none'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Export/Import buttons */}
            <div style={{display:'flex',gap:6}}>
              <div style={{position:'relative',display:'inline-block'}}>
                <button
                  style={{padding:'7px 14px',background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:10,color:'var(--muted2)',fontSize:'.8rem',fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:6}}
                  onClick={e=>{e.currentTarget.nextSibling.style.display=e.currentTarget.nextSibling.style.display==='block'?'none':'block';}}>
                  📥 Export ▾
                </button>
                <div style={{display:'none',position:'absolute',top:'calc(100% + 6px)',right:0,background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:12,padding:8,zIndex:100,minWidth:200,boxShadow:'var(--shadow-lg)'}}>
                  <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',padding:'4px 10px 8px',letterSpacing:'.08em'}}>
                    {MONTHS[curDate.getMonth()]} {curDate.getFullYear()}
                  </div>
                  <button onClick={()=>exportCSV('all')} style={{display:'block',width:'100%',padding:'8px 12px',background:'none',border:'none',borderRadius:8,color:'var(--text)',fontSize:'.82rem',cursor:'pointer',textAlign:'left',fontFamily:'Inter,sans-serif'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    📊 All Calendars
                  </button>
                  {calendars.map(cal=>(
                    <button key={cal.id} onClick={()=>exportCSV(cal.id)} style={{display:'block',width:'100%',padding:'8px 12px',background:'none',border:'none',borderRadius:8,color:'var(--text)',fontSize:'.82rem',cursor:'pointer',textAlign:'left',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:8}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <div style={{width:10,height:10,borderRadius:3,background:cal.color,flexShrink:0}}/>
                      {cal.name}
                    </button>
                  ))}
                </div>
              </div>
              <Btn variant="ghost" onClick={()=>{setImportData([]);setImportError('');setImportModal(true);}}>📤 Import</Btn>
            </div>
            <Btn onClick={()=>openNewPost(selectedDay||todayStr)}>+ New Post</Btn>
          </div>

          {/* ── MONTH VIEW ─────────────────────────────── */}
          {viewMode==='month'&&(
            <div style={{flex:1,overflow:'auto',padding:'0 0 16px'}}>
              {/* Day headers */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--surface2)',zIndex:10}}>
                {DAYS.map(d=>(
                  <div key={d} style={{padding:'10px 12px',fontSize:'.72rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',textAlign:'center'}}>{d}</div>
                ))}
              </div>
              {/* Grid rows */}
              {grid.map((week,wi)=>(
                <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1px solid var(--border)',minHeight:120}}>
                  {week.map((cell,ci)=>{
                    const isToday  = cell.dateStr === todayStr;
                    const isSel    = cell.dateStr === selectedDay;
                    const otherMon = !cell.day;
                    return (
                      <div key={ci}
                        onClick={()=>{ if(cell.dateStr){setSelectedDay(cell.dateStr);} }}
                        style={{borderRight:ci<6?'1px solid var(--border)':'none',padding:'8px 8px 6px',background:isSel?'rgba(124,92,252,.06)':isToday?'rgba(124,92,252,.04)':'transparent',cursor:'pointer',transition:'background .1s',minHeight:120,position:'relative'}}
                        onMouseEnter={e=>{ if(!isSel)e.currentTarget.style.background='rgba(255,255,255,.02)'; }}
                        onMouseLeave={e=>{ if(!isSel)e.currentTarget.style.background=isToday?'rgba(124,92,252,.04)':'transparent'; }}>
                        {/* Day number */}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                          <span style={{width:24,height:24,borderRadius:'50%',background:isToday?'var(--purple)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.78rem',fontWeight:isToday?700:500,color:otherMon?'var(--border2)':isToday?'#fff':'var(--muted2)'}}>
                            {cell.day||''}
                          </span>
                          {cell.dateStr&&cell.posts.length===0&&<button onClick={e=>{e.stopPropagation();openNewPost(cell.dateStr);}} style={{background:'none',border:'none',color:'var(--border2)',cursor:'pointer',fontSize:'.75rem',padding:2,opacity:0,transition:'opacity .15s'}} className="add-post-btn">+</button>}
                        </div>
                        {/* Posts on this day */}
                        {cell.posts.slice(0,3).map((p,pi)=>{
                          const cal   = calendars.find(c=>c.id===p.calendar_id);
                          const sc    = STATUS_CONFIG[p.status] || STATUS_CONFIG.planning;
                          const color = cal?.color || '#7C5CFC';
                          return (
                            <div key={p.id}
                              onClick={e=>{e.stopPropagation();setDetailPost(p);}}
                              style={{padding:'3px 7px',borderRadius:5,background:color+'22',borderLeft:'3px solid '+color,marginBottom:3,fontSize:'.68rem',fontWeight:600,color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',cursor:'pointer',transition:'all .12s'}}
                              onMouseEnter={e=>e.currentTarget.style.background=color+'44'}
                              onMouseLeave={e=>e.currentTarget.style.background=color+'22'}>
                              {sc.emoji} {p.title}
                            </div>
                          );
                        })}
                        {cell.posts.length > 3 && <div style={{fontSize:'.62rem',color:'var(--muted)',padding:'2px 7px'}}>+{cell.posts.length-3} more</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ── LIST VIEW ──────────────────────────────── */}
          {viewMode==='list'&&(
            <div style={{flex:1,overflow:'auto',padding:'16px 18px'}}>
              {filteredPosts.length===0&&(
                <div style={{textAlign:'center',padding:'60px 0',color:'var(--muted)'}}>
                  <div style={{fontSize:'3rem',marginBottom:12}}>📅</div>
                  <div style={{fontWeight:700,marginBottom:8}}>No posts this month</div>
                  <Btn onClick={()=>openNewPost(todayStr)}>+ Add First Post</Btn>
                </div>
              )}
              {Object.entries(
                filteredPosts.reduce((acc,p)=>{
                  const d=String(p.publish_date).slice(0,10);
                  if(!acc[d])acc[d]=[];
                  acc[d].push(p);
                  return acc;
                },{})
              ).sort(([a],[b])=>a.localeCompare(b)).map(([date,dayPosts])=>(
                <div key={date} style={{marginBottom:20}}>
                  <div style={{fontSize:'.73rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--border)'}}>
                    {new Date(date+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
                    {date===todayStr&&<span style={{marginLeft:8,background:'var(--purple)',color:'#fff',fontSize:'.6rem',fontWeight:700,padding:'1px 7px',borderRadius:20}}>Today</span>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {dayPosts.map(p=>{
                      const cal = calendars.find(c=>c.id===p.calendar_id);
                      const sc  = STATUS_CONFIG[p.status]||STATUS_CONFIG.planning;
                      const color = cal?.color||'#7C5CFC';
                      const tags = (() => { try { return JSON.parse(p.topic_tags||'[]'); } catch { return []; } })();
                      return (
                        <div key={p.id}
                          onClick={()=>setDetailPost(p)}
                          style={{padding:'12px 16px',background:'var(--surface2)',border:'1px solid var(--border)',borderLeft:'4px solid '+color,borderRadius:10,cursor:'pointer',transition:'all .15s',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background='var(--surface3)';}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--surface2)';}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:sc.color,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:'.88rem',marginBottom:3}}>{p.title}</div>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                              {p.platform&&<span style={{fontSize:'.7rem',background:'rgba(255,255,255,.07)',color:'var(--muted2)',padding:'1px 7px',borderRadius:20}}>{p.platform}</span>}
                              {p.content_type&&<span style={{fontSize:'.7rem',color:'var(--muted)'}}>{p.content_type}</span>}
                              {p.publish_time&&<span style={{fontSize:'.7rem',color:'var(--cyan)'}}>⏰ {p.publish_time}</span>}
                              {tags.slice(0,3).map(t=><span key={t} style={{fontSize:'.67rem',background:color+'22',color,padding:'1px 6px',borderRadius:20}}>#{t}</span>)}
                            </div>
                          </div>
                          <span style={{background:sc.bg,color:sc.color,fontSize:'.72rem',fontWeight:700,padding:'3px 10px',borderRadius:20,whiteSpace:'nowrap'}}>{sc.emoji} {sc.label}</span>
                          {p.assignee_name&&<Avatar name={p.assignee_name} image={p.assignee_image} size={26} color={color}/>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE/EDIT CALENDAR MODAL ─────────────────── */}
      <Modal open={calModal} onClose={()=>{setCalModal(false);setEditingCal(null);}} title={editingCal?'Edit Calendar':'New Calendar'} width={420}>
        <Input label="Calendar Name *" value={calForm.name} onChange={e=>setCalForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Fattoush — Content"/>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:'.73rem',fontWeight:600,color:'var(--muted2)',marginBottom:8,letterSpacing:'.04em'}}>COLOR</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {CALENDAR_COLORS.map(col=>(
              <button key={col} onClick={()=>setCalForm(f=>({...f,color:col}))}
                style={{width:30,height:30,borderRadius:8,background:col,border:calForm.color===col?'3px solid #fff':'3px solid transparent',cursor:'pointer',transition:'all .15s',boxShadow:calForm.color===col?'0 0 0 2px '+col:'none'}}/>
            ))}
          </div>
        </div>
        <Select label="Link to Client (optional)" value={calForm.client_id} onChange={e=>setCalForm(f=>({...f,client_id:e.target.value}))}>
          <option value="">— No client —</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Textarea label="Description" value={calForm.description} onChange={e=>setCalForm(f=>({...f,description:e.target.value}))} placeholder="What is this calendar for?"/>
        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setCalModal(false);setEditingCal(null);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={saveCal} style={{flex:2,background:calForm.color}}>{editingCal?'Save Changes':'Create Calendar'}</Btn>
        </div>
      </Modal>

      {/* ── CREATE/EDIT POST MODAL ─────────────────────── */}
      <Modal open={postModal} onClose={()=>{setPostModal(false);setEditingPost(null);}} title={editingPost?'✏️ Edit Post':'+ New Content Post'} width={580}>
        <Input label="Post Title *" value={postForm.title} onChange={e=>setPostForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Summer Sale Reel — Fattoush"/>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Select label="Calendar *" value={postForm.calendar_id} onChange={e=>setPostForm(f=>({...f,calendar_id:e.target.value}))}>
            <option value="">Select calendar</option>
            {calendars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Status" value={postForm.status} onChange={e=>setPostForm(f=>({...f,status:e.target.value}))}>
            {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </Select>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Select label="Platform" value={postForm.platform} onChange={e=>setPostForm(f=>({...f,platform:e.target.value}))}>
            {PLATFORMS.map(p=><option key={p} value={p}>{p}</option>)}
          </Select>
          <Select label="Content Type" value={postForm.content_type} onChange={e=>setPostForm(f=>({...f,content_type:e.target.value}))}>
            {CONTENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </Select>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <Input label="Publish Date" type="date" value={postForm.publish_date} onChange={e=>setPostForm(f=>({...f,publish_date:e.target.value}))}/>
          <Input label="Publish Time" type="time" value={postForm.publish_time} onChange={e=>setPostForm(f=>({...f,publish_time:e.target.value}))}/>
          <Select label="Assign To" value={postForm.assigned_to} onChange={e=>setPostForm(f=>({...f,assigned_to:e.target.value}))}>
            <option value="">Unassigned</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name||m.email?.split('@')[0]}</option>)}
          </Select>
        </div>

        <Textarea label="Content Description" value={postForm.content_description} onChange={e=>setPostForm(f=>({...f,content_description:e.target.value}))} placeholder="What should the caption/content say?"/>
        <Input label="Target Audience" value={postForm.target_audience} onChange={e=>setPostForm(f=>({...f,target_audience:e.target.value}))} placeholder="e.g. Women 25-40, Chennai"/>
        <Input label="Topic Tags (comma separated)" value={postForm.topic_tags} onChange={e=>setPostForm(f=>({...f,topic_tags:e.target.value}))} placeholder="summer, sale, fashion, beauty"/>
        <Textarea label="Reference Links (one per line)" value={postForm.links} onChange={e=>setPostForm(f=>({...f,links:e.target.value}))} placeholder="https://drive.google.com/...&#10;https://figma.com/..."/>
        <Textarea label="Notes" value={postForm.notes} onChange={e=>setPostForm(f=>({...f,notes:e.target.value}))} placeholder="Any additional notes for the team…"/>

        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setPostModal(false);setEditingPost(null);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={savePost} style={{flex:2}}>{editingPost?'Save Changes':'Add Post'}</Btn>
        </div>
      </Modal>

      {/* ── POST DETAIL MODAL ──────────────────────────── */}
      <Modal open={!!detailPost} onClose={()=>setDetailPost(null)} title={detailPost?.title||''} width={520}>
        {detailPost&&(()=>{
          const cal   = calendars.find(c=>c.id===detailPost.calendar_id);
          const sc    = STATUS_CONFIG[detailPost.status]||STATUS_CONFIG.planning;
          const color = cal?.color||'#7C5CFC';
          const tags  = (() => { try { return JSON.parse(detailPost.topic_tags||'[]'); } catch { return []; } })();
          const links = (() => { try { return JSON.parse(detailPost.links||'[]'); } catch { return []; } })();
          return (
            <>
              {/* Status + calendar badge */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                <span style={{background:sc.bg,color:sc.color,fontSize:'.75rem',fontWeight:700,padding:'4px 12px',borderRadius:20}}>{sc.emoji} {sc.label}</span>
                {cal&&<span style={{background:color+'22',color,fontSize:'.75rem',fontWeight:700,padding:'4px 12px',borderRadius:20}}>📅 {cal.name}</span>}
                {detailPost.platform&&<span style={{background:'rgba(255,255,255,.07)',color:'var(--muted2)',fontSize:'.75rem',fontWeight:600,padding:'4px 12px',borderRadius:20}}>{detailPost.platform}</span>}
                {detailPost.content_type&&<span style={{background:'rgba(255,255,255,.05)',color:'var(--muted)',fontSize:'.73rem',padding:'4px 10px',borderRadius:20}}>{detailPost.content_type}</span>}
              </div>

              {/* Date + Assignee */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div style={{padding:'10px 12px',background:'var(--surface3)',borderRadius:10}}>
                  <div style={{fontSize:'.65rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginBottom:4}}>Publish</div>
                  <div style={{fontWeight:700,fontSize:'.85rem'}}>{detailPost.publish_date?new Date(detailPost.publish_date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Not set'}</div>
                  {detailPost.publish_time&&<div style={{fontSize:'.75rem',color:'var(--cyan)',marginTop:2}}>⏰ {detailPost.publish_time}</div>}
                </div>
                <div style={{padding:'10px 12px',background:'var(--surface3)',borderRadius:10}}>
                  <div style={{fontSize:'.65rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginBottom:4}}>Assigned To</div>
                  {detailPost.assignee_name
                    ?<div style={{display:'flex',alignItems:'center',gap:7}}><Avatar name={detailPost.assignee_name} image={detailPost.assignee_image} size={24} color={color}/><span style={{fontWeight:600,fontSize:'.82rem'}}>{detailPost.assignee_name}</span></div>
                    :<div style={{color:'var(--muted)',fontSize:'.82rem'}}>Unassigned</div>
                  }
                </div>
              </div>

              {detailPost.content_description&&<div style={{fontSize:'.83rem',color:'var(--muted2)',lineHeight:1.6,marginBottom:14,padding:'10px 12px',background:'var(--surface3)',borderRadius:10}}>{detailPost.content_description}</div>}
              {detailPost.target_audience&&<div style={{fontSize:'.8rem',color:'var(--muted2)',marginBottom:12}}>🎯 <strong>Audience:</strong> {detailPost.target_audience}</div>}

              {tags.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>{tags.map(t=><span key={t} style={{background:color+'22',color,fontSize:'.72rem',fontWeight:600,padding:'2px 9px',borderRadius:20}}>#{t}</span>)}</div>}

              {links.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginBottom:7}}>References</div>
                  {links.map((l,i)=><a key={i} href={l} target="_blank" rel="noopener noreferrer" style={{display:'block',fontSize:'.78rem',color:'var(--purple2)',marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>🔗 {l}</a>)}
                </div>
              )}

              {detailPost.notes&&<div style={{fontSize:'.8rem',color:'var(--muted)',fontStyle:'italic',marginBottom:14,padding:'8px 12px',background:'rgba(255,255,255,.03)',borderRadius:8}}>📝 {detailPost.notes}</div>}

              {/* Change status quickly */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginBottom:8}}>Change Status</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {Object.entries(STATUS_CONFIG).map(([k,v])=>(
                    <button key={k} onClick={async()=>{ await req('/api/calendar','PATCH',{id:detailPost.id,type:'post',...detailPost,status:k,topic_tags:detailPost.topic_tags,links:detailPost.links}); setDetailPost(p=>({...p,status:k})); loadMonthPosts(curDate); toast.success('Status → '+v.label); }}
                      style={{padding:'4px 10px',borderRadius:20,border:'1px solid '+(detailPost.status===k?v.color:'rgba(255,255,255,.1)'),background:detailPost.status===k?v.bg:'transparent',color:detailPost.status===k?v.color:'var(--muted2)',fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{display:'flex',gap:8}}>
                <Btn variant="ghost" onClick={()=>openEditPost(detailPost)} style={{flex:1}}>✏️ Edit</Btn>
                <Btn variant="danger" onClick={()=>deletePost(detailPost)}>🗑 Delete</Btn>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ── IMPORT MODAL ──────────────────────────────── */}
      <Modal open={importModal} onClose={()=>{setImportModal(false);setImportData([]);setImportError('');}} title="📤 Import Calendar Posts" width={560}>
        {/* Step 1: Download template */}
        <div style={{padding:'14px 16px',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)',borderRadius:12,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:'.85rem',marginBottom:6}}>Step 1 — Download the template</div>
          <div style={{fontSize:'.78rem',color:'var(--muted2)',marginBottom:12,lineHeight:1.6}}>
            Download the CSV template, fill in your posts for any brand, then import it back. One row = one post.
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Btn variant="ghost" size="sm" onClick={downloadTemplate}>📥 Download Template CSV</Btn>
          </div>
        </div>

        {/* Template column guide */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Template Columns</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
            {[
              ['Calendar Name','Must match an existing calendar name'],
              ['Title','Post title (required)'],
              ['Platform','Instagram, Facebook, etc.'],
              ['Content Type','Reel, Story, Carousel, etc.'],
              ['Status','Planning, Live, Scheduled, etc.'],
              ['Publish Date','Format: YYYY-MM-DD'],
              ['Publish Time','Format: HH:MM (e.g. 09:00)'],
              ['Assigned To (Name)','Team member name'],
              ['Topic Tags','Comma separated tags'],
              ['Target Audience','e.g. Women 25-40'],
              ['Content Description','Caption/content plan'],
              ['Notes','Internal notes'],
              ['Reference Links','Pipe ( | ) separated URLs'],
            ].map(([col, hint]) => (
              <div key={col} style={{padding:'5px 8px',background:'var(--surface3)',borderRadius:7}}>
                <div style={{fontSize:'.7rem',fontWeight:700,color:'var(--text)'}}>{col}</div>
                <div style={{fontSize:'.63rem',color:'var(--muted)'}}>{hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Upload */}
        <div style={{padding:'14px 16px',background:'rgba(124,92,252,.06)',border:'1px solid rgba(124,92,252,.2)',borderRadius:12,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:'.85rem',marginBottom:10}}>Step 2 — Upload your filled CSV</div>
          <label style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'var(--surface3)',border:'2px dashed rgba(124,92,252,.4)',borderRadius:10,cursor:'pointer',transition:'border-color .15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--purple)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(124,92,252,.4)'}>
            <span style={{fontSize:'1.5rem'}}>📂</span>
            <div>
              <div style={{fontSize:'.82rem',fontWeight:600,color:'var(--text)'}}>
                {importData.length > 0 ? `✅ ${importData.length} rows ready to import` : 'Choose CSV file'}
              </div>
              <div style={{fontSize:'.72rem',color:'var(--muted)'}}>
                {importData.length > 0 ? 'Click to choose a different file' : 'Click to browse or drag & drop'}
              </div>
            </div>
            <input type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={handleImportFile}/>
          </label>
          {importError && <div style={{fontSize:'.78rem',color:'var(--red)',marginTop:8,padding:'7px 10px',background:'rgba(255,77,109,.08)',borderRadius:8}}>⚠️ {importError}</div>}
        </div>

        {/* Preview rows */}
        {importData.length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:'.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
              Preview — First {Math.min(5, importData.length)} of {importData.length} rows
            </div>
            <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10}}>
              {importData.slice(0,5).map((row, i) => {
                const calName = row['calendarname'] || row['calendar'] || '';
                const matchedCal = calendars.find(cal => cal.name.toLowerCase() === calName.toLowerCase());
                return (
                  <div key={i} style={{padding:'9px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,background:matchedCal?'transparent':'rgba(255,77,109,.04)'}}>
                    {matchedCal
                      ? <div style={{width:8,height:8,borderRadius:3,background:matchedCal.color,flexShrink:0}}/>
                      : <span style={{fontSize:'.7rem',color:'var(--red)'}}>⚠️</span>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'.8rem',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row['title'] || '(no title)'}</div>
                      <div style={{fontSize:'.68rem',color:'var(--muted)',marginTop:1}}>
                        {matchedCal ? matchedCal.name : <span style={{color:'var(--red)'}}>Calendar not found: "{calName}"</span>}
                        {row['publishdate']||row['publishdateyyymmdd'] ? ` · ${row['publishdate']||row['publishdateyyymmdd']}` : ''}
                        {row['platform'] ? ` · ${row['platform']}` : ''}
                      </div>
                    </div>
                    <span style={{fontSize:'.68rem',background:'rgba(255,255,255,.06)',color:'var(--muted)',padding:'2px 7px',borderRadius:20,flexShrink:0}}>{row['status']||'planning'}</span>
                  </div>
                );
              })}
            </div>
            {importData.some(row => !calendars.find(cal => cal.name.toLowerCase() === (row['calendarname']||row['calendar']||'').toLowerCase())) && (
              <div style={{fontSize:'.75rem',color:'var(--orange)',marginTop:8,padding:'7px 10px',background:'rgba(255,159,67,.08)',borderRadius:8}}>
                ⚠️ Rows with unmatched calendar names will use the first available calendar or be skipped.
              </div>
            )}
          </div>
        )}

        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setImportModal(false);setImportData([]);setImportError('');}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={runImport} disabled={importing||importData.length===0} style={{flex:2,opacity:importData.length===0?.5:1}}>
            {importing ? '⏳ Importing…' : `📤 Import ${importData.length} Posts`}
          </Btn>
        </div>
      </Modal>

      <style>{`
        .cal-action { opacity: 0 !important; }
        div:hover > div > .cal-action { opacity: 1 !important; }
        .add-post-btn { opacity: 0 !important; }
        div:hover > div > .add-post-btn { opacity: 1 !important; }
      `}</style>
    </Layout>
  );
}
