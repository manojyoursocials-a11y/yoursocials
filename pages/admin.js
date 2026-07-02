import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Btn, Modal, Input, Select, Avatar, Spinner, EmptyState, toast, sounds, api, MEMBER_COLORS } from '../components/UI';

export default function Admin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session]);

  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(df());
  const [delConfirm, setDelConfirm] = useState(null);

  function df() { return { name: '', email: '', password: '', role: 'member', job_title: '' }; }

  useEffect(() => { if (status === 'authenticated' && session?.user?.role === 'admin') fetchUsers(); }, [status, session]);

  async function fetchUsers() {
    const d = await api('/api/users');
    setUsers(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function saveUser() {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email required'); return; }
    if (!editing && !form.password.trim()) { toast.error('Password required for new user'); return; }
    if (form.password && form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    if (editing) {
      const payload = { id: editing.id, name: form.name, job_title: form.job_title, role: form.role };
      if (form.password) payload.password = form.password;
      const res = await api('/api/users', 'PATCH', payload);
      if (res.error) { toast.error(res.error); return; }
      toast.success('User updated!');
    } else {
      const res = await api('/api/users', 'POST', form);
      if (res.error) { toast.error(res.error); return; }
      toast.success(form.name + ' added to the team!', '👤');
      sounds.success();
    }
    setModal(false);
    setForm(df());
    setEditing(null);
    fetchUsers();
  }

  async function deleteUser(id) {
    const res = await api('/api/users?id=' + id, 'DELETE');
    if (res.error) { toast.error(res.error); return; }
    toast.info('User removed from team');
    setDelConfirm(null);
    fetchUsers();
  }

  const ROLE_COLORS = { admin: { bg:'rgba(124,92,252,.15)', color:'var(--purple2)' }, member: { bg:'rgba(0,229,160,.1)', color:'var(--green)' }, viewer: { bg:'rgba(144,144,170,.12)', color:'var(--muted2)' } };

  if (loading) return <Layout><div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}><Spinner size={28}/><span style={{ color:'var(--muted2)' }}>Loading…</span></div></Layout>;

  return (
    <Layout>
      <div className="fade-up">
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:4 }}>⚙️ Manage Users</h2>
            <p style={{ fontSize:'.82rem', color:'var(--muted2)' }}>{users.length} accounts · Create and manage your entire team</p>
          </div>
          <Btn onClick={() => { setEditing(null); setForm(df()); setModal(true); }}>+ Add Team Member</Btn>
        </div>

        {/* Info card */}
        <Card style={{ background:'rgba(124,92,252,.06)', borderColor:'rgba(124,92,252,.2)', marginBottom:24 }}>
          <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
            {[['👑 Admin','Can create/delete users, manage everything'],['👤 Member','Full access to tasks, clients, AI'],['👁️ Viewer','Read-only access to dashboards']].map(([r,d]) => (
              <div key={r} style={{ flex:1, minWidth:180 }}>
                <div style={{ fontWeight:700, fontSize:'.8rem', marginBottom:3 }}>{r}</div>
                <div style={{ fontSize:'.73rem', color:'var(--muted2)' }}>{d}</div>
              </div>
            ))}
          </div>
        </Card>

        {users.length === 0
          ? <EmptyState emoji="👥" title="No users yet" subtitle="Create the first team member." action={<Btn onClick={() => { setEditing(null); setForm(df()); setModal(true); }}>+ Add Team Member</Btn>} />
          : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
              {users.map((u, i) => {
                const isMe = u.id === session?.user?.id;
                const rc   = ROLE_COLORS[u.role] || ROLE_COLORS.member;
                return (
                  <Card key={u.id} style={{ position:'relative', border: isMe ? '1px solid rgba(124,92,252,.35)' : undefined }}>
                    {isMe && <div style={{ position:'absolute', top:12, right:12, fontSize:'.63rem', fontWeight:700, background:'rgba(124,92,252,.15)', color:'var(--purple2)', padding:'2px 8px', borderRadius:20 }}>You</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                      <Avatar name={u.name} size={44} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:'.92rem', marginBottom:2 }}>{u.name}</div>
                        <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:4 }}>{u.email}</div>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ background:rc.bg, color:rc.color, fontSize:'.65rem', fontWeight:700, padding:'2px 9px', borderRadius:20 }}>{u.role}</span>
                          {u.job_title && <span style={{ fontSize:'.7rem', color:'var(--muted)' }}>{u.job_title}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, fontSize:'.72rem', color:'var(--muted2)', marginBottom:14 }}>
                      <span>📋 {u.total_tasks || 0} tasks</span>
                      <span>✅ {u.done_tasks || 0} done</span>
                      <span>🪙 {(u.coins || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn variant="ghost" size="sm" style={{ flex:1 }} onClick={() => { setEditing(u); setForm({ name:u.name, email:u.email, password:'', role:u.role, job_title:u.job_title||'' }); setModal(true); }}>✏️ Edit</Btn>
                      {!isMe && <Btn variant="danger" size="sm" onClick={() => setDelConfirm(u)}>🗑 Remove</Btn>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Create / Edit modal */}
      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); setForm(df()); }} title={editing ? 'Edit Team Member' : 'Add New Team Member'} width={480}>
        <Input label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="e.g. Arun Kumar" />
        <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} placeholder="arun@yoursocials.in" disabled={!!editing} />
        <Input label={editing ? 'New Password (leave blank to keep current)' : 'Password *'} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password:e.target.value }))} placeholder={editing ? 'Leave blank to keep current' : 'Min 6 characters'} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role:e.target.value }))}>
            <option value="member">👤 Member</option>
            <option value="admin">👑 Admin</option>
            <option value="viewer">👁️ Viewer</option>
          </Select>
          <Input label="Job Title" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title:e.target.value }))} placeholder="Content Lead, Designer…" />
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => { setModal(false); setEditing(null); setForm(df()); }} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={saveUser} style={{ flex:2 }}>{editing ? 'Save Changes' : 'Add Member'}</Btn>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!delConfirm} onClose={() => setDelConfirm(null)} title="Remove Team Member" width={400}>
        {delConfirm && (
          <>
            <div style={{ textAlign:'center', padding:'12px 0 20px' }}>
              <Avatar name={delConfirm.name} size={56} color="var(--red)" />
              <div style={{ marginTop:12, fontWeight:700, fontSize:'1rem' }}>{delConfirm.name}</div>
              <div style={{ fontSize:'.8rem', color:'var(--muted2)', marginTop:4 }}>{delConfirm.email}</div>
              <div style={{ marginTop:14, fontSize:'.82rem', color:'var(--muted2)', lineHeight:1.6 }}>
                This will remove their login access.<br/>Their tasks and data will remain.
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={() => setDelConfirm(null)} style={{ flex:1 }}>Cancel</Btn>
              <Btn variant="danger" onClick={() => deleteUser(delConfirm.id)} style={{ flex:1 }}>Yes, Remove</Btn>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}
