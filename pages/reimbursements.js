import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { Btn, Modal, Input, Textarea, Spinner, toast } from '../components/UI';

const CATEGORIES = [
  { id:'travel',    label:'🚗 Travel',       desc:'Cab, fuel, tickets' },
  { id:'food',      label:'🍽️ Food',          desc:'Team meals, client entertainment' },
  { id:'tools',     label:'🛠️ Tools & Software', desc:'Subscriptions, apps, licenses' },
  { id:'office',    label:'🏢 Office Supplies', desc:'Stationery, equipment' },
  { id:'marketing', label:'📢 Marketing',     desc:'Ads, prints, materials' },
  { id:'other',     label:'📦 Other',         desc:'Anything else' },
];

const STATUS_CONFIG = {
  pending:  { label:'Pending Review', color:'#FFD60A', bg:'rgba(255,214,10,.1)',  icon:'🕐' },
  approved: { label:'Approved',       color:'#00E5A0', bg:'rgba(0,229,160,.1)',   icon:'✅' },
  rejected: { label:'Rejected',       color:'#FF4D6D', bg:'rgba(255,77,109,.1)',  icon:'❌' },
  paid:     { label:'Paid ✓',         color:'#7C5CFC', bg:'rgba(124,92,252,.1)', icon:'💸' },
};

function compressImage(file) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const max = 1400;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else       { w = Math.round(w * max / h); h = max; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); };
    img.src = url;
  });
}

function fmt(n) { return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function ago(iso) {
  const m = Math.floor((Date.now()-new Date(iso))/60000);
  if (m < 1) return 'just now'; if (m < 60) return m+'m ago';
  if (m < 1440) return Math.floor(m/60)+'h ago'; return Math.floor(m/1440)+'d ago';
}
function dateFmt(iso) { return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }

export default function Reimbursements() {
  const { data:session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status==='unauthenticated') router.replace('/login'); }, [status]);

  const isAdmin = session?.user?.role === 'admin';
  const userId  = session?.user?.id;

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showReview,  setShowReview]  = useState(null);
  const [filterStatus,setFilterStatus]= useState('all');
  const [submitting,  setSubmitting]  = useState(false);
  const [adminNote,   setAdminNote]   = useState('');

  // Form state
  const [form, setForm] = useState({ title:'', category:'', amount:'', description:'' });
  const [receipts, setReceipts] = useState([]); // [{preview, type}]
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch('/api/reimbursements').then(r=>r.json());
    setItems(Array.isArray(d) ? d : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (status==='authenticated') load(); }, [status, load]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const compressed = await Promise.all(files.map(async f => ({
      preview: await compressImage(f),
      type:    f.type.startsWith('image/') ? 'image' : 'file',
      name:    f.name,
    })));
    setReceipts(p => [...p, ...compressed]);
    e.target.value = '';
  }

  async function submitForm() {
    if (!form.title || !form.category || !form.amount) return toast.error('Fill in all required fields');
    setSubmitting(true);
    await fetch('/api/reimbursements', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        receipt_url: receipts.length ? JSON.stringify(receipts.map(r=>r.preview)) : null,
      }),
    });
    setSubmitting(false);
    setShowForm(false);
    setForm({ title:'', category:'', amount:'', description:'' });
    setReceipts([]);
    toast.success('Reimbursement submitted! Admin will review it shortly.');
    load();
  }

  async function updateStatus(id, newStatus) {
    await fetch('/api/reimbursements', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id, status: newStatus, admin_note: adminNote }),
    });
    toast.success('Status updated to ' + STATUS_CONFIG[newStatus]?.label);
    setShowReview(null);
    setAdminNote('');
    load();
  }

  async function deleteItem(id) {
    if (!confirm('Delete this reimbursement request?')) return;
    await fetch('/api/reimbursements?id='+id, { method:'DELETE' });
    toast.success('Deleted');
    load();
  }

  const filtered = filterStatus === 'all' ? items : items.filter(i => i.status === filterStatus);

  // Summary stats
  const totalPending  = items.filter(i=>i.status==='pending').length;
  const totalApproved = items.filter(i=>i.status==='approved'||i.status==='paid').reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const totalPaid     = items.filter(i=>i.status==='paid').reduce((s,i)=>s+parseFloat(i.amount||0),0);

  if (status !== 'authenticated') return null;

  return (
    <Layout>
      <div className="fade-up">

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.2rem', margin:0, display:'flex', alignItems:'center', gap:10 }}>
              💸 Reimbursements
            </h2>
            <p style={{ fontSize:'.8rem', color:'var(--muted2)', margin:'4px 0 0' }}>
              Submit travel, tool and expense claims — admin approves and marks payment
            </p>
          </div>
          <Btn onClick={()=>setShowForm(true)}>+ New Request</Btn>
        </div>

        {/* ── STATS (admin sees all, members see own) ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'Pending Review', value: items.filter(i=>i.status==='pending').length, icon:'🕐', color:'#FFD60A', bg:'rgba(255,214,10,.08)' },
            { label:'Approved',       value: items.filter(i=>i.status==='approved').length, icon:'✅', color:'#00E5A0', bg:'rgba(0,229,160,.08)' },
            { label:'Total Approved', value: fmt(totalApproved), icon:'💰', color:'#7C5CFC', bg:'rgba(124,92,252,.08)' },
            { label:'Paid Out',       value: fmt(totalPaid),     icon:'💸', color:'#00D4FF', bg:'rgba(0,212,255,.08)' },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}33`, borderRadius:14, padding:'14px 16px' }}>
              <div style={{ fontSize:'1.4rem', marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontSize:'1.1rem', fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:'.72rem', color:'var(--muted2)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── FILTER TABS ── */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--surface2)', padding:4, borderRadius:10, border:'1px solid var(--border)', width:'fit-content', flexWrap:'wrap' }}>
          {[['all','All'],['pending','Pending'],['approved','Approved'],['rejected','Rejected'],['paid','Paid']].map(([v,l]) => (
            <button key={v} onClick={()=>setFilterStatus(v)}
              style={{ padding:'6px 16px', borderRadius:7, border:'none', background:filterStatus===v?'var(--surface)':'transparent', color:filterStatus===v?'var(--text)':'var(--muted2)', fontSize:'.8rem', fontWeight:filterStatus===v?700:500, cursor:'pointer', fontFamily:'inherit', boxShadow:filterStatus===v?'var(--shadow)':'none', transition:'all .15s' }}>
              {l} {v!=='all'&&items.filter(i=>i.status===v).length>0?`(${items.filter(i=>i.status===v).length})`:''}
            </button>
          ))}
        </div>

        {/* ── LIST ── */}
        {loading && <div style={{ textAlign:'center', padding:60 }}><Spinner size={28}/></div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted2)' }}>
            <div style={{ fontSize:'3rem', marginBottom:12, opacity:.4 }}>💸</div>
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:8, color:'var(--muted)' }}>No requests found</div>
            <div style={{ fontSize:'.84rem', marginBottom:20 }}>Submit a reimbursement request for travel, tools or expenses.</div>
            <Btn onClick={()=>setShowForm(true)}>+ New Request</Btn>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(item => {
            const st  = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const cat = CATEGORIES.find(c=>c.id===item.category);
            let receiptsArr = [];
            try { receiptsArr = item.receipt_url ? JSON.parse(item.receipt_url) : []; } catch { receiptsArr = item.receipt_url ? [item.receipt_url] : []; }

            return (
              <div key={item.id} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 20px', display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>

                {/* Category icon */}
                <div style={{ width:46, height:46, borderRadius:12, background:'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', flexShrink:0 }}>
                  {cat?.label.split(' ')[0] || '📦'}
                </div>

                {/* Main info */}
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
                    <div style={{ fontWeight:800, fontSize:'.95rem' }}>{item.title}</div>
                    <span style={{ padding:'2px 10px', borderRadius:20, background:st.bg, color:st.color, fontSize:'.68rem', fontWeight:700 }}>
                      {st.icon} {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize:'.78rem', color:'var(--muted2)', marginBottom:6 }}>
                    {cat?.label || item.category} · {isAdmin ? (item.submitter_name || 'Unknown') : 'You'} · {dateFmt(item.created_at)}
                  </div>
                  {item.description && <div style={{ fontSize:'.8rem', color:'var(--muted2)', lineHeight:1.6, marginBottom:6 }}>{item.description}</div>}
                  {item.admin_note && (
                    <div style={{ fontSize:'.78rem', color:st.color, background:st.bg, borderRadius:8, padding:'6px 10px', marginTop:4 }}>
                      💬 Admin note: {item.admin_note}
                    </div>
                  )}
                  {/* Receipt thumbnails */}
                  {receiptsArr.length > 0 && (
                    <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                      {receiptsArr.map((url, i) => (
                        <img key={i} src={url} alt="receipt" onClick={()=>setShowReceipt(url)}
                          style={{ width:52, height:52, objectFit:'cover', borderRadius:8, cursor:'pointer', border:'1px solid var(--border)', transition:'transform .15s' }}
                          onMouseEnter={e=>e.target.style.transform='scale(1.08)'}
                          onMouseLeave={e=>e.target.style.transform='scale(1)'}
                        />
                      ))}
                      <button onClick={()=>setShowReceipt(receiptsArr[0])}
                        style={{ padding:'0 12px', height:52, background:'var(--surface3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted2)', cursor:'pointer', fontSize:'.75rem', fontFamily:'inherit' }}>
                        View {receiptsArr.length} receipt{receiptsArr.length>1?'s':''}
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount + actions */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:10, flexShrink:0 }}>
                  <div style={{ fontWeight:900, fontSize:'1.2rem', color:'var(--text)' }}>{fmt(item.amount)}</div>

                  {/* Admin action buttons */}
                  {isAdmin && (
                    <div style={{ display:'flex', gap:6', flexWrap:'wrap', justifyContent:'flex-end' }}>
                      {item.status === 'pending' && (
                        <>
                          <button onClick={()=>{setShowReview({item,action:'approved'});setAdminNote('');}}
                            style={{ padding:'5px 12px', background:'rgba(0,229,160,.12)', border:'1px solid rgba(0,229,160,.3)', borderRadius:8, color:'var(--green)', cursor:'pointer', fontSize:'.78rem', fontWeight:700, fontFamily:'inherit' }}>
                            ✅ Approve
                          </button>
                          <button onClick={()=>{setShowReview({item,action:'rejected'});setAdminNote('');}}
                            style={{ padding:'5px 12px', background:'rgba(255,77,109,.08)', border:'1px solid rgba(255,77,109,.25)', borderRadius:8, color:'#FF4D6D', cursor:'pointer', fontSize:'.78rem', fontFamily:'inherit' }}>
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <button onClick={()=>updateStatus(item.id,'paid')}
                          style={{ padding:'5px 14px', background:'rgba(124,92,252,.15)', border:'1px solid rgba(124,92,252,.3)', borderRadius:8, color:'var(--purple2)', cursor:'pointer', fontSize:'.78rem', fontWeight:700, fontFamily:'inherit' }}>
                          💸 Mark as Paid
                        </button>
                      )}
                      {/* Change status dropdown */}
                      <select onChange={e=>{if(e.target.value)updateStatus(item.id,e.target.value);e.target.value='';}}
                        defaultValue=""
                        style={{ padding:'5px 10px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--muted2)', cursor:'pointer', fontSize:'.75rem', fontFamily:'inherit' }}>
                        <option value="" disabled>Change status…</option>
                        {Object.entries(STATUS_CONFIG).filter(([k])=>k!==item.status).map(([k,v])=>(
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                      <button onClick={()=>deleteItem(item.id)}
                        style={{ padding:'5px 10px', background:'transparent', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', cursor:'pointer', fontSize:'.78rem', fontFamily:'inherit' }}>
                        🗑
                      </button>
                    </div>
                  )}

                  {/* Member can delete own pending request */}
                  {!isAdmin && item.submitted_by === userId && item.status === 'pending' && (
                    <button onClick={()=>deleteItem(item.id)}
                      style={{ padding:'5px 10px', background:'transparent', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', cursor:'pointer', fontSize:'.75rem', fontFamily:'inherit' }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── NEW REQUEST MODAL ── */}
      <Modal open={showForm} title="💸 New Reimbursement Request" onClose={()=>{setShowForm(false);setForm({title:'',category:'',amount:'',description:''});setReceipts([]);}}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Category picker */}
          <div>
            <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:8 }}>Category *</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))}
                  style={{ padding:'10px 8px', border:`1.5px solid ${form.category===cat.id?'var(--purple)':'var(--border)'}`, borderRadius:10, background:form.category===cat.id?'rgba(124,92,252,.1)':'var(--surface3)', cursor:'pointer', fontFamily:'inherit', textAlign:'center', transition:'all .15s' }}>
                  <div style={{ fontSize:'1.2rem', marginBottom:3 }}>{cat.label.split(' ')[0]}</div>
                  <div style={{ fontSize:'.7rem', fontWeight:600, color:'var(--text)' }}>{cat.label.split(' ').slice(1).join(' ')}</div>
                  <div style={{ fontSize:'.65rem', color:'var(--muted2)' }}>{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title + amount */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Title *</div>
              <Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Uber to client meeting"/>
            </div>
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Amount (₹) *</div>
              <Input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" style={{ width:110 }}/>
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Description</div>
            <Textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Details about the expense — purpose, date, client name etc." rows={2}/>
          </div>

          {/* Receipt upload */}
          <div>
            <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:8 }}>Receipts / Screenshots</div>
            <div onClick={()=>fileRef.current?.click()}
              style={{ border:'2px dashed var(--border2)', borderRadius:12, padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--surface3)', transition:'all .15s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';e.currentTarget.style.background='rgba(124,92,252,.05)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--surface3)';}}>
              <div style={{ fontSize:'1.8rem', marginBottom:6 }}>🧾</div>
              <div style={{ fontSize:'.82rem', fontWeight:600, marginBottom:2 }}>Upload receipts or screenshots</div>
              <div style={{ fontSize:'.72rem', color:'var(--muted2)' }}>JPG, PNG, PDF — tap to browse</div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{ display:'none' }} onChange={handleFiles}/>
            </div>
            {receipts.length > 0 && (
              <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                {receipts.map((r,i) => (
                  <div key={i} style={{ position:'relative' }}>
                    <img src={r.preview} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)' }}/>
                    <button onClick={()=>setReceipts(p=>p.filter((_,j)=>j!==i))}
                      style={{ position:'absolute', top:-6, right:-6, background:'#FF4D6D', border:'none', borderRadius:'50%', width:18, height:18, color:'#fff', cursor:'pointer', fontSize:'.6rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding:'10px 14px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.15)', borderRadius:10, fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.6 }}>
            📋 Your request will be reviewed by the admin. You'll see the status update here.
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <Btn variant="ghost" onClick={()=>{setShowForm(false);setForm({title:'',category:'',amount:'',description:''});setReceipts([]);}} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={submitForm} disabled={submitting||!form.title||!form.category||!form.amount} style={{ flex:2 }}>
              {submitting ? '⏳ Submitting…' : '💸 Submit Request'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── REVIEW MODAL ── */}
      {showReview && (
        <Modal open={!!showReview} title={showReview.action==='approved'?'✅ Approve Request':'❌ Reject Request'} onClose={()=>setShowReview(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--surface3)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:4 }}>{showReview.item.title}</div>
              <div style={{ fontSize:'.8rem', color:'var(--muted2)' }}>
                {showReview.item.submitter_name} · {fmt(showReview.item.amount)} · {CATEGORIES.find(c=>c.id===showReview.item.category)?.label}
              </div>
            </div>
            <div>
              <div style={{ fontSize:'.78rem', fontWeight:600, marginBottom:6 }}>Note to employee (optional)</div>
              <Textarea value={adminNote} onChange={e=>setAdminNote(e.target.value)} placeholder={showReview.action==='approved'?'e.g. Approved! Payment will be made by Friday.':'e.g. Please submit the original receipt.'} rows={2}/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={()=>setShowReview(null)} style={{ flex:1 }}>Cancel</Btn>
              <Btn onClick={()=>updateStatus(showReview.item.id, showReview.action)}
                style={{ flex:2, background:showReview.action==='approved'?'rgba(0,229,160,.9)':'rgba(255,77,109,.9)' }}>
                {showReview.action==='approved'?'✅ Approve & Notify':'❌ Reject & Notify'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── RECEIPT VIEWER ── */}
      {showReceipt && (
        <div onClick={()=>setShowReceipt(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.92)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <button onClick={()=>setShowReceipt(null)} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,.1)', border:'none', borderRadius:'50%', width:40, height:40, color:'#fff', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
          <img src={showReceipt} alt="receipt" onClick={e=>e.stopPropagation()} style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12, objectFit:'contain' }}/>
        </div>
      )}
    </Layout>
  );
}
