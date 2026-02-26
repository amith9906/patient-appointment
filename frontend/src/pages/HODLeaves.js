import React, { useEffect, useMemo, useState } from 'react';
import { departmentAPI, doctorAPI, nurseAPI, doctorLeaveAPI, nurseLeaveAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const startOfMonth = (value) => {
  const d = new Date(value);
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  return s.toISOString().slice(0, 10);
};
const endOfMonth = (value) => {
  const d = new Date(value);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return e.toISOString().slice(0, 10);
};

export default function HODLeaves() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [monthDate, setMonthDate] = useState(new Date().toISOString().slice(0, 10));
  const [doctorIds, setDoctorIds] = useState(new Set());
  const [nurseIds, setNurseIds] = useState(new Set());
  const [doctorLeaves, setDoctorLeaves] = useState([]);
  const [nurseLeaves, setNurseLeaves] = useState([]);

  const isAdminLike = ['super_admin', 'admin'].includes(user?.role);

  const loadMeta = async () => {
    const dRes = await departmentAPI.getAll();
    const allDepts = dRes.data || [];
    const myDepts = isAdminLike ? allDepts : allDepts.filter((d) => String(d.hod?.id || '') === String(user?.id || ''));
    setDepartments(myDepts);
    const defaultDept = myDepts[0]?.id || '';
    setSelectedDeptId((prev) => prev || defaultDept);
  };

  const loadLeaves = async (deptId = selectedDeptId) => {
    if (!deptId && !isAdminLike) return;
    const from = startOfMonth(monthDate);
    const to = endOfMonth(monthDate);

    const deptIds = deptId && deptId !== 'all' ? [deptId] : departments.map((d) => d.id);
    const doctorRows = [];
    const nurseRows = [];
    for (const id of deptIds) {
      // Fetch department-bound staff lists.
      // eslint-disable-next-line no-await-in-loop
      const [dr, nr] = await Promise.all([
        doctorAPI.getAll({ departmentId: id }),
        nurseAPI.getAll({ departmentId: id }),
      ]);
      doctorRows.push(...(dr.data || []));
      nurseRows.push(...(nr.data || []));
    }
    const dIds = new Set(doctorRows.map((x) => x.id));
    const nIds = new Set(nurseRows.map((x) => x.id));
    setDoctorIds(dIds);
    setNurseIds(nIds);

    const [docLeavesRes, nurLeavesRes] = await Promise.all([
      doctorLeaveAPI.getAll({ from, to }),
      nurseLeaveAPI.getAll({ from, to }),
    ]);
    const allDocLeaves = docLeavesRes.data || [];
    const allNurLeaves = nurLeavesRes.data || [];
    setDoctorLeaves(allDocLeaves.filter((l) => dIds.has(l.doctorId)));
    setNurseLeaves(allNurLeaves.filter((l) => nIds.has(l.nurseId)));
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await loadMeta();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load HOD departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!departments.length && !isAdminLike) return;
    loadLeaves(selectedDeptId || departments[0]?.id || '');
  }, [selectedDeptId, monthDate, departments.length]);

  const pendingDoctor = doctorLeaves.filter((l) => l.status === 'pending');
  const pendingNurse = nurseLeaves.filter((l) => l.status === 'pending');
  const approvedLeaves = [
    ...doctorLeaves.filter((l) => l.status === 'approved').map((l) => ({ ...l, kind: 'doctor', label: l.doctor?.name || 'Doctor' })),
    ...nurseLeaves.filter((l) => l.status === 'approved').map((l) => ({ ...l, kind: 'nurse', label: l.nurse?.name || 'Nurse' })),
  ];

  const leaveCountByStaff = useMemo(() => {
    const map = new Map();
    approvedLeaves.forEach((l) => {
      const key = `${l.kind}:${l.kind === 'doctor' ? l.doctorId : l.nurseId}`;
      const label = l.label;
      if (!map.has(key)) map.set(key, { key, label, kind: l.kind, approved: 0 });
      map.get(key).approved += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.approved - a.approved);
  }, [doctorLeaves, nurseLeaves]);

  const calendar = useMemo(() => {
    const base = new Date(monthDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(year, month, d).toISOString().slice(0, 10);
      const leaves = approvedLeaves.filter((l) => String(l.leaveDate).slice(0, 10) === date);
      cells.push({ d, date, leaves });
    }
    return cells;
  }, [monthDate, approvedLeaves]);

  const decideLeave = async (kind, id, action) => {
    try {
      if (kind === 'doctor') {
        if (action === 'approve') await doctorLeaveAPI.approve(id);
        else await doctorLeaveAPI.reject(id);
      } else {
        if (action === 'approve') await nurseLeaveAPI.approve(id);
        else await nurseLeaveAPI.reject(id);
      }
      toast.success(`Leave ${action}d`);
      await loadLeaves(selectedDeptId);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} leave`);
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading leave workflow...</div>;
  if (!isAdminLike && departments.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No HOD departments assigned to your login.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>HOD Leave Management</h2>
          <p className={styles.pageSubtitle}>Approve/reject doctor and nurse leaves, track usage, and monitor approved leave calendar.</p>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 12 }}>
        <div className={styles.filterBar}>
          <select className={styles.filterSelect} value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}>
            {isAdminLike && <option value="all">All Departments</option>}
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className={styles.filterSelect} type="date" value={monthDate} onChange={(e) => setMonthDate(e.target.value)} />
          <button className={styles.btnSecondary} onClick={() => loadLeaves(selectedDeptId)}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {[
          { label: 'Pending Doctor Leaves', value: pendingDoctor.length, color: '#dc2626' },
          { label: 'Pending Nurse Leaves', value: pendingNurse.length, color: '#ea580c' },
          { label: 'Approved Leaves (Month)', value: approvedLeaves.length, color: '#15803d' },
          { label: 'Staff on Leave (Unique)', value: leaveCountByStaff.length, color: '#2563eb' },
        ].map((c) => (
          <div key={c.label} className={styles.card} style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.card} style={{ padding: 12 }}>
        <h3 style={{ margin: 0, marginBottom: 8, color: '#334155' }}>Pending Approvals</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Type', 'Name', 'Date', 'Reason', 'Session', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pendingDoctor.map((l) => ({ ...l, kind: 'doctor', name: l.doctor?.name || 'Doctor' })), ...pendingNurse.map((l) => ({ ...l, kind: 'nurse', name: l.nurse?.name || 'Nurse' }))]
                .sort((a, b) => String(a.leaveDate).localeCompare(String(b.leaveDate)))
                .map((l) => (
                  <tr key={`${l.kind}-${l.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>{l.kind}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{l.name}</td>
                    <td style={{ padding: '8px 10px' }}>{l.leaveDate}</td>
                    <td style={{ padding: '8px 10px' }}>{l.reason || '-'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {l.isFullDay ? 'Full Day' : `${String(l.startTime || '').slice(0, 5)} - ${String(l.endTime || '').slice(0, 5)}`}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div className={styles.actions}>
                        <button className={styles.btnSuccess} onClick={() => decideLeave(l.kind, l.id, 'approve')}>Approve</button>
                        <button className={styles.btnDelete} onClick={() => decideLeave(l.kind, l.id, 'reject')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              {(pendingDoctor.length + pendingNurse.length === 0) && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 14, color: '#94a3b8' }}>No pending leave requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className={styles.card} style={{ padding: 12 }}>
          <h3 style={{ margin: 0, marginBottom: 8, color: '#334155' }}>Leave Count by Staff (Approved, Month)</h3>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {leaveCountByStaff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No approved leaves this month.</div>
            ) : leaveCountByStaff.map((row) => (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{row.kind}</div>
                </div>
                <div style={{ fontWeight: 700, color: '#334155' }}>{row.approved}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card} style={{ padding: 12 }}>
          <h3 style={{ margin: 0, marginBottom: 8, color: '#334155' }}>Approved Leave Calendar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>{d}</div>
            ))}
            {calendar.map((cell, idx) => (
              <div key={idx} style={{ minHeight: 70, border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, background: cell ? '#fff' : 'transparent' }}>
                {cell && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{cell.d}</div>
                    {cell.leaves.length > 0 && (
                      <div style={{ fontSize: 11, color: '#b91c1c' }}>
                        {cell.leaves.length} leave{cell.leaves.length > 1 ? 's' : ''}
                      </div>
                    )}
                    {cell.leaves.slice(0, 2).map((l) => (
                      <div key={`${l.kind}-${l.id}`} style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.label}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

