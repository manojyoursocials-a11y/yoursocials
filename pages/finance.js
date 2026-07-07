import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Textarea, Spinner, EmptyState, ProgressBar, toast } from '../components/UI';

async function req(url, method='GET', body) {
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined });
  return r.json();
}

const TX_TYPES = ['income','expense','transfer'];
const TX_MODES = ['UPI','Cash','Bank Transfer','Credit Card','Debit Card','Cheque','Other'];
const fmt  = n  => '₹' + (parseFloat(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtD = d  => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const blank = () => ({
  name:'', amount:'', transaction_type:'expense', payment_for:'',
  brand_name:'', transaction_mode:'UPI', description:'', closing_balance:'',
  direction:'give', entry_date: new Date().toISOString().split('T')[0],
});

const TYPE_COLOR  = { income:'var(--green)', expense:'var(--red)', transfer:'var(--cyan)' };
const TYPE_EMOJI  = { income:'💰', expense:'💸', transfer:'🔄' };
const DIR_LABEL   = { get:'To Receive 📥', give:'To Pay 📤' };

export default function Finance() {
  const { status, data: session } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);
  useEffect(() => { if (status==='authenticated' && session?.user?.role !== 'admin') router.replace('/'); }, [status, session]);

  const [entries,  setEntries]  = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [monthly,  setMonthly]  = useState([]);
  const [clients,  setClients]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(blank());
  const [tab,      setTab]      = useState('all');       // all | daily | monthly | mode
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [filterType, setFilterType] = useState('all');
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);

  const isAdmin = session?.user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const [e, s, m, c] = await Promise.all([
      req('/api/finance'),
      req('/api/finance?summary=1'),
      req('/api/finance?monthly=1'),
      req('/api/clients'),
    ]);
    setEntries(Array.isArray(e) ? e : []);
    setSummary(s);
    setMonthly(Array.isArray(m) ? m : []);
    setClients(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (status==='authenticated') load(); }, [status, load]);

  // Filtered entries
  const filtered = entries.filter(e => {
    if (filterType !== 'all' && e.transaction_type !== filterType) return false;
    if (dateFrom && e.entry_date < dateFrom) return false;
    if (dateTo   && e.entry_date > dateTo)   return false;
    if (search) {
      const q = search.toLowerCase();
      return (e.name||'').toLowerCase().includes(q) ||
             (e.brand_name||'').toLowerCase().includes(q) ||
             (e.payment_for||'').toLowerCase().includes(q) ||
             (e.description||'').toLowerCase().includes(q);
    }
    return true;
  });

  // By payment mode
  const byMode = {};
  filtered.forEach(e => {
    const m = e.transaction_mode || 'Other';
    if (!byMode[m]) byMode[m] = { income:0, expense:0, count:0 };
    byMode[m].count++;
    if (e.transaction_type === 'income')  byMode[m].income  += parseFloat(e.amount)||0;
    if (e.transaction_type === 'expense') byMode[m].expense += parseFloat(e.amount)||0;
  });

  // By day
  const byDay = {};
  filtered.forEach(e => {
    const d = e.entry_date ? String(e.entry_date).slice(0,10) : 'Unknown';
    if (!byDay[d]) byDay[d] = { income:0, expense:0, entries:[] };
    byDay[d].entries.push(e);
    if (e.transaction_type === 'income')  byDay[d].income  += parseFloat(e.amount)||0;
    if (e.transaction_type === 'expense') byDay[d].expense += parseFloat(e.amount)||0;
  });
  const dayRows = Object.entries(byDay).sort((a,b)=>b[0].localeCompare(a[0]));

  async function save() {
    if (!form.name.trim())   { toast.error('Name is required'); return; }
    if (!form.amount)        { toast.error('Amount is required'); return; }
    setSaving(true);
    const payload = { ...form, amount: parseFloat(form.amount)||0, closing_balance: form.closing_balance ? parseFloat(form.closing_balance) : null };
    let res;
    if (editing) res = await req('/api/finance','PATCH',{ id:editing.id, ...payload });
    else         res = await req('/api/finance','POST', payload);
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editing ? 'Entry updated!' : 'Entry added! ✅');
    setModal(false); setEditing(null); setForm(blank()); load();
  }

  async function del(id) {
    if (!confirm('Delete this entry?')) return;
    const r = await req('/api/finance?id='+id,'DELETE');
    if (r.error) { toast.error(r.error); return; }
    toast.info('Deleted'); load();
  }

  function openEdit(e) {
    setEditing(e);
    setForm({ name:e.name||'', amount:e.amount||'', transaction_type:e.transaction_type||'expense', payment_for:e.payment_for||'', brand_name:e.brand_name||'', transaction_mode:e.transaction_mode||'UPI', description:e.description||'', closing_balance:e.closing_balance||'', direction:e.direction||'give', entry_date:e.entry_date?String(e.entry_date).slice(0,10):'' });
    setModal(true);
  }

  // CSV export
  function exportCSV() {
    const rows = [['Date','Name','Type','Direction','Amount','Payment For','Brand','Mode','Closing Balance','Description']];
    filtered.forEach(e => rows.push([
      String(e.entry_date).slice(0,10), e.name, e.transaction_type, e.direction,
      e.amount, e.payment_for||'', e.brand_name||'', e.transaction_mode||'',
      e.closing_balance||'', e.description||'',
    ]));
    const csv = rows.map(r=>r.map(c=>'"'+(String(c).replace(/"/g,'""'))+'"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'yoursocials-finance-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
  }

  const tabStyle = active => ({ padding:'7px 18px', borderRadius:9, border:'none', fontFamily:'Inter,sans-serif', fontSize:'.8rem', fontWeight:active?700:500, cursor:'pointer', background:active?'var(--surface2)':'transparent', color:active?'var(--text)':'var(--muted2)', transition:'all .15s' });

  if (loading) return <Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><Spinner size={28}/></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:'1.3rem',marginBottom:4}}>💰 Finance</h2>
            <p style={{fontSize:'.82rem',color:'var(--muted2)'}}>Track income, expenses and office cashflow</p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Btn variant="ghost" onClick={exportCSV}>📥 Export CSV</Btn>
            <Btn onClick={()=>{setEditing(null);setForm(blank());setModal(true);}}>+ Add Entry</Btn>
          </div>
        </div>

        {/* KPI cards */}
        {summary && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:20}}>
            {[
              ['Total Income',   summary.total_income,   'var(--green)',  '💰'],
              ['Total Expense',  summary.total_expense,  'var(--red)',    '💸'],
              ['Net Balance',    summary.net_balance,    parseFloat(summary.net_balance)>=0?'var(--green)':'var(--red)', '📊'],
              ['To Receive',     summary.to_receive,     'var(--cyan)',   '📥'],
              ['To Pay',         summary.to_pay,         'var(--orange)', '📤'],
            ].map(([label, val, color, emoji]) => (
              <Card key={label} style={{textAlign:'center',padding:'16px 12px'}}>
                <div style={{fontSize:'1.1rem',marginBottom:4}}>{emoji}</div>
                <div style={{fontSize:'1.1rem',fontWeight:900,color,lineHeight:1.1,marginBottom:4}}>{fmt(val)}</div>
                <div style={{fontSize:'.67rem',color:'var(--muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em'}}>{label}</div>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <Card style={{marginBottom:16,padding:'12px 14px'}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search entries…"
              style={{flex:1,minWidth:160,background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:9,padding:'7px 12px',fontSize:'.8rem',color:'var(--text)',fontFamily:'Inter,sans-serif'}}/>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)}
              style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:9,padding:'7px 12px',fontSize:'.8rem',color:'var(--text)',fontFamily:'Inter,sans-serif'}}>
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
            <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:'.75rem',color:'var(--muted2)'}}>From</span>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:9,padding:'6px 10px',fontSize:'.78rem',color:'var(--text)',fontFamily:'Inter,sans-serif'}}/>
              <span style={{fontSize:'.75rem',color:'var(--muted2)'}}>To</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:9,padding:'6px 10px',fontSize:'.78rem',color:'var(--text)',fontFamily:'Inter,sans-serif'}}/>
              {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom('');setDateTo('');}} style={{padding:'6px 12px',borderRadius:8,border:'1px solid var(--border2)',background:'transparent',color:'var(--muted)',cursor:'pointer',fontSize:'.75rem',fontFamily:'Inter,sans-serif'}}>Clear</button>}
            </div>
          </div>
        </Card>

        {/* View tabs */}
        <div style={{display:'flex',gap:4,marginBottom:16,background:'var(--surface2)',padding:4,borderRadius:12,width:'fit-content',border:'1px solid var(--border)'}}>
          {[['all','All Entries'],['daily','By Day'],['monthly','Monthly'],['mode','By Mode']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={tabStyle(tab===id)}>{label}</button>
          ))}
        </div>

        {/* All Entries */}
        {tab==='all'&&(
          <Card style={{padding:0,overflow:'hidden'}}>
            {filtered.length===0
              ? <EmptyState emoji="💰" title="No entries found" subtitle="Add your first finance entry." action={<Btn onClick={()=>{setEditing(null);setForm(blank());setModal(true);}}>+ Add Entry</Btn>}/>
              : (
                <div>
                  {/* Table header */}
                  <div style={{display:'grid',gridTemplateColumns:'110px 1fr 100px 90px 110px 110px auto',gap:8,padding:'10px 16px',borderBottom:'1px solid var(--border)',background:'var(--surface3)'}}>
                    {['Date','Name / For','Amount','Type','Mode','Closing Bal',''].map(h=>(
                      <div key={h} style={{fontSize:'.65rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</div>
                    ))}
                  </div>
                  {filtered.map(e=>(
                    <div key={e.id}
                      style={{display:'grid',gridTemplateColumns:'110px 1fr 100px 90px 110px 110px auto',gap:8,padding:'11px 16px',borderBottom:'1px solid var(--border)',alignItems:'center',transition:'background .1s'}}
                      onMouseEnter={el=>el.currentTarget.style.background='var(--surface3)'}
                      onMouseLeave={el=>el.currentTarget.style.background='transparent'}>
                      <div style={{fontSize:'.75rem',color:'var(--muted2)'}}>{fmtD(e.entry_date)}</div>
                      <div>
                        <div style={{fontSize:'.82rem',fontWeight:600}}>{e.name}</div>
                        {(e.payment_for||e.brand_name)&&<div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:2}}>{[e.payment_for,e.brand_name].filter(Boolean).join(' · ')}</div>}
                        {e.description&&<div style={{fontSize:'.68rem',color:'var(--muted)',marginTop:1,fontStyle:'italic'}}>{e.description}</div>}
                      </div>
                      <div style={{fontWeight:800,fontSize:'.88rem',color:TYPE_COLOR[e.transaction_type]}}>
                        {e.direction==='get'?'+':'-'}{fmt(e.amount)}
                      </div>
                      <div>
                        <span style={{background:TYPE_COLOR[e.transaction_type]+'22',color:TYPE_COLOR[e.transaction_type],fontSize:'.65rem',fontWeight:700,padding:'3px 8px',borderRadius:20}}>
                          {TYPE_EMOJI[e.transaction_type]} {e.transaction_type}
                        </span>
                      </div>
                      <div style={{fontSize:'.75rem',color:'var(--muted2)'}}>{e.transaction_mode||'—'}</div>
                      <div style={{fontSize:'.8rem',fontWeight:600,color:'var(--cyan)'}}>{e.closing_balance?fmt(e.closing_balance):'—'}</div>
                      {isAdmin&&(
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>openEdit(e)} style={{background:'var(--surface3)',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'.72rem',color:'var(--muted2)'}}>✏️</button>
                          <button onClick={()=>del(e.id)} style={{background:'rgba(255,77,109,.1)',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'.72rem',color:'var(--red)'}}>🗑</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Running total footer */}
                  <div style={{display:'grid',gridTemplateColumns:'110px 1fr 100px 90px 110px 110px auto',gap:8,padding:'10px 16px',background:'var(--surface3)',borderTop:'2px solid var(--border2)'}}>
                    <div style={{fontSize:'.72rem',fontWeight:700,color:'var(--muted)',gridColumn:'1/3'}}>FILTERED TOTAL ({filtered.length} entries)</div>
                    <div style={{fontWeight:900,color:filtered.reduce((s,e)=>s+(e.transaction_type==='income'?1:-1)*(parseFloat(e.amount)||0),0)>=0?'var(--green)':'var(--red)'}}>
                      {fmt(filtered.reduce((s,e)=>s+(e.transaction_type==='income'?1:-1)*(parseFloat(e.amount)||0),0))}
                    </div>
                    <div style={{fontSize:'.72rem',color:'var(--muted)'}}>
                      💰 {fmt(filtered.filter(e=>e.transaction_type==='income').reduce((s,e)=>s+(parseFloat(e.amount)||0),0))}
                    </div>
                    <div style={{fontSize:'.72rem',color:'var(--muted)',gridColumn:'5/8'}}>
                      💸 {fmt(filtered.filter(e=>e.transaction_type==='expense').reduce((s,e)=>s+(parseFloat(e.amount)||0),0))}
                    </div>
                  </div>
                </div>
              )
            }
          </Card>
        )}

        {/* Daily breakdown */}
        {tab==='daily'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {dayRows.length===0&&<EmptyState emoji="📅" title="No entries" subtitle="No data in selected range."/>}
            {dayRows.map(([date,v])=>{
              const net = v.income - v.expense;
              return (
                <Card key={date}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                    <div style={{fontWeight:800,fontSize:'.95rem'}}>{fmtD(date)}</div>
                    <div style={{display:'flex',gap:14}}>
                      <span style={{fontSize:'.8rem',color:'var(--green)',fontWeight:700}}>💰 {fmt(v.income)}</span>
                      <span style={{fontSize:'.8rem',color:'var(--red)',fontWeight:700}}>💸 {fmt(v.expense)}</span>
                      <span style={{fontSize:'.82rem',fontWeight:800,color:net>=0?'var(--green)':'var(--red)'}}>Net: {fmt(net)}</span>
                    </div>
                  </div>
                  {v.entries.map(e=>(
                    <div key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'var(--surface3)',borderRadius:9,marginBottom:6}}>
                      <span style={{fontSize:'1rem'}}>{TYPE_EMOJI[e.transaction_type]}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'.8rem',fontWeight:600}}>{e.name}</div>
                        {(e.payment_for||e.brand_name)&&<div style={{fontSize:'.69rem',color:'var(--muted)'}}>{[e.payment_for,e.brand_name].filter(Boolean).join(' · ')}</div>}
                      </div>
                      <div style={{fontWeight:800,color:TYPE_COLOR[e.transaction_type],fontSize:'.85rem'}}>{e.direction==='get'?'+':'-'}{fmt(e.amount)}</div>
                      <span style={{fontSize:'.68rem',background:'rgba(255,255,255,.06)',padding:'2px 7px',borderRadius:6,color:'var(--muted2)'}}>{e.transaction_mode}</span>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        )}

        {/* Monthly */}
        {tab==='monthly'&&(
          <Card>
            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--muted)',marginBottom:16}}>Monthly Summary (Last 12 months)</div>
            {monthly.length===0&&<EmptyState emoji="📊" title="No data" subtitle="Add finance entries to see monthly breakdown."/>}
            {monthly.map((m,i)=>{
              const net = parseFloat(m.total_income||0) - parseFloat(m.total_expense||0);
              const maxVal = Math.max(...monthly.map(r=>Math.max(parseFloat(r.total_income||0),parseFloat(r.total_expense||0))),1);
              return (
                <div key={m.month} style={{marginBottom:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
                    <span style={{fontWeight:700,fontSize:'.88rem'}}>{m.month}</span>
                    <div style={{display:'flex',gap:14}}>
                      <span style={{fontSize:'.78rem',color:'var(--green)'}}>💰 {fmt(m.total_income)}</span>
                      <span style={{fontSize:'.78rem',color:'var(--red)'}}>💸 {fmt(m.total_expense)}</span>
                      <span style={{fontSize:'.8rem',fontWeight:800,color:net>=0?'var(--green)':'var(--red)'}}>Net {fmt(net)}</span>
                      <span style={{fontSize:'.72rem',color:'var(--muted)'}}>{m.entry_count} entries</span>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <div>
                      <div style={{fontSize:'.65rem',color:'var(--green)',marginBottom:3}}>Income</div>
                      <ProgressBar value={parseFloat(m.total_income||0)} max={maxVal} color="var(--green)" height={8}/>
                    </div>
                    <div>
                      <div style={{fontSize:'.65rem',color:'var(--red)',marginBottom:3}}>Expense</div>
                      <ProgressBar value={parseFloat(m.total_expense||0)} max={maxVal} color="var(--red)" height={8}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* By payment mode */}
        {tab==='mode'&&(
          <Card>
            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--muted)',marginBottom:16}}>Breakdown by Payment Mode</div>
            {Object.keys(byMode).length===0&&<EmptyState emoji="💳" title="No data" subtitle="Add finance entries to see mode breakdown."/>}
            {Object.entries(byMode).sort((a,b)=>(b[1].income+b[1].expense)-(a[1].income+a[1].expense)).map(([mode,v])=>(
              <div key={mode} style={{marginBottom:16,padding:'12px 14px',background:'var(--surface3)',borderRadius:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
                  <span style={{fontWeight:700}}>{mode}</span>
                  <span style={{fontSize:'.72rem',color:'var(--muted)'}}>{v.count} transactions</span>
                </div>
                <div style={{display:'flex',gap:20}}>
                  <div><div style={{fontSize:'.68rem',color:'var(--green)',marginBottom:3}}>Income</div><div style={{fontWeight:700,color:'var(--green)'}}>{fmt(v.income)}</div></div>
                  <div><div style={{fontSize:'.68rem',color:'var(--red)',marginBottom:3}}>Expense</div><div style={{fontWeight:700,color:'var(--red)'}}>{fmt(v.expense)}</div></div>
                  <div><div style={{fontSize:'.68rem',color:'var(--muted)',marginBottom:3}}>Net</div><div style={{fontWeight:700,color:v.income-v.expense>=0?'var(--green)':'var(--red)'}}>{fmt(v.income-v.expense)}</div></div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modal} onClose={()=>{setModal(false);setEditing(null);}} title={editing?'Edit Entry':'+ Add Finance Entry'} width={560}>
        {/* Date + Name row */}
        <div style={{display:'grid',gridTemplateColumns:'150px 1fr',gap:12}}>
          <Input label="Date *" type="date" value={form.entry_date} onChange={e=>setForm(f=>({...f,entry_date:e.target.value}))}/>
          <Input label="Entry Name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Instagram Ads Payment"/>
        </div>

        {/* Amount + Type + Direction */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <Input label="Amount (₹) *" type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"/>
          <Select label="Transaction Type" value={form.transaction_type} onChange={e=>setForm(f=>({...f,transaction_type:e.target.value}))}>
            <option value="income">💰 Income</option>
            <option value="expense">💸 Expense</option>
            <option value="transfer">🔄 Transfer</option>
          </Select>
          <Select label="Direction" value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}>
            <option value="give">📤 To Pay (Give)</option>
            <option value="get">📥 To Receive (Get)</option>
          </Select>
        </div>

        {/* Payment for + Brand */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Input label="Payment For" value={form.payment_for} onChange={e=>setForm(f=>({...f,payment_for:e.target.value}))} placeholder="e.g. Office Rent, Ad Spend"/>
          <Select label="Brand / Client" value={form.brand_name} onChange={e=>setForm(f=>({...f,brand_name:e.target.value}))}>
            <option value="">— Internal / None —</option>
            {clients.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
          </Select>
        </div>

        {/* Mode + Closing Balance */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Select label="Transaction Mode" value={form.transaction_mode} onChange={e=>setForm(f=>({...f,transaction_mode:e.target.value}))}>
            {TX_MODES.map(m=><option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="Closing Balance (₹)" type="number" step="0.01" value={form.closing_balance} onChange={e=>setForm(f=>({...f,closing_balance:e.target.value}))} placeholder="Balance after this entry"/>
        </div>

        <Textarea label="Description / Notes" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Any additional details about this transaction…"/>

        {/* Preview */}
        {form.amount && (
          <div style={{padding:'10px 14px',background:TYPE_COLOR[form.transaction_type]+'11',border:'1px solid '+TYPE_COLOR[form.transaction_type]+'33',borderRadius:10,marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:'1.3rem'}}>{TYPE_EMOJI[form.transaction_type]}</span>
            <div>
              <div style={{fontSize:'.82rem',fontWeight:700,color:TYPE_COLOR[form.transaction_type]}}>{form.direction==='get'?'+ Receiving':' - Paying'} {fmt(form.amount)}</div>
              <div style={{fontSize:'.72rem',color:'var(--muted2)'}}>via {form.transaction_mode} · {form.brand_name||'Internal'}</div>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:10}}>
          <Btn variant="ghost" onClick={()=>{setModal(false);setEditing(null);}} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={save} disabled={saving} style={{flex:2}}>{saving?'Saving…':editing?'Save Changes':'Add Entry'}</Btn>
        </div>
      </Modal>
    </Layout>
  );
}
