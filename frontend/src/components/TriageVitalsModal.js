import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function TriageVitalsModal({ appointment, onClose, onSuccess }) {
  const [temp, setTemp] = useState('');
  const [pulse, setPulse] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [spO2, setSpO2] = useState('');
  const [respRate, setRespRate] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        appointmentId: appointment.id,
        temp: temp ? parseFloat(temp) : null,
        pulse: pulse ? parseInt(pulse, 10) : null,
        bp_systolic: bpSys ? parseInt(bpSys, 10) : null,
        bp_diastolic: bpDia ? parseInt(bpDia, 10) : null,
        spO2: spO2 ? parseInt(spO2, 10) : null,
        respRate: respRate ? parseInt(respRate, 10) : null,
        weight: weight ? parseFloat(weight) : null,
        notes: notes || null,
      };
      await api.post('/vitals', payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record vitals');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="bg-slate-800 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span>🩺</span> OPD Triage Vitals Capture
            </h3>
            <p className="text-xs text-slate-300">
              {appointment.patient?.name} (Token #{appointment.queueToken})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-base">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                placeholder="37.0"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pulse (BPM)</label>
              <input
                type="number"
                placeholder="72"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">BP Systolic (mmHg)</label>
              <input
                type="number"
                placeholder="120"
                value={bpSys}
                onChange={(e) => setBpSys(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">BP Diastolic (mmHg)</label>
              <input
                type="number"
                placeholder="80"
                value={bpDia}
                onChange={(e) => setBpDia(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                placeholder="98"
                value={spO2}
                onChange={(e) => setSpO2(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Resp Rate</label>
              <input
                type="number"
                placeholder="18"
                value={respRate}
                onChange={(e) => setRespRate(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.5"
                placeholder="65"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Triage / Clinical Observation Notes</label>
            <textarea
              rows="2"
              placeholder="e.g. Mild headache, patient fasting..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition"
            >
              {saving ? 'Saving...' : 'Save Triage Vitals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
