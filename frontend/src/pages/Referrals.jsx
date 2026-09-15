import React, { useEffect, useState } from 'react';
import { referralAPI, patientAPI, doctorAPI } from '../services/api';

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    patientId: '',
    receivingDoctorId: '',
    isExternalReferring: false,
    referringDoctorId: '',
    referringDoctorName: '',
    referringDoctorClinic: '',
    referringDoctorPhone: '',
    referralDate: new Date().toISOString().slice(0, 10),
    reason: '',
    notes: '',
  });

  const loadData = () => {
    setLoading(true);
    const params = filterStatus ? { status: filterStatus } : {};
    Promise.all([
      referralAPI.getAll(params),
      patientAPI.getAll({ limit: 100 }),
      doctorAPI.getAll({ limit: 100 }),
    ])
      .then(([refRes, patRes, docRes]) => {
        setReferrals(refRes.data.data || refRes.data || []);
        setPatients(patRes.data.data || patRes.data || []);
        setDoctors(docRes.data.data || docRes.data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      patientId: form.patientId,
      receivingDoctorId: form.receivingDoctorId,
      referralDate: form.referralDate,
      reason: form.reason,
      notes: form.notes,
    };

    if (form.isExternalReferring) {
      payload.referringDoctorName = form.referringDoctorName;
      payload.referringDoctorClinic = form.referringDoctorClinic;
      payload.referringDoctorPhone = form.referringDoctorPhone;
    } else {
      payload.referringDoctorId = form.referringDoctorId || null;
    }

    referralAPI.create(payload)
      .then(() => {
        setShowModal(false);
        setForm({
          patientId: '',
          receivingDoctorId: '',
          isExternalReferring: false,
          referringDoctorId: '',
          referringDoctorName: '',
          referringDoctorClinic: '',
          referringDoctorPhone: '',
          referralDate: new Date().toISOString().slice(0, 10),
          reason: '',
          notes: '',
        });
        loadData();
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to create referral'))
      .finally(() => setSubmitting(false));
  };

  const handleUpdateStatus = (id, newStatus) => {
    referralAPI.update(id, { status: newStatus })
      .then(() => loadData())
      .catch((err) => alert(err.response?.data?.message || 'Update failed'));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'declined': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const pendingCount = referrals.filter(r => r.status === 'pending').length;
  const scheduledCount = referrals.filter(r => r.status === 'scheduled').length;
  const completedCount = referrals.filter(r => r.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Referral Management</h1>
          <p className="text-sm text-slate-500">Track and manage internal &amp; external patient referrals</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm"
        >
          <span>➕</span> Create New Referral
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total Referrals</div>
          <div className="text-2xl font-extrabold text-slate-800 mt-1">{referrals.length}</div>
        </div>
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 shadow-sm">
          <div className="text-xs text-amber-700 uppercase font-semibold">Pending</div>
          <div className="text-2xl font-extrabold text-amber-800 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
          <div className="text-xs text-blue-700 uppercase font-semibold">Scheduled</div>
          <div className="text-2xl font-extrabold text-blue-800 mt-1">{scheduledCount}</div>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm">
          <div className="text-xs text-emerald-700 uppercase font-semibold">Completed</div>
          <div className="text-2xl font-extrabold text-emerald-800 mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Table Filter Controls */}
      <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-500 uppercase">Filter Status:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Referrals List Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading referrals list...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Referring Doctor</th>
                  <th className="py-3 px-4">Receiving Doctor</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No referral records found.</td>
                  </tr>
                ) : (
                  referrals.map((r) => {
                    const referringStr = r.referringDoctor
                      ? `Dr. ${r.referringDoctor.name} (Internal)`
                      : (r.referringDoctorName ? `${r.referringDoctorName} (${r.referringDoctorClinic || 'External'})` : 'Self-Referred / Walk-in');

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-xs">{r.referralDate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {r.patient?.name || 'Unknown Patient'}
                          {r.patient?.phone && <div className="text-xs text-slate-400 font-normal">{r.patient.phone}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{referringStr}</td>
                        <td className="py-3 px-4 text-blue-700 font-medium">
                          Dr. {r.receivingDoctor?.name || 'Unassigned'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.reason || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'scheduled')}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg"
                            >
                              Mark Scheduled
                            </button>
                          )}
                          {['pending', 'scheduled'].includes(r.status) && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'completed')}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg"
                            >
                              Mark Completed
                            </button>
                          )}
                          {r.status !== 'declined' && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'declined')}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-rose-600"
                            >
                              Decline
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Create Patient Referral</h2>
            {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{error}</div>}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Patient *</label>
                <select
                  required
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Receiving Doctor (Internal Specialist) *</label>
                <select
                  required
                  value={form.receivingDoctorId}
                  onChange={(e) => setForm({ ...form, receivingDoctorId: e.target.value })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">-- Choose Receiving Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              {/* Toggle Internal vs External referring doctor */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Referring Doctor Source</span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isExternalReferring}
                      onChange={(e) => setForm({ ...form, isExternalReferring: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    External Doctor / Clinic
                  </label>
                </div>

                {form.isExternalReferring ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="External Doctor Name *"
                      value={form.referringDoctorName}
                      onChange={(e) => setForm({ ...form, referringDoctorName: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Clinic / Hospital Name"
                        value={form.referringDoctorClinic}
                        onChange={(e) => setForm({ ...form, referringDoctorClinic: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300"
                      />
                      <input
                        type="tel"
                        placeholder="Contact Phone"
                        value={form.referringDoctorPhone}
                        onChange={(e) => setForm({ ...form, referringDoctorPhone: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                ) : (
                  <select
                    value={form.referringDoctorId}
                    onChange={(e) => setForm({ ...form, referringDoctorId: e.target.value })}
                    className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300"
                  >
                    <option value="">-- Choose Internal Doctor (Optional) --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization})</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Referral</label>
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Clinical reasons, diagnosis, or specialization needed..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 h-10 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
                >
                  {submitting ? 'Creating...' : 'Save Referral'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
