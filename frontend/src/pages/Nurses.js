import React, { useState, useEffect, useMemo } from 'react';
import { nurseAPI, hospitalAPI, departmentAPI, nurseLeaveAPI, shiftAPI, userAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT_NURSE = { name: '', specialization: '', phone: '', email: '', hospitalId: '', departmentId: '', userId: '', isActive: true };

export default function Nurses() {
  const [nurses, setNurses] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT_NURSE);
  const [detailModal, setDetailModal] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Leave State
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveNurse, setLeaveNurse] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ leaveDate: '', reason: '', isFullDay: true, startTime: '', endTime: '' });
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Shift Assignment State
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftNurse, setShiftNurse] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignForm, setAssignForm] = useState({ shiftId: '', date: new Date().toISOString().split('T')[0], workArea: 'IPD', notes: '' });
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([nurseAPI.getAll(), hospitalAPI.getAll()])
      .then(([n, h]) => {
        setNurses(n.data);
        setHospitals(h.data);
      })
      .catch(() => toast.error('Failed to load nurses'))
      .finally(() => {
        setLoading(false);
        loadUsers();
      });
  };

  const loadUsers = () => {
    userAPI
      .getAll({ role: 'nurse' })
      .then((res) => setUsers(res.data || []))
      .catch(() => setUsers([]));
  };

  const availableUsers = useMemo(() => {
    const assignedIds = new Set(nurses.filter((n) => n.userId).map((n) => n.userId));
    return users.filter((u) => !assignedIds.has(u.id) || u.id === form.userId);
  }, [users, nurses, form.userId]);

  const loadDepts = (hospitalId) => {
    if (hospitalId) departmentAPI.getAll({ hospitalId }).then((r) => setDepartments(r.data));
    else setDepartments([]);
  };

  const openCreate = () => {
    setEditing(null);
    const hospitalId = hospitals.length === 1 ? hospitals[0].id : '';
    setForm({ ...INIT_NURSE, hospitalId });
    if (hospitalId) loadDepts(hospitalId);
    setModal(true);
  };

  const openEdit = (nurse) => {
    setEditing(nurse);
    setForm({ ...nurse, hospitalId: nurse.hospitalId || '', departmentId: nurse.departmentId || '', userId: nurse.userId || '' });
    if (nurse.hospitalId) loadDepts(nurse.hospitalId);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await nurseAPI.update(editing.id, form);
        toast.success('Nurse updated');
      } else {
        await nurseAPI.create(form);
        toast.success('Nurse created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this nurse profile?')) return;
    try {
      await nurseAPI.delete(id);
      toast.success('Nurse deleted');
      load();
    } catch {
      toast.error('Error deleting nurse');
    }
  };

  // --- Leaves ---
  const openLeaves = async (nurse) => {
    setLeaveNurse(nurse);
    setLeaveForm({ leaveDate: '', reason: '', isFullDay: true, startTime: '', endTime: '' });
    setLeaveLoading(true);
    setLeaveModal(true);
    try {
      const res = await nurseLeaveAPI.getAll({ nurseId: nurse.id });
      setLeaves(res.data);
    } catch {
      setLeaves([]);
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await nurseLeaveAPI.apply({ ...leaveForm, nurseId: leaveNurse.id });
      toast.success('Leave applied');
      const res = await nurseLeaveAPI.getAll({ nurseId: leaveNurse.id });
      setLeaves(res.data);
      setLeaveForm({ leaveDate: '', reason: '', isFullDay: true, startTime: '', endTime: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error applying leave');
    }
  };

  const approveLeave = async (id) => {
    try {
      await nurseLeaveAPI.approve(id);
      toast.success('Leave approved');
      const res = await nurseLeaveAPI.getAll({ nurseId: leaveNurse.id });
      setLeaves(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const rejectLeave = async (id) => {
    try {
      await nurseLeaveAPI.reject(id);
      toast.success('Leave rejected');
      const res = await nurseLeaveAPI.getAll({ nurseId: leaveNurse.id });
      setLeaves(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  // --- Shifts ---
  const openShifts = async (nurse) => {
    setShiftNurse(nurse);
    setAssignLoading(true);
    setShiftModal(true);
    try {
      const [sRes, aRes] = await Promise.all([
        shiftAPI.getAll(),
        shiftAPI.getAssignments({ nurseId: nurse.id })
      ]);
      setShifts(sRes.data);
      setAssignments(aRes.data);
    } catch {
      setShifts([]);
      setAssignments([]);
    } finally {
      setAssignLoading(false);
    }
  };

  const openDetails = async (nurse) => {
    setDetailLoading(true);
    setDetailModal(true);
    try {
      const res = await nurseAPI.getOne(nurse.id);
      setDetailData(res.data || res);
    } catch (err) {
      toast.error('Failed to load nurse details');
      setDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAssignShift = async (e) => {
    e.preventDefault();
    try {
      await shiftAPI.assign({ ...assignForm, nurseId: shiftNurse.id });
      toast.success('Shift assigned');
      const res = await shiftAPI.getAssignments({ nurseId: shiftNurse.id });
      setAssignments(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error assigning shift');
    }
  };

  const removeAssignment = async (id) => {
    if (!window.confirm('Remove this assignment?')) return;
    try {
      await shiftAPI.removeAssignment(id);
      toast.success('Assignment removed');
      setAssignments(assignments.filter(a => a.id !== id));
    } catch {
      toast.error('Error');
    }
  };

  const filtered = nurses.filter(n => n.name.toLowerCase().includes(search.toLowerCase()) || n.specialization?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Specialization', accessor: 'specialization' },
    { header: 'Department', render: (n) => n.department?.name || n.departmentId || 'N/A' },
    { header: 'Phone', accessor: 'phone' },
    { header: 'Status', render: (n) => <Badge color={n.isActive ? 'success' : 'danger'}>{n.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: 'Actions',
      render: (n) => (
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => openDetails(n)}>View</button>
          <button className={styles.btnEdit} onClick={() => openEdit(n)}>Edit</button>
          <button className={styles.btnSecondary} onClick={() => openShifts(n)}>Shifts</button>
          <button className={styles.btnSecondary} onClick={() => openLeaves(n)}>Leaves</button>
          <button className={styles.btnDelete} onClick={() => handleDelete(n.id)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Nurses & Compounders</h1>
          <p className={styles.pageSubtitle}>Manage nursing staff and work assignments</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add Nurse</button>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by name or specialization..."
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table columns={columns} data={filtered} loading={loading} />

      {/* Main Form Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Nurse' : 'Add Nurse'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input type="text" className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Specialization</label>
              <input type="text" className={styles.input} value={form.specialization} onChange={(e) => set('specialization', e.target.value)} placeholder="e.g. ICU, General" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              <input type="text" className={styles.input} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input type="email" className={styles.input} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Hospital</label>
              <select
                className={styles.input}
                value={form.hospitalId}
                onChange={(e) => {
                  const id = e.target.value;
                  setForm({ ...form, hospitalId: id, departmentId: '' });
                  loadDepts(id);
                }}
                required
              >
                <option value="">Select Hospital</option>
                {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Department</label>
              <select className={styles.input} value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Linked System User (Optional)</label>
              <select
                className={styles.input}
                value={form.userId}
                onChange={(e) => set('userId', e.target.value)}
              >
                <option value="">Unlinked / select user</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email || 'Unnamed user') + (u.email ? ` — ${u.email}` : '')}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Drop-down only shows nurse users that aren’t already linked (or the user you are editing), so you always grab a fresh UUID.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 28 }}>
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              <label htmlFor="isActive" className={styles.label}>Profile Active</label>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Save Profile</button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title={`Nurse Details`} size="lg">
        {detailLoading ? (
          <div className="p-6 text-center">Loading...</div>
        ) : detailData ? (
          (() => {
            const nurseObj = detailData.nurse || detailData;
            const joinedAt = detailData.joinedAt || nurseObj.createdAt || nurseObj.joinedAt;
            const clinicalNotes = detailData.clinicalNotes || nurseObj.clinicalNotes || [];
            const supervisors = detailData.supervisors || [];
            const patientsAttended = detailData.patientsAttended || [];
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Name</div>
                    <div className="font-bold">{nurseObj.name || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Joined</div>
                    <div className="font-bold">{joinedAt ? new Date(joinedAt).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Department (current)</div>
                    <div className="font-bold">{(nurseObj.department && nurseObj.department.name) || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Hospital</div>
                    <div className="font-bold">{(nurseObj.hospital && nurseObj.hospital.name) || 'N/A'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold">Supervisors</h3>
                  {supervisors.length ? (
                    <ul>
                      {supervisors.map(s => <li key={s.id}>{s.name}</li>)}
                    </ul>
                  ) : <div className="text-sm text-slate-500">No supervisors found</div>}
                </div>

                <div>
                  <h3 className="font-bold">Patients Attended</h3>
                  {patientsAttended.length ? (
                    <div className="grid gap-2">
                      {patientsAttended.map(p => (
                        <div key={p.id} className="p-2 border rounded">{p.name} — {p.patientId || 'N/A'}</div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-slate-500">No patient records</div>}
                </div>

                <div>
                  <h3 className="font-bold">Recent Clinical Notes</h3>
                  {clinicalNotes.length ? (
                    <div className="space-y-2">
                      {clinicalNotes.map(n => (
                        <div key={n.id} className="p-3 bg-slate-50 rounded">
                          <div className="text-sm font-semibold">{n.type || 'Note'} — {n.patient?.name || 'Unknown patient'}</div>
                          <div className="text-xs text-slate-500">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                          <div className="mt-1 text-sm">{(n.content && n.content.text) || JSON.stringify(n.content)}</div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-slate-500">No clinical notes</div>}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="p-6 text-center text-slate-500">No details</div>
        )}
      </Modal>

      {/* Shifts Modal */}
      <Modal isOpen={shiftModal} onClose={() => setShiftModal(false)} title={`Shifts: ${shiftNurse?.name}`}>
        <div style={{ display: 'grid', gap: 16 }}>
          <form onSubmit={handleAssignShift} style={{ padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Assign New Shift</h3>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <input type="date" className={styles.input} value={assignForm.date} onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Shift</label>
                <select className={styles.input} value={assignForm.shiftId} onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })} required>
                  <option value="">Select Shift</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Work Area</label>
                <select className={styles.input} value={assignForm.workArea} onChange={(e) => setAssignForm({ ...assignForm, workArea: e.target.value })}>
                  <option value="IPD">IPD</option>
                  <option value="OPD">OPD</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <input type="text" className={styles.input} value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} />
              </div>
            </div>
            <button type="submit" className={styles.btnPrimary} style={{ width: '100%', marginTop: 8 }} disabled={!assignForm.shiftId}>Assign Shift</button>
          </form>

          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Assignment History</h3>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Shift</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Area</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px' }}>{a.date}</td>
                      <td style={{ padding: '8px 10px' }}>{a.shift?.name}</td>
                      <td style={{ padding: '8px 10px' }}><Badge color="info">{a.workArea}</Badge></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button className={styles.btnDelete} onClick={() => removeAssignment(a.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && <tr><td colSpan="4" style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>No shifts assigned yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* Leaves Modal */}
      <Modal isOpen={leaveModal} onClose={() => setLeaveModal(false)} title={`Leaves: ${leaveNurse?.name}`}>
        <div style={{ display: 'grid', gap: 16 }}>
          <form onSubmit={handleApplyLeave} style={{ padding: 12, background: '#fff1f2', borderRadius: 10, border: '1px solid #fecdd3' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Add Leave Application</h3>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <input type="date" className={styles.input} value={leaveForm.leaveDate} onChange={(e) => setLeaveForm({ ...leaveForm, leaveDate: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 26 }}>
                <input type="checkbox" id="leaveFullDay" checked={leaveForm.isFullDay} onChange={(e) => setLeaveForm({ ...leaveForm, isFullDay: e.target.checked })} />
                <label htmlFor="leaveFullDay" className={styles.label}>Full Day</label>
              </div>
              {!leaveForm.isFullDay && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time</label>
                    <input type="time" className={styles.input} value={leaveForm.startTime} onChange={(e) => setLeaveForm({ ...leaveForm, startTime: e.target.value })} required={!leaveForm.isFullDay} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time</label>
                    <input type="time" className={styles.input} value={leaveForm.endTime} onChange={(e) => setLeaveForm({ ...leaveForm, endTime: e.target.value })} required={!leaveForm.isFullDay} />
                  </div>
                </>
              )}
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Reason</label>
                <input type="text" className={styles.input} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} required />
              </div>
            </div>
            <button type="submit" className={styles.btnPrimary} style={{ width: '100%', marginTop: 8 }}>Submit Application</button>
          </form>

          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px' }}>{l.leaveDate}</td>
                    <td style={{ padding: '8px 10px' }}>
                       <Badge color={l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'}>
                         {l.status}
                       </Badge>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {l.status === 'pending' && (
                        <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                          <button className={styles.btnSuccess} onClick={() => approveLeave(l.id)}>Approve</button>
                          <button className={styles.btnDelete} onClick={() => rejectLeave(l.id)}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && <tr><td colSpan="3" style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>No leaves found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

    </div>
  );

  function set(k, v) {
    setForm({ ...form, [k]: v });
  }
}
