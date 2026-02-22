import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ipdAPI, patientAPI, doctorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import styles from './Page.module.css';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  admitted:    { background: '#dcfce7', color: '#15803d' },
  discharged:  { background: '#dbeafe', color: '#1d4ed8' },
  transferred: { background: '#fef9c3', color: '#854d0e' },
};

const ROOM_TYPE_STYLE = {
  general:      { background: '#f1f5f9', color: '#475569' },
  semi_private: { background: '#ede9fe', color: '#6d28d9' },
  private:      { background: '#dcfce7', color: '#15803d' },
  icu:          { background: '#fee2e2', color: '#dc2626' },
  emergency:    { background: '#ffedd5', color: '#c2410c' },
};

const INIT_ADMIT_FORM = {
  patientId: '', doctorId: '', roomId: '', admissionDate: today(),
  admissionType: 'planned', admissionDiagnosis: '', notes: '', totalAmount: '',
};

const INIT_ROOM_FORM = {
  roomNumber: '', roomType: 'general', floor: '', totalBeds: 1, pricePerDay: '', description: '',
};

export default function IPD() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('admissions');

  // Admissions
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const [admissionPage, setAdmissionPage] = useState(1);
  const [admissionPerPage, setAdmissionPerPage] = useState(20);
  const [admissionPagination, setAdmissionPagination] = useState(null);
  const [stats, setStats] = useState({
    totalAdmitted: 0, dischargedToday: 0, totalRooms: 0, occupiedRooms: 0,
    occupancyRate: 0, totalBeds: 0, availableBeds: 0,
    dischargesLast7: 0, dischargesLast30: 0, dischargesPerDay: 0,
    averageStayDays: 0, upcomingDischarges: 0, roomTypeBreakdown: [],
    revenueThisMonth: 0, pendingDues: 0, gstCollected: 0,
  });

  // Rooms
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState(INIT_ROOM_FORM);
  const [roomEditTarget, setRoomEditTarget] = useState(null);
  const [roomSaving, setRoomSaving] = useState(false);

  // Admit patient
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [admitForm, setAdmitForm] = useState(INIT_ADMIT_FORM);
  const [admitting, setAdmitting] = useState(false);

  const loadStats = () => {
    ipdAPI.getStats().then(r => setStats(r.data || {})).catch(() => {});
  };

  const loadAdmissions = useCallback((f = filters) => {
    setLoading(true);
    const params = {
      page: admissionPage,
      per_page: admissionPerPage,
    };
    if (f.status) params.status = f.status;
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    ipdAPI.getAdmissions(params)
      .then((r) => {
        setAdmissions(r.data || []);
        setAdmissionPagination(r.pagination || null);
      })
      .catch(() => toast.error('Failed to load admissions'))
      .finally(() => setLoading(false));
  }, [filters.status, filters.from, filters.to, admissionPage, admissionPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRooms = () => {
    setRoomsLoading(true);
    ipdAPI.getRooms().then(r => setRooms(r.data || [])).catch(() => {}).finally(() => setRoomsLoading(false));
  };

  useEffect(() => {
    loadAdmissions();
    loadStats();
    patientAPI.getAll({ paginate: 'false' }).then((r) => setPatients(r.data?.patients || r.data || [])).catch(() => {});
    if (user.role !== 'doctor') {
      doctorAPI.getAll().then((r) => setDoctors(r.data?.doctors || r.data || [])).catch(() => {});
    }
  }, [loadAdmissions]);

  useEffect(() => {
    setAdmissionPage(1);
  }, [filters.status, filters.from, filters.to]);

  useEffect(() => {
    if (tab === 'rooms') loadRooms();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Rooms CRUD ────────────────────────────────────────────────────────────

  const openAddRoom = () => { setRoomEditTarget(null); setRoomForm(INIT_ROOM_FORM); setRoomModalOpen(true); };
  const openEditRoom = (r) => {
    setRoomEditTarget(r);
    setRoomForm({ roomNumber: r.roomNumber, roomType: r.roomType, floor: r.floor || '', totalBeds: r.totalBeds, pricePerDay: r.pricePerDay, description: r.description || '' });
    setRoomModalOpen(true);
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!roomForm.roomNumber.trim()) return toast.error('Room number required');
    setRoomSaving(true);
    try {
      if (roomEditTarget) {
        await ipdAPI.updateRoom(roomEditTarget.id, roomForm);
        toast.success('Room updated');
      } else {
        await ipdAPI.createRoom(roomForm);
        toast.success('Room created');
      }
      setRoomModalOpen(false);
      loadRooms();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    } finally {
      setRoomSaving(false);
    }
  };

  const handleDeleteRoom = async (room) => {
    if (!window.confirm(`Deactivate room ${room.roomNumber}?`)) return;
    try {
      await ipdAPI.deleteRoom(room.id);
      toast.success('Room deactivated');
      loadRooms();
    } catch (err) {
      toast.error('Failed');
    }
  };

  // ─── Admit Patient ─────────────────────────────────────────────────────────

  const handleAdmit = async (e) => {
    e.preventDefault();
    if (!admitForm.patientId) return toast.error('Select a patient');
    if (!admitForm.doctorId) return toast.error('Select a doctor');
    if (!admitForm.admissionDate) return toast.error('Admission date required');
    setAdmitting(true);
    try {
      await ipdAPI.admit(admitForm);
      toast.success('Patient admitted successfully');
      setAdmitForm(INIT_ADMIT_FORM);
      setTab('admissions');
      loadAdmissions();
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to admit patient');
    } finally {
      setAdmitting(false);
    }
  };

  const patientOptions = patients.map(p => ({ value: p.id, label: `${p.name} (${p.patientId || ''})` }));
  const doctorOptions = doctors.map(d => ({ value: d.id, label: `Dr. ${d.name}` }));
  const roomOptions = rooms.map(r => ({
    value: r.id,
    label: `Room ${r.roomNumber} — ${r.roomType}${r.floor ? ` (Floor ${r.floor})` : ''}${r.occupancy >= r.totalBeds ? ' [FULL]' : ''}`,
  }));

  const getDaysAdmitted = (admissionDate) => {
    const diff = new Date() - new Date(admissionDate);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>IPD Management</h1>
          <p className={styles.pageSubtitle}>In-Patient Department — admissions, rooms, and clinical notes</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setTab('admit')}>+ Admit Patient</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Currently Admitted', value: stats.totalAdmitted, color: '#15803d', bg: '#dcfce7' },
          { label: 'Discharged Today', value: stats.dischargedToday, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'Total Rooms', value: stats.totalRooms, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Occupied Rooms', value: stats.occupiedRooms, color: '#c2410c', bg: '#ffedd5' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ color: c.color, fontSize: 26, fontWeight: 700 }}>{c.value}</div>
            <div style={{ color: c.color, fontSize: 13, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            {
              label: 'Occupancy Rate',
              value: `${stats.occupancyRate?.toFixed ? stats.occupancyRate.toFixed(1) : stats.occupancyRate}%`,
              note: `${stats.occupiedRooms}/${stats.totalBeds || stats.totalRooms || 0} beds occupied`,
            },
            {
              label: 'Available Beds',
              value: stats.availableBeds ?? 0,
              note: 'Beds free for admission',
            },
            {
              label: 'Avg Stay (30d)',
              value: `${stats.averageStayDays ?? 0} days`,
              note: 'Mean discharge duration',
            },
            {
              label: 'Discharges (7d)',
              value: `${stats.dischargesLast7 ?? 0} (${stats.dischargesPerDay?.toFixed ? stats.dischargesPerDay.toFixed(1) : stats.dischargesPerDay}/day)`,
              note: `${stats.upcomingDischarges ?? 0} discharges due soon`,
            },
          ].map((card) => (
            <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
              <div style={{ fontSize: 14, color: '#475569', fontWeight: 600, marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{card.note}</div>
            </div>
          ))}
        </div>
        {/* Billing stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            {
              label: 'Revenue This Month',
              value: `₹${Number(stats.revenueThisMonth || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              note: 'Payments received (current month)',
              color: '#15803d', bg: '#dcfce7',
            },
            {
              label: 'Pending Dues',
              value: `₹${Number(stats.pendingDues || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              note: 'Outstanding balance from active admissions',
              color: '#dc2626', bg: '#fee2e2',
            },
            {
              label: 'GST Collected',
              value: `₹${Number(stats.gstCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              note: 'Total GST from all bill items',
              color: '#7c3aed', bg: '#ede9fe',
            },
          ].map((card) => (
            <div key={card.label} style={{ background: card.bg || '#fff', borderRadius: 12, border: card.bg ? 'none' : '1px solid #e2e8f0', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: card.color || '#475569', fontWeight: 600, marginBottom: 4 }}>
                {card.label}
                {card.label === 'GST Collected' && (
                  <span
                    title={`GST is calculated per bill item based on item type:\n• Room Charges: 0%\n• Consultation: 0%\n• Procedure: 5%\n• Lab Test: 0%\n• Medication: 5%\n• OT Charges: 5%\n• Nursing: 0%\n• Equipment: 12%\n• Other: 0%\n\nFormula: Amount × GST% = GST₹\nTotal = Sum of gstAmount from all bill items of admitted patients.`}
                    style={{ cursor: 'help', fontSize: 14, opacity: 0.7, lineHeight: 1 }}>
                    ⓘ
                  </span>
                )}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color || '#1e293b' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: card.color || '#64748b', marginTop: 4, opacity: 0.75 }}>{card.note}</div>
            </div>
          ))}
        </div>

        {stats.roomTypeBreakdown?.length > 0 && (
          <div className={styles.card} style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>Room utilization by type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.roomTypeBreakdown.map((room) => (
                <div key={room.roomType} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{room.roomType.replace('_', ' ')}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {room.occupied}/{room.beds} beds • {room.rooms} room{room.rooms !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 600 }}>{room.utilizationPct ?? 0}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {[
          { key: 'admissions', label: 'Active Admissions' },
          { key: 'rooms', label: 'Rooms' },
          { key: 'admit', label: '+ Admit Patient' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: 'none', borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              color: tab === t.key ? '#2563eb' : '#64748b', marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── ADMISSIONS TAB ─── */}
      {tab === 'admissions' && (
        <>
          {/* Filters */}
          <div className={styles.filterBar}>
            <select className={styles.filterSelect} value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option value="admitted">Admitted</option>
              <option value="discharged">Discharged</option>
              <option value="transferred">Transferred</option>
            </select>
            <input type="date" className={styles.filterSelect} value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            <input type="date" className={styles.filterSelect} value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            <button className={styles.btnPrimary} onClick={() => loadAdmissions(filters)}>Filter</button>
            <button className={styles.btnSecondary} onClick={() => { const f = { status: '', from: '', to: '' }; setFilters(f); loadAdmissions(f); }}>Reset</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
          ) : admissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No admissions found.{' '}
              <button onClick={() => setTab('admit')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Admit a patient</button>
            </div>
          ) : (
            <div className={styles.card} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      {['Admission #', 'Patient', 'Doctor', 'Room', 'Admitted On', 'Diagnosis', 'Days', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admissions.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{a.admissionNumber}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 500 }}>{a.patient?.name}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.patient?.phone}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>Dr. {a.doctor?.name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {a.room ? (
                            <>
                              <div>Room {a.room.roomNumber}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.room.roomType}{a.room.floor ? ` · Floor ${a.room.floor}` : ''}</div>
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{a.admissionDate}</td>
                        <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.admissionDiagnosis || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {a.status === 'admitted' ? getDaysAdmitted(a.admissionDate) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ ...STATUS_STYLE[a.status], borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div className={styles.actions}>
                            <button className={styles.btnEdit} onClick={() => navigate(`/ipd/${a.id}`)}>View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                meta={admissionPagination}
                onPageChange={(nextPage) => setAdmissionPage(nextPage)}
                onPerPageChange={(value) => {
                  setAdmissionPerPage(value);
                  setAdmissionPage(1);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* ─── ROOMS TAB ─── */}
      {tab === 'rooms' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            {['super_admin', 'admin'].includes(user.role) && (
              <button className={styles.btnPrimary} onClick={openAddRoom}>+ Add Room</button>
            )}
          </div>

          {roomsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading rooms...</div>
          ) : rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No rooms configured yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {rooms.map(room => (
                <div key={room.id} className={styles.card} style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>Room {room.roomNumber}</div>
                      {room.floor && <div style={{ fontSize: 12, color: '#94a3b8' }}>Floor {room.floor}</div>}
                    </div>
                    <span style={{ ...ROOM_TYPE_STYLE[room.roomType], borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                      {room.roomType.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#475569', marginBottom: 12 }}>
                    <div><span style={{ color: '#94a3b8' }}>Beds:</span> {room.totalBeds}</div>
                    <div><span style={{ color: '#94a3b8' }}>Occupied:</span> {room.occupancy || 0}</div>
                    <div><span style={{ color: '#94a3b8' }}>Rate:</span> Rs {Number(room.pricePerDay || 0).toLocaleString('en-IN')}/day</div>
                    <div>
                      <span style={{
                        background: room.occupancy >= room.totalBeds ? '#fee2e2' : '#dcfce7',
                        color: room.occupancy >= room.totalBeds ? '#dc2626' : '#15803d',
                        borderRadius: 6, padding: '1px 8px', fontSize: 12, fontWeight: 600,
                      }}>
                        {room.occupancy >= room.totalBeds ? 'Full' : 'Available'}
                      </span>
                    </div>
                  </div>
                  {room.description && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{room.description}</div>}
                  {['super_admin', 'admin'].includes(user.role) && (
                    <div className={styles.actions}>
                      <button className={styles.btnEdit} onClick={() => openEditRoom(room)}>Edit</button>
                      <button className={styles.btnDelete} onClick={() => handleDeleteRoom(room)}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Room Modal */}
          {roomModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>{roomEditTarget ? 'Edit Room' : 'Add Room'}</h3>
                <form onSubmit={handleSaveRoom} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className={styles.label}>Room Number *</label>
                      <input className={styles.input} value={roomForm.roomNumber} required
                        onChange={e => setRoomForm(f => ({ ...f, roomNumber: e.target.value }))} placeholder="e.g. 101" />
                    </div>
                    <div>
                      <label className={styles.label}>Type</label>
                      <select className={styles.input} value={roomForm.roomType}
                        onChange={e => setRoomForm(f => ({ ...f, roomType: e.target.value }))}>
                        <option value="general">General</option>
                        <option value="semi_private">Semi Private</option>
                        <option value="private">Private</option>
                        <option value="icu">ICU</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label className={styles.label}>Floor</label>
                      <input className={styles.input} value={roomForm.floor}
                        onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 1" />
                    </div>
                    <div>
                      <label className={styles.label}>Total Beds</label>
                      <input className={styles.input} type="number" min={1} value={roomForm.totalBeds}
                        onChange={e => setRoomForm(f => ({ ...f, totalBeds: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className={styles.label}>Price / Day (Rs)</label>
                      <input className={styles.input} type="number" min={0} step="0.01" value={roomForm.pricePerDay}
                        onChange={e => setRoomForm(f => ({ ...f, pricePerDay: e.target.value }))} placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className={styles.label}>Description</label>
                    <input className={styles.input} value={roomForm.description}
                      onChange={e => setRoomForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes" />
                  </div>
                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setRoomModalOpen(false)}>Cancel</button>
                    <button type="submit" className={styles.btnPrimary} disabled={roomSaving}>
                      {roomSaving ? 'Saving...' : roomEditTarget ? 'Update' : 'Add Room'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── ADMIT PATIENT TAB ─── */}
      {tab === 'admit' && (
        <div style={{ maxWidth: 700, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Admit Patient</h2>
          <form onSubmit={handleAdmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className={styles.label}>Patient <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect options={patientOptions} value={admitForm.patientId}
                onChange={v => setAdmitForm(f => ({ ...f, patientId: v }))} placeholder="Search patient..." />
            </div>
            <div>
              <label className={styles.label}>Doctor <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect options={doctorOptions} value={admitForm.doctorId}
                onChange={v => setAdmitForm(f => ({ ...f, doctorId: v }))} placeholder="Select doctor..." />
            </div>
            <div>
              <label className={styles.label}>Room (optional)</label>
              <SearchableSelect options={roomOptions} value={admitForm.roomId}
                onChange={v => setAdmitForm(f => ({ ...f, roomId: v }))} placeholder="Select room..." />
              {rooms.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  No rooms available. <button type="button" onClick={() => setTab('rooms')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>Add rooms first</button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className={styles.label}>Admission Date <span style={{ color: '#dc2626' }}>*</span></label>
                <input className={styles.input} type="date" value={admitForm.admissionDate}
                  onChange={e => setAdmitForm(f => ({ ...f, admissionDate: e.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Admission Type</label>
                <select className={styles.input} value={admitForm.admissionType}
                  onChange={e => setAdmitForm(f => ({ ...f, admissionType: e.target.value }))}>
                  <option value="planned">Planned</option>
                  <option value="emergency">Emergency</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>
            <div>
              <label className={styles.label}>Admission Diagnosis</label>
              <textarea className={styles.input} rows={2} value={admitForm.admissionDiagnosis}
                onChange={e => setAdmitForm(f => ({ ...f, admissionDiagnosis: e.target.value }))}
                placeholder="Chief complaint / admission diagnosis..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className={styles.label}>Estimated Amount (Rs)</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={admitForm.totalAmount}
                  onChange={e => setAdmitForm(f => ({ ...f, totalAmount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={styles.label}>Notes</label>
              <textarea className={styles.input} rows={2} value={admitForm.notes}
                onChange={e => setAdmitForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..." />
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setTab('admissions')}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={admitting}>
                {admitting ? 'Admitting...' : 'Admit Patient'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
