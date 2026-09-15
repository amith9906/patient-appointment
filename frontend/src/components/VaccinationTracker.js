import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useDialog } from '../context/DialogContext';
import api from '../services/api';
import Badge from './Badge';

export default function VaccinationTracker({ patientId, patientDob, patientName, uhid, doctors = [] }) {
  const { confirm: confirmDialog } = useDialog();
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State for Marking Given / Editing
  const [selectedVac, setSelectedVac] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [givenDate, setGivenDate] = useState(new Date().toISOString().split('T')[0]);
  const [doctor, setDoctor] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [vacNotes, setVacNotes] = useState('');
  const [statusVal, setStatusVal] = useState('given');
  const [saving, setSaving] = useState(false);

  // Custom Vaccine Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVacName, setNewVacName] = useState('');
  const [newAgeDesc, setNewAgeDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchVaccinations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/vaccinations/patient/${patientId}`);
      setVaccinations(res.data.vaccinations || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch vaccination schedule');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) {
      fetchVaccinations();
    }
  }, [patientId, fetchVaccinations]);

  const handleAutoGenerate = async () => {
    if (!patientDob) {
      toast.warning('Patient Date of Birth (DOB) is required to auto-generate the vaccination schedule.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Auto-Generate Schedule',
      message: 'This will re-calculate due dates for un-administered vaccines based on DOB. Continue?',
      confirmText: 'Generate Schedule',
      type: 'primary',
    });
    if (!ok) return;
    try {
      setLoading(true);
      const res = await api.post(`/vaccinations/patient/${patientId}/auto-generate`);
      setVaccinations(res.data.vaccinations || []);
      setSuccessMsg('Vaccination schedule auto-generated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (vac) => {
    setSelectedVac(vac);
    setStatusVal(vac.status === 'due' ? 'given' : vac.status);
    setGivenDate(vac.givenDate || new Date().toISOString().split('T')[0]);
    setDoctor(vac.administeredByDoctorId || (doctors[0]?.id || ''));
    setBatchNo(vac.batchNumber || '');
    setVacNotes(vac.notes || '');
    setShowModal(true);
  };

  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    if (!selectedVac) return;
    try {
      setSaving(true);
      const payload = {
        status: statusVal,
        givenDate: statusVal === 'given' ? givenDate : null,
        administeredByDoctorId: doctor || null,
        batchNumber: batchNo,
        notes: vacNotes,
      };
      await api.put(`/vaccinations/${selectedVac.id}`, payload);
      setShowModal(false);
      fetchVaccinations();
      setSuccessMsg('Vaccination record updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update record');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!newVacName.trim()) {
      toast.warning('Please enter vaccine name');
      return;
    }
    try {
      setSaving(true);
      await api.post(`/vaccinations/patient/${patientId}`, {
        vaccineName: newVacName,
        targetAgeDescription: newAgeDesc || 'Custom Milestone',
        dueDate: newDueDate,
        status: 'due',
      });
      setShowAddModal(false);
      setNewVacName('');
      setNewAgeDesc('');
      fetchVaccinations();
      setSuccessMsg('Vaccine added to schedule!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add vaccine');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Loading vaccination schedule...</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4 print:border-none print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>💉</span> Child Immunization & Vaccination Schedule
          </h3>
          <p className="text-xs text-slate-500">
            Standard IAP Immunization Chart tracking for pediatric care & vaccine batch logging
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-md transition"
            title="Auto-calculate standard IAP schedule based on DOB"
          >
            ⚡ Auto-Generate IAP Chart
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-md transition"
          >
            + Add Vaccine
          </button>
          <button
            type="button"
            onClick={handlePrintCertificate}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-md transition"
          >
            🖨️ Print Certificate
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>}
      {successMsg && <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md">{successMsg}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <th className="p-2.5">Milestone Age</th>
              <th className="p-2.5">Vaccine Name</th>
              <th className="p-2.5">Due Date</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Given Date</th>
              <th className="p-2.5">Batch No</th>
              <th className="p-2.5">Doctor</th>
              <th className="p-2.5 text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vaccinations.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-4 text-center text-slate-400">
                  No vaccination schedule found for this patient. Click "Auto-Generate IAP Chart" to create one.
                </td>
              </tr>
            ) : (
              vaccinations.map((vac) => {
                const isGiven = vac.status === 'given';
                const isMissed = vac.status === 'missed' || (!isGiven && new Date(vac.dueDate) < new Date());
                const badgeVariant = isGiven ? 'success' : isMissed ? 'danger' : 'warning';

                return (
                  <tr key={vac.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-medium text-slate-700">{vac.targetAgeDescription}</td>
                    <td className="p-2.5 font-semibold text-slate-900">{vac.vaccineName}</td>
                    <td className="p-2.5 text-slate-600">{vac.dueDate}</td>
                    <td className="p-2.5">
                      <Badge variant={badgeVariant}>
                        {isGiven ? 'Given' : isMissed ? 'Overdue' : 'Due'}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-slate-700">{vac.givenDate || '—'}</td>
                    <td className="p-2.5 text-slate-600 font-mono">{vac.batchNumber || '—'}</td>
                    <td className="p-2.5 text-slate-700">{vac.administeredByDoctor?.name ? `Dr. ${vac.administeredByDoctor.name}` : '—'}</td>
                    <td className="p-2.5 text-right print:hidden">
                      <button
                        type="button"
                        onClick={() => openUpdateModal(vac)}
                        className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-xs font-semibold transition"
                      >
                        {isGiven ? 'Edit Log' : 'Record Admin'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Update / Record Modal */}
      {showModal && selectedVac && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-slate-800 text-sm">
                Record Vaccine: {selectedVac.vaccineName}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="given">Given / Administered</option>
                  <option value="due">Due / Pending</option>
                  <option value="missed">Missed / Skipped</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>

              {statusVal === 'given' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Given Date</label>
                  <input
                    type="date"
                    value={givenDate}
                    onChange={(e) => setGivenDate(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administered By Doctor</label>
                <select
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.name} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vaccine Batch / Lot No</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-9982X"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Reactions</label>
                <textarea
                  rows="2"
                  placeholder="Any reaction, site of injection, or doctor note..."
                  value={vacNotes}
                  onChange={(e) => setVacNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition"
                >
                  {saving ? 'Saving...' : 'Save Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Vaccine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-slate-800 text-sm">Add Vaccine to Schedule</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCustom} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vaccine Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Influenza annual booster"
                  value={newVacName}
                  onChange={(e) => setNewVacName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Age / Milestone</label>
                <input
                  type="text"
                  placeholder="e.g. 6 Months, Annual, 12 Years"
                  value={newAgeDesc}
                  onChange={(e) => setNewAgeDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition"
                >
                  {saving ? 'Adding...' : 'Add Vaccine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
