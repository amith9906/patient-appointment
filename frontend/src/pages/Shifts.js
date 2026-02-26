import React, { useState, useEffect } from 'react';
import { shiftAPI, hospitalAPI, nurseAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT_SHIFT = { name: '', startTime: '09:00', endTime: '17:00', hospitalId: '' };

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT_SHIFT);
  const [tab, setTab] = useState('definitions');

  const [rosterDate, setRosterDate] = useState(new Date().toISOString().split('T')[0]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [quickForm, setQuickForm] = useState({ nurseId: '', shiftId: '', workArea: 'IPD', notes: '' });
  const [assigning, setAssigning] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkForm, setBulkForm] = useState({ nurseIds: [], shiftId: '', fromDate: rosterDate, toDate: rosterDate, workArea: 'IPD', notes: '' });
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState({ targetFrom: rosterDate, targetTo: rosterDate, nurseIds: [] });

  const loadRoster = async () => {
    try {
      const [aRes, nRes] = await Promise.all([
        shiftAPI.getAssignments({ date: rosterDate }),
        nurseAPI.getAll(),
      ]);
      setAllAssignments(aRes.data || []);
      setNurses(nRes.data || []);
    } catch {
      toast.error('Failed to load roster');
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([shiftAPI.getAll(), hospitalAPI.getAll()])
      .then(([s, h]) => {
        setShifts(s.data || []);
        setHospitals(h.data || []);
      })
      .catch(() => toast.error('Failed to load shifts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === 'roster') loadRoster();
  }, [tab, rosterDate]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...INIT_SHIFT, hospitalId: hospitals[0]?.id || '' });
    setModal(true);
  };

  const openEdit = (shift) => {
    setEditing(shift);
    setForm({ ...shift });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await shiftAPI.update(editing.id, form);
        toast.success('Shift updated');
      } else {
        await shiftAPI.create(form);
        toast.success('Shift created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    try {
      await shiftAPI.delete(id);
      toast.success('Shift deleted');
      load();
    } catch {
      toast.error('Error deleting shift');
    }
  };

  const columns = [
    { header: 'Shift Name', accessor: 'name' },
    { header: 'Start Time', accessor: 'startTime' },
    { header: 'End Time', accessor: 'endTime' },
    { header: 'Hospital', render: (s) => s.hospital?.name || 'All' },
    {
      header: 'Actions',
      render: (s) => (
        <div className={styles.actions}>
          <button className={styles.btnEdit} onClick={() => openEdit(s)}>Edit</button>
          <button className={styles.btnDelete} onClick={() => handleDelete(s.id)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Workforce & Shifts</h1>
          <p className={styles.pageSubtitle}>Manage shift definitions and daily duty rosters</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'definitions' && <button className={styles.btnPrimary} onClick={openCreate}>+ Define Shift</button>}
          {tab === 'roster' && (
            <>
              <button className={styles.btnPrimary} onClick={() => setShowQuickAssign(true)}>+ Quick Assign</button>
              <button className={styles.btnPrimary} onClick={() => setShowBulkAssign(true)}>+ Bulk Assign</button>
              <button className={styles.btnPrimary} onClick={() => setShowUploadModal(true)}>+ Upload Bulk</button>
              <button className={styles.btnSecondary} onClick={() => setShowCloneModal(true)}>Clone Last Week</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[['definitions', 'Shift Definitions'], ['roster', 'Duty Roster']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom: tab === t ? '3px solid #2563eb' : '3px solid transparent',
              background: 'none',
              fontWeight: 600,
              fontSize: 14,
              color: tab === t ? '#2563eb' : '#64748b',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'definitions' && <Table columns={columns} data={shifts} loading={loading} />}

      {tab === 'roster' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#64748b' }}>Select Date:</div>
            <input type="date" className={styles.input} style={{ maxWidth: 200 }} value={rosterDate} onChange={(e) => setRosterDate(e.target.value)} />
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{allAssignments.length} assignment(s) found for this day</div>
          </div>

          {showQuickAssign && (
            <div style={{ background: '#eff6ff', padding: 16, borderRadius: 12, border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, color: '#1e40af' }}>Assign Nurse to Shift</h3>
                <button className={styles.btnSecondary} onClick={() => setShowQuickAssign(false)}>X</button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAssigning(true);
                  try {
                    await shiftAPI.assign({ ...quickForm, date: rosterDate });
                    toast.success('Assigned successfully');
                    loadRoster();
                    setShowQuickAssign(false);
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Error');
                  } finally {
                    setAssigning(false);
                  }
                }}
                className={styles.grid2}
              >
                <div className={styles.field}>
                  <label className={styles.label}>Nurse</label>
                  <select className={styles.input} value={quickForm.nurseId} onChange={(e) => setQuickForm({ ...quickForm, nurseId: e.target.value })} required>
                    <option value="">Select Nurse...</option>
                    {nurses.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.specialization})</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Shift</label>
                  <select className={styles.input} value={quickForm.shiftId} onChange={(e) => setQuickForm({ ...quickForm, shiftId: e.target.value })} required>
                    <option value="">Select Shift...</option>
                    {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Work Area</label>
                  <select className={styles.input} value={quickForm.workArea} onChange={(e) => setQuickForm({ ...quickForm, workArea: e.target.value })}>
                    <option value="IPD">IPD</option>
                    <option value="OPD">OPD</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className={styles.btnPrimary} style={{ width: '100%' }} disabled={assigning}>
                    {assigning ? 'Assigning...' : 'Assign to Roster'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {showBulkAssign && (
            <div style={{ background: '#fff8ec', padding: 16, borderRadius: 12, border: '1px solid #fde3b7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, color: '#92400e' }}>Bulk Assign Nurses</h3>
                <button className={styles.btnSecondary} onClick={() => setShowBulkAssign(false)}>X</button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBulkAssigning(true);
                  try {
                    await shiftAPI.bulkAssign(bulkForm);
                    toast.success('Bulk assignments created');
                    loadRoster();
                    setShowBulkAssign(false);
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Error');
                  } finally {
                    setBulkAssigning(false);
                  }
                }}
                className={styles.grid2}
              >
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Nurses (multi-select)</label>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
                    {nurses.map(n => (
                      <label key={n.id} style={{ display: 'block', marginBottom: 6 }}>
                        <input type="checkbox" value={n.id} checked={bulkForm.nurseIds.includes(n.id)} onChange={(e) => {
                          const id = e.target.value;
                          setBulkForm(prev => ({ ...prev, nurseIds: prev.nurseIds.includes(id) ? prev.nurseIds.filter(x => x !== id) : [...prev.nurseIds, id] }));
                        }} /> {n.name} {n.specialization ? `(${n.specialization})` : ''}
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Shift</label>
                  <select className={styles.input} value={bulkForm.shiftId} onChange={(e) => setBulkForm({ ...bulkForm, shiftId: e.target.value })} required>
                    <option value="">Select Shift...</option>
                    {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>From</label>
                  <input type="date" className={styles.input} value={bulkForm.fromDate} onChange={(e) => setBulkForm({ ...bulkForm, fromDate: e.target.value })} required />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>To</label>
                  <input type="date" className={styles.input} value={bulkForm.toDate} onChange={(e) => setBulkForm({ ...bulkForm, toDate: e.target.value })} required />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Work Area</label>
                  <select className={styles.input} value={bulkForm.workArea} onChange={(e) => setBulkForm({ ...bulkForm, workArea: e.target.value })}>
                    <option value="IPD">IPD</option>
                    <option value="OPD">OPD</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Notes</label>
                  <input className={styles.input} value={bulkForm.notes} onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })} />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className={styles.btnPrimary} style={{ width: '100%' }} disabled={bulkAssigning}>{bulkAssigning ? 'Assigning...' : 'Bulk Assign'}</button>
                </div>
              </form>
            </div>
          )}

          {showUploadModal && (
            <div style={{ background: '#fff8ff', padding: 16, borderRadius: 12, border: '1px solid #f3d6ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, color: '#6b21a8' }}>Upload Bulk Assignments (CSV/Excel)</h3>
                <button className={styles.btnSecondary} onClick={() => setShowUploadModal(false)}>X</button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#475569' }}>File format: columns - nurseId OR email, shiftId OR shiftName, fromDate, toDate, workArea, notes</div>
                <input type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(e) => setUploadFile(e.target.files[0] || null)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.btnPrimary} onClick={async () => {
                    if (!uploadFile) return toast.error('Select a file');
                    setUploading(true);
                    setUploadErrors([]);
                    try {
                      const fd = new FormData();
                      fd.append('file', uploadFile);
                      const res = await shiftAPI.uploadBulk(fd);
                      toast.success(`Created ${res.data.createdCount} assignments`);
                      const errs = res.data.errors || [];
                      if (errs.length) {
                        setUploadErrors(errs);
                        // keep modal open so user can inspect errors
                        loadRoster();
                      } else {
                        setShowUploadModal(false);
                        loadRoster();
                      }
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Upload failed');
                    } finally { setUploading(false); }
                  }}>{uploading ? 'Uploading...' : 'Upload'}</button>
                  <button className={styles.btnSecondary} onClick={() => { setUploadFile(null); setUploadErrors([]); }}>Clear</button>
                </div>

                {uploadErrors && uploadErrors.length > 0 && (
                  <div style={{ marginTop: 12, border: '1px dashed #fecaca', padding: 8, borderRadius: 6, background: '#fff7f7' }}>
                    <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>Upload Errors ({uploadErrors.length})</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 13 }}>
                      {uploadErrors.map((e, idx) => (
                        <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid #fee2e2' }}>
                          <div><strong>Row:</strong> {e.row}</div>
                          <div><strong>Error:</strong> {e.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showCloneModal && (
            <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 12, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, color: '#166534' }}>Clone Last Week</h3>
                <button className={styles.btnSecondary} onClick={() => setShowCloneModal(false)}>X</button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await shiftAPI.cloneLastWeek(cloneForm);
                  toast.success('Cloned successfully');
                  loadRoster();
                  setShowCloneModal(false);
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Error');
                }
              }} className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Target From</label>
                  <input type="date" className={styles.input} value={cloneForm.targetFrom} onChange={(e) => setCloneForm({ ...cloneForm, targetFrom: e.target.value })} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Target To</label>
                  <input type="date" className={styles.input} value={cloneForm.targetTo} onChange={(e) => setCloneForm({ ...cloneForm, targetTo: e.target.value })} required />
                </div>
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Optional: Nurses (multi-select)</label>
                  <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
                    {nurses.map(n => (
                      <label key={n.id} style={{ display: 'block', marginBottom: 6 }}>
                        <input type="checkbox" value={n.id} checked={cloneForm.nurseIds.includes(n.id)} onChange={(e) => {
                          const id = e.target.value;
                          setCloneForm(prev => ({ ...prev, nurseIds: prev.nurseIds.includes(id) ? prev.nurseIds.filter(x => x !== id) : [...prev.nurseIds, id] }));
                        }} /> {n.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className={styles.btnPrimary} style={{ width: '100%' }}>Clone Week</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {shifts.map((shift) => {
              const shiftAssignments = allAssignments.filter((a) => a.shiftId === shift.id);
              // compute status: past / active / upcoming based on rosterDate and current time
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = rosterDate === todayStr;
              const now = new Date();
              const startDT = new Date(`${rosterDate}T${shift.startTime}`);
              let endDT = new Date(`${rosterDate}T${shift.endTime}`);
              // handle overnight shifts where end <= start
              if (endDT <= startDT) endDT.setDate(endDT.getDate() + 1);

              let status = 'upcoming';
              if ((isToday && now >= startDT && now < endDT) || (!isToday && rosterDate === todayStr && now >= startDT && now < endDT)) {
                status = 'active';
              } else if (new Date(rosterDate) < new Date(todayStr) || endDT <= now) {
                status = 'past';
              }

              const containerStyle = {
                background: status === 'active' ? '#ecfdf5' : '#fff',
                border: status === 'active' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              };
              return (
                <div key={shift.id} style={{ ...containerStyle, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#334155' }}>{shift.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{shift.startTime} - {shift.endTime}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: status === 'active' ? '#166534' : status === 'past' ? '#6b7280' : '#1d4ed8', fontWeight: 700 }}>
                        {status === 'active' ? 'Live' : status === 'past' ? 'Past' : 'Upcoming'}
                      </div>
                      <Badge color="primary">{shiftAssignments.length} Assigned</Badge>
                    </div>
                  </div>
                  <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                    {shiftAssignments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>No staff assigned</div>
                    ) : (
                      shiftAssignments.map((a) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>
                              {a.nurse?.name?.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{a.nurse?.name}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{a.workArea}</div>
                            </div>
                          </div>
                          <button
                            className={styles.btnDelete}
                            onClick={async () => {
                              if (!window.confirm('Remove from roster?')) return;
                              try {
                                await shiftAPI.removeAssignment(a.id);
                                loadRoster();
                                toast.success('Removed');
                              } catch {
                                toast.error('Error');
                              }
                            }}
                          >
                            X
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            {shifts.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>Schedule</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>No shifts defined</h2>
                <p>Go to Shift Definitions to set up working hours first.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Shift' : 'Define New Shift'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Shift Name</label>
            <input type="text" className={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning Shift, Night Shift" required />
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Start Time</label>
              <input type="time" className={styles.input} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>End Time</label>
              <input type="time" className={styles.input} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Hospital</label>
            <select className={styles.input} value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })} required>
              <option value="">Select Hospital</option>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Save Shift</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

