import React, { useState, useEffect } from 'react';
import { appointmentAPI, doctorAPI } from '../services/api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_LABELS = {
  consultation: 'Consultation', procedure: 'Procedure', medication: 'Medication',
  lab_test: 'Lab Test', room_charge: 'Room Charge', other: 'Other',
};

export default function Billing() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filters, setFilters]           = useState({ dateFrom: '', dateTo: '', doctorId: '', isPaid: '' });

  // Detail modal
  const [detailAppt, setDetailAppt]     = useState(null);
  const [billItems, setBillItems]       = useState([]);
  const [billLoading, setBillLoading]   = useState(false);

  // Load
  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.dateFrom) params.from = filters.dateFrom;
    if (filters.dateTo)   params.to   = filters.dateTo;
    if (filters.doctorId) params.doctorId = filters.doctorId;
    if (filters.isPaid !== '') params.isPaid = filters.isPaid;
    Promise.all([appointmentAPI.getAll(params), doctorAPI.getAll()])
      .then(([a, d]) => {
        // Only show appointments that have a fee or treatmentBill or are explicitly paid
        const billed = a.data.filter(r =>
          Number(r.fee || 0) > 0 || Number(r.treatmentBill || 0) > 0 || r.isPaid
        );
        setAppointments(billed);
        setDoctors(d.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const applyFilters = () => load();
  const resetFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', doctorId: '', isPaid: '' });
    setLoading(true);
    Promise.all([appointmentAPI.getAll(), doctorAPI.getAll()])
      .then(([a, d]) => {
        setAppointments(a.data.filter(r => Number(r.fee||0) > 0 || Number(r.treatmentBill||0) > 0 || r.isPaid));
        setDoctors(d.data);
      })
      .finally(() => setLoading(false));
  };

  // Summary stats
  const totalBilled    = appointments.reduce((s, a) => s + Number(a.fee||0) + Number(a.treatmentBill||0), 0);
  const totalCollected = appointments.filter(a => a.isPaid).reduce((s, a) => s + Number(a.fee||0) + Number(a.treatmentBill||0), 0);
  const totalPending   = totalBilled - totalCollected;

  // Open detail modal
  const openDetail = async (appt) => {
    setDetailAppt(appt);
    setBillItems([]);
    setBillLoading(true);
    try {
      const res = await appointmentAPI.getBillItems(appt.id);
      setBillItems(res.data || []);
    } catch { setBillItems([]); }
    finally { setBillLoading(false); }
  };

  // Toggle paid
  const togglePaid = async (appt, e) => {
    e.stopPropagation();
    try {
      const res = await appointmentAPI.markPaid(appt.id);
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, isPaid: res.data.isPaid } : a));
      if (detailAppt?.id === appt.id) setDetailAppt(d => ({ ...d, isPaid: res.data.isPaid }));
      toast.success(res.data.isPaid ? 'Marked as Paid' : 'Marked as Unpaid');
    } catch { toast.error('Failed to update payment status'); }
  };

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Billing</h2>
          <p className={styles.pageSubtitle}>{appointments.length} billing records</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <input type="date" className={styles.filterSelect} value={filters.dateFrom}
          onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} placeholder="From date" />
        <input type="date" className={styles.filterSelect} value={filters.dateTo}
          onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} placeholder="To date" />
        <select className={styles.filterSelect} value={filters.doctorId}
          onChange={e => setFilters(f => ({ ...f, doctorId: e.target.value }))}>
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={filters.isPaid}
          onChange={e => setFilters(f => ({ ...f, isPaid: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="true">Paid</option>
          <option value="false">Unpaid</option>
        </select>
        <button className={styles.btnPrimary} onClick={applyFilters}>Apply</button>
        <button className={styles.btnSecondary} onClick={resetFilters}>Reset</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Billed', value: fmt(totalBilled), color: '#2563eb', bg: '#eff6ff' },
          { label: 'Collected', value: fmt(totalCollected), color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Pending', value: fmt(totalPending), color: '#dc2626', bg: '#fef2f2' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 12, padding: '16px 20px', border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card}>
        {loading ? (
          <div className="flex justify-center p-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
            <div>No billing records found</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Apt #', 'Patient', 'Doctor', 'Date', 'Consult Fee', 'Treatment', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map(appt => {
                const total = Number(appt.fee||0) + Number(appt.treatmentBill||0);
                return (
                  <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{appt.appointmentNumber}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{appt.patient?.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{appt.patient?.patientId}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {appt.doctor ? `Dr. ${appt.doctor.name}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{appt.appointmentDate}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{Number(appt.fee||0) > 0 ? fmt(appt.fee) : '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{Number(appt.treatmentBill||0) > 0 ? fmt(appt.treatmentBill) : '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>{fmt(total)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: appt.isPaid ? '#dcfce7' : '#fef3c7',
                        color: appt.isPaid ? '#16a34a' : '#b45309',
                      }}>
                        {appt.isPaid ? '✓ Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openDetail(appt)}
                          style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, background: '#eff6ff', color: '#2563eb',
                            border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                          View
                        </button>
                        {!appt.isPaid && (
                          <button onClick={(e) => togglePaid(appt, e)}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, background: '#f0fdf4', color: '#16a34a',
                              border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}>
                            Mark Paid
                          </button>
                        )}
                        {appt.isPaid && (
                          <button onClick={(e) => togglePaid(appt, e)}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, background: '#fef2f2', color: '#dc2626',
                              border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                            Undo Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal isOpen={!!detailAppt} onClose={() => setDetailAppt(null)} title="Bill Details" size="lg">
        {detailAppt && (
          <div>
            {/* Appointment info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20,
              background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
              {[
                ['Appointment #', detailAppt.appointmentNumber],
                ['Date', detailAppt.appointmentDate],
                ['Patient', detailAppt.patient?.name],
                ['Patient ID', detailAppt.patient?.patientId],
                ['Doctor', detailAppt.doctor ? `Dr. ${detailAppt.doctor.name}` : '—'],
                ['Appointment Type', detailAppt.type?.replace(/_/g,' ')],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Bill items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10 }}>Bill Items</div>

              {billLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  {/* Consultation fee row */}
                  {Number(detailAppt.fee || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: '#eff6ff', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#1e40af' }}>Consultation Fee</span>
                        <span style={{ marginLeft: 8, fontSize: 11, background: '#bfdbfe', color: '#1e40af',
                          borderRadius: 10, padding: '1px 8px' }}>Consultation</span>
                      </div>
                      <span style={{ fontWeight: 700, color: '#1e40af' }}>{fmt(detailAppt.fee)}</span>
                    </div>
                  )}

                  {/* Treatment items */}
                  {billItems.length === 0 && Number(detailAppt.treatmentBill || 0) > 0 && (
                    <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13,
                      color: '#64748b', fontStyle: 'italic', marginBottom: 6 }}>
                      Treatment charges: {fmt(detailAppt.treatmentBill)} (no itemized breakdown)
                    </div>
                  )}

                  {billItems.map((item, idx) => (
                    <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: '#374151' }}>{item.description}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 11, color: '#94a3b8' }}>
                          <span style={{ background: '#e2e8f0', borderRadius: 8, padding: '0px 6px' }}>
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                          <span>Qty: {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: '#374151', marginLeft: 16 }}>{fmt(item.amount)}</span>
                    </div>
                  ))}

                  {/* Total row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                    borderTop: '2px solid #e2e8f0', marginTop: 8, fontWeight: 700, fontSize: 15 }}>
                    <span>Total</span>
                    <span style={{ color: '#2563eb' }}>
                      {fmt(Number(detailAppt.fee||0) + Number(detailAppt.treatmentBill||0))}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Pay toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: detailAppt.isPaid ? '#f0fdf4' : '#fefce8',
              borderRadius: 10, border: `1px solid ${detailAppt.isPaid ? '#bbf7d0' : '#fde68a'}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: detailAppt.isPaid ? '#15803d' : '#b45309' }}>
                {detailAppt.isPaid ? '✓ Payment received' : 'Payment pending'}
              </div>
              <button onClick={(e) => togglePaid(detailAppt, e)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none',
                  background: detailAppt.isPaid ? '#fef2f2' : '#dcfce7',
                  color: detailAppt.isPaid ? '#dc2626' : '#16a34a' }}>
                {detailAppt.isPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
