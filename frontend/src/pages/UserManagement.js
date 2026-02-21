import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import Table from '../components/Table';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import styles from './Page.module.css';

const ROLES = ['super_admin', 'admin', 'doctor', 'receptionist', 'lab_technician', 'patient'];
const INIT = { name: '', email: '', password: '', role: 'receptionist', hospitalId: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [doctorProfiles, setDoctorProfiles] = useState([]);
  const [assignModal, setAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignDoctorId, setAssignDoctorId] = useState('');

  const load = () => {
    setLoading(true);
    const params = {};
    if (roleFilter) params.role = roleFilter;
    if (search) params.search = search;
    Promise.all([api.get('/users', { params }), api.get('/users/stats'), api.get('/doctors')])
      .then(([u, s, d]) => {
        setUsers(u.data);
        setStats(s.data);
        setDoctorProfiles(d.data || []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [roleFilter]);
  useEffect(() => {
    api.get('/hospitals').then((res) => setHospitals(res.data || [])).catch(() => setHospitals([]));
  }, []);

  const openCreate = () => { setEditing(null); setForm(INIT); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, role: u.role, password: '', hospitalId: u.hospitalId || '' }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form };
      if (editing && !data.password) delete data.password;
      if (editing) { await api.put(`/users/${editing.id}`, data); toast.success('User updated'); }
      else { await api.post('/users', data); toast.success('User created'); }
      setModal(false); load();
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const toggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}/toggle`);
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch { toast.error('Error'); }
  };

  const openAssignDoctor = (user) => {
    setAssignTarget(user);
    const linked = doctorProfiles.find((d) => d.userId === user.id);
    setAssignDoctorId(linked.id || '');
    setAssignModal(true);
  };

  const submitAssignDoctor = async (e) => {
    e.preventDefault();
    if (!assignTarget || !assignDoctorId) return;
    try {
      await api.post(`/users/${assignTarget.id}/assign-doctor`, { doctorId: assignDoctorId });
      toast.success('Doctor profile mapped successfully');
      setAssignModal(false);
      setAssignTarget(null);
      setAssignDoctorId('');
      load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to map doctor profile');
    }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const filtered = search ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) : users;
  const availableProfilesForAssign = assignTarget
    ? doctorProfiles.filter((d) => !d.userId || d.userId === assignTarget.id)
    : doctorProfiles;

  const ROLE_COLORS = { super_admin: '#0f172a', admin: '#dc2626', doctor: '#2563eb', receptionist: '#16a34a', lab_technician: '#9333ea', patient: '#d97706' };

  const columns = [
    { key: 'name', label: 'Name', render: (v, r) => <div><div className="font-semibold">{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.email}</div></div> },
    { key: 'role', label: 'Role', render: (v) => (
      <span style={{ background: ROLE_COLORS[v] + '20', color: ROLE_COLORS[v], padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
        {v.replace('_', ' ')}
      </span>
    )},
    { key: 'isActive', label: 'Status', render: (v) => <Badge text={v ? 'Active' : 'Inactive'} type={v ? 'active' : 'inactive'} /> },
    { key: 'createdAt', label: 'Joined', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => openEdit(r)}>Edit</button>
        {r.role === 'doctor' && (
          <button className={styles.btnSecondary} onClick={() => openAssignDoctor(r)}>Map Doctor</button>
        )}
        <button className={r.isActive ? styles.btnDelete : styles.btnSuccess} onClick={() => toggleActive(r)}>
          {r.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>User Management</h2><p className={styles.pageSubtitle}>Manage all system users and roles</p></div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add User</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {ROLES.map(r => (
          <div key={r} onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
            style={{ background:roleFilter === r ? ROLE_COLORS[r] : '#fff', color:roleFilter === r ? '#fff' : ROLE_COLORS[r],
              border: `2px solid ${ROLE_COLORS[r]}`, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
            {stats[r] || 0} {r.replace('_', ' ')}
          </div>
        ))}
        <div style={{ background: '#1e293b', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
          {stats.total || 0} Total Users
        </div>
      </div>

      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search by name or email..." value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <button className={styles.btnSecondary} onClick={load}>Search</button>
        {(search || roleFilter) && <button className={styles.btnSecondary} onClick={() => { setSearch(''); setRoleFilter(''); }}>Clear</button>}
      </div>

      <div className={styles.card}><Table columns={columns} data={filtered} loading={loading} /></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div className={styles.field}><label className={styles.label}>Full Name *</label><input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Email *</label><input type="email" className={styles.input} value={form.email} onChange={e => set('email', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" className={styles.input} value={form.password} onChange={e => set('password', e.target.value)} required={!editing} minLength={6} />
            </div>
            <div className={styles.field}><label className={styles.label}>Role</label>
              <select className={styles.input} value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Hospital</label>
              <SearchableSelect
                className={styles.input}
                value={form.hospitalId || ''}
                onChange={(value) => set('hospitalId', value)}
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                placeholder="Search hospital..."
                emptyLabel="Not Assigned"
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title="Map Doctor Profile">
        <form onSubmit={submitAssignDoctor} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div className={styles.field}>
              <label className={styles.label}>Doctor User</label>
              <input className={styles.input} value={assignTarget ? `${assignTarget.name} (${assignTarget.email})` : ''} readOnly />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Doctor Profile *</label>
              <SearchableSelect
                className={styles.input}
                value={assignDoctorId}
                onChange={(value) => setAssignDoctorId(value)}
                options={availableProfilesForAssign.map((d) => ({
                  value: d.id,
                  label: `${d.name}${d.email ? ` (${d.email})` : ''}${d.hospital?.name ? ` - ${d.hospital.name}` : ''}`,
                }))}
                placeholder="Search doctor profile..."
                emptyLabel="Select doctor profile"
                required
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setAssignModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Map</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
