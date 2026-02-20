import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { pdfAPI, vitalsAPI } from '../../services/api';
import { toast } from 'react-toastify';

// ─── Prescription constants ───────────────────────────────────────────────────

const SLOT_KEYS = ['M', 'A', 'N'];
const SLOT_META = {
  M: { label: 'Morning',   meal: 'Breakfast', icon: '🌅' },
  A: { label: 'Afternoon', meal: 'Lunch',     icon: '☀️' },
  N: { label: 'Night',     meal: 'Dinner',    icon: '🌙' },
};
const DOSE_OPTS   = ['0', '½', '1', '1½', '2'];
const MEAL_TIMING = ['Before', 'After', 'With'];
const DURATION_CHIPS = ['1 Day', '3 Days', '5 Days', '7 Days', '10 Days', '2 Weeks', '1 Month', '3 Months'];

const INIT_SLOTS = {
  M: { dose: '1', timing: 'After' },
  A: { dose: '0', timing: 'After' },
  N: { dose: '1', timing: 'After' },
};
const INIT_RX = { medicationId: '', selectedMed: null, duration: '5 Days', customDuration: '', instructions: '', quantity: 10 };

// ─── Vitals constants ─────────────────────────────────────────────────────────

const VITAL_FIELDS = [
  { key: 'heartRate',       label: 'Heart Rate',   icon: '❤️',  unit: 'bpm',   normal: [60, 100],   placeholder: '72' },
  { key: 'systolic',        label: 'BP Systolic',  icon: '💉',  unit: 'mmHg',  normal: [90, 140],   placeholder: '120' },
  { key: 'diastolic',       label: 'BP Diastolic', icon: '💉',  unit: 'mmHg',  normal: [60, 90],    placeholder: '80' },
  { key: 'temperature',     label: 'Temperature',  icon: '🌡️', unit: '°C',    normal: [36.1, 37.2],placeholder: '36.6' },
  { key: 'spo2',            label: 'SpO2',         icon: '💧',  unit: '%',     normal: [95, 100],   placeholder: '98' },
  { key: 'weight',          label: 'Weight',       icon: '⚖️', unit: 'kg',    normal: null,        placeholder: '70' },
  { key: 'height',          label: 'Height',       icon: '📏',  unit: 'cm',    normal: null,        placeholder: '170' },
  { key: 'bloodSugar',      label: 'Blood Sugar',  icon: '🩸',  unit: 'mg/dL', normal: [70, 140],   placeholder: '95' },
  { key: 'respiratoryRate', label: 'Resp. Rate',   icon: '🫁',  unit: '/min',  normal: [12, 20],    placeholder: '16' },
];

const COMMON_SYMPTOMS = [
  'Fever', 'Cough', 'Cold', 'Headache', 'Body Pain', 'Fatigue',
  'Nausea', 'Vomiting', 'Diarrhea', 'Chest Pain', 'Shortness of Breath',
  'Dizziness', 'Loss of Appetite', 'Sore Throat', 'Back Pain',
  'Joint Pain', 'Skin Rash', 'Swelling', 'Weakness',
];

const INIT_VITALS_FORM = {
  heartRate: '', systolic: '', diastolic: '', temperature: '', spo2: '',
  weight: '', height: '', bloodSugar: '', bloodSugarType: 'random',
  respiratoryRate: '', symptoms: [], vitalNotes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function doseToNum(d) {
  if (d === '½') return 0.5; if (d === '1½') return 1.5;
  return parseFloat(d) || 0;
}
function buildFrequency(slots) { return SLOT_KEYS.map(k => slots[k].dose).join('-'); }
function buildTiming(slots) {
  return SLOT_KEYS.filter(k => slots[k].dose !== '0')
    .map(k => `${slots[k].timing} ${SLOT_META[k].meal}`).join(' · ') || 'As needed';
}
function freqLabel(slots) {
  const n = SLOT_KEYS.filter(k => slots[k].dose !== '0').length;
  return ['As needed', 'Once daily', 'Twice daily', 'Three times daily'][n] || 'As needed';
}
function parseDays(dur) {
  const d = (dur || '').toLowerCase(), n = parseInt(d) || 0;
  if (d.includes('month')) return n * 30; if (d.includes('week')) return n * 7; return n;
}
function calcQty(slots, duration) {
  const days = parseDays(duration); if (!days) return 0;
  return Math.ceil(SLOT_KEYS.reduce((s, k) => s + doseToNum(slots[k].dose), 0) * days);
}
function calcBMI(w, h) {
  const weight = parseFloat(w), height = parseFloat(h) / 100;
  if (!weight || !height) return null;
  return (weight / (height * height)).toFixed(1);
}
function bmiLabel(b) {
  const n = parseFloat(b);
  if (!n) return ''; if (n < 18.5) return 'Underweight'; if (n < 25) return 'Normal';
  if (n < 30) return 'Overweight'; return 'Obese';
}
function bmiColor(b) {
  const n = parseFloat(b);
  if (!n) return '#94a3b8';
  if (n < 18.5 || n >= 30) return '#ef4444';
  if (n < 25) return '#22c55e'; return '#f59e0b';
}
function vitalStatus(value, normal) {
  if (!value || !normal) return 'none';
  const v = parseFloat(value); if (isNaN(v)) return 'none';
  const [min, max] = normal;
  if (v < min * 0.85 || v > max * 1.15) return 'danger';
  if (v < min || v > max) return 'warning';
  return 'normal';
}
const STATUS_COLORS = { normal: '#22c55e', warning: '#f59e0b', danger: '#ef4444', none: '#cbd5e1' };
const STATUS_LABELS = { normal: 'Normal', warning: 'Borderline', danger: 'Abnormal', none: '' };

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function parseSymptoms(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return raw.split(',').map(s => s.trim()).filter(Boolean); }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appt, setAppt]                   = useState(null);
  const [medications, setMedications]     = useState([]);
  const [notes, setNotes]                 = useState({ diagnosis: '', notes: '', treatmentDone: '', treatmentBill: '' });
  const [prescriptions, setPrescriptions] = useState([]);
  const [history, setHistory]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [downloading, setDownloading]     = useState('');

  // Prescription form
  const [rxForm, setRxForm]   = useState(INIT_RX);
  const [slots, setSlots]     = useState(INIT_SLOTS);
  const [autoQty, setAutoQty] = useState(true);
  const [medSearch, setMedSearch] = useState('');
  const [medOpen, setMedOpen]     = useState(false);
  const medRef = useRef(null);

  // Vitals form
  const [vitalsForm, setVitalsForm]   = useState(INIT_VITALS_FORM);
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [vitalsRecorded, setVitalsRecorded] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get(`/appointments/${id}`),
      api.get('/medications'),
      api.get(`/prescriptions/appointment/${id}`),
      vitalsAPI.get(id),
    ]).then(([a, m, p, v]) => {
      const apptData = a.data;
      setAppt(apptData);
      setMedications(m.data);
      setPrescriptions(p.data);
      setNotes({
        diagnosis: apptData.diagnosis || '',
        notes: apptData.notes || '',
        treatmentDone: apptData.treatmentDone || '',
        treatmentBill: apptData.treatmentBill || '',
      });

      // Load vitals if recorded
      if (v.data && v.data.id) {
        setVitalsRecorded(true);
        const vd = v.data;
        setVitalsForm({
          heartRate: vd.heartRate ?? '',
          systolic: vd.systolic ?? '',
          diastolic: vd.diastolic ?? '',
          temperature: vd.temperature ?? '',
          spo2: vd.spo2 ?? '',
          weight: vd.weight ?? '',
          height: vd.height ?? '',
          bloodSugar: vd.bloodSugar ?? '',
          bloodSugarType: vd.bloodSugarType || 'random',
          respiratoryRate: vd.respiratoryRate ?? '',
          symptoms: parseSymptoms(vd.symptoms),
          vitalNotes: vd.vitalNotes || '',
        });
      }

      // Load patient history
      if (apptData?.patient?.id) {
        setHistoryLoading(true);
        api.get(`/patients/${apptData.patient.id}/history`)
          .then(h => {
            const prev = (h.data?.appointments || [])
              .filter(v => v.id !== apptData.id)
              .sort((x, y) => new Date(`${y.appointmentDate}T${y.appointmentTime||'00:00'}`) - new Date(`${x.appointmentDate}T${x.appointmentTime||'00:00'}`));
            setHistory(prev);
          })
          .catch(() => setHistory([]))
          .finally(() => setHistoryLoading(false));
      }
    });
  }, [id]);

  // Auto-calculate quantity
  useEffect(() => {
    if (!autoQty) return;
    const dur = rxForm.customDuration || rxForm.duration;
    const q = calcQty(slots, dur);
    if (q > 0) setRxForm(f => ({ ...f, quantity: q }));
  }, [slots, rxForm.duration, rxForm.customDuration, autoQty]);

  // Close medication dropdown on outside click
  useEffect(() => {
    const h = e => { if (medRef.current && !medRef.current.contains(e.target)) setMedOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredMeds = medications.filter(m => {
    const q = medSearch.toLowerCase();
    return !q || m.name?.toLowerCase().includes(q) || m.genericName?.toLowerCase().includes(q) || m.composition?.toLowerCase().includes(q);
  });

  const allergyWarning = rxForm.selectedMed && appt?.patient?.allergies &&
    appt.patient.allergies.toLowerCase().split(/[,;\s]+/)
      .some(a => a.length > 2 && rxForm.selectedMed.name.toLowerCase().includes(a));

  const bmi = calcBMI(vitalsForm.weight, vitalsForm.height);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const saveNotes = async () => {
    setSaving(true);
    try { await api.put(`/appointments/${id}`, notes); setAppt(a => ({ ...a, ...notes })); toast.success('Notes saved'); }
    catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const completeConsultation = async () => {
    setSaving(true);
    try {
      await api.put(`/appointments/${id}`, { ...notes, status: 'completed' });
      setAppt(a => ({ ...a, ...notes, status: 'completed' }));
      toast.success('Consultation marked as completed');
    } catch { toast.error('Failed to complete'); } finally { setSaving(false); }
  };

  const saveVitals = async (e) => {
    e.preventDefault();
    setVitalsSaving(true);
    try {
      const payload = { ...vitalsForm, symptoms: JSON.stringify(vitalsForm.symptoms) };
      await vitalsAPI.save(id, payload);
      setVitalsRecorded(true);
      toast.success('Vitals saved');
    } catch { toast.error('Failed to save vitals'); } finally { setVitalsSaving(false); }
  };

  const toggleSymptom = (s) =>
    setVitalsForm(f => ({
      ...f,
      symptoms: f.symptoms.includes(s) ? f.symptoms.filter(x => x !== s) : [...f.symptoms, s],
    }));

  const setV = (k, v) => setVitalsForm(f => ({ ...f, [k]: v }));

  const selectMed = useCallback((m) => {
    setRxForm(f => ({ ...f, medicationId: m.id, selectedMed: m }));
    setMedSearch(m.name); setMedOpen(false);
  }, []);

  const clearMed = () => { setRxForm(f => ({ ...f, medicationId: '', selectedMed: null })); setMedSearch(''); };
  const setSlot = (key, field, value) => setSlots(s => ({ ...s, [key]: { ...s[key], [field]: value } }));

  const addPrescription = async (e) => {
    e.preventDefault();
    if (!rxForm.medicationId) return toast.error('Please select a medication');
    const dur = rxForm.customDuration || rxForm.duration;
    try {
      const res = await api.post('/prescriptions', {
        appointmentId: id, medicationId: rxForm.medicationId,
        dosage: rxForm.selectedMed?.dosage || '—',
        frequency: buildFrequency(slots), timing: buildTiming(slots),
        duration: dur, instructions: rxForm.instructions, quantity: rxForm.quantity,
      });
      setPrescriptions(p => [...p, res.data]);
      setRxForm(INIT_RX); setSlots(INIT_SLOTS); setMedSearch(''); setAutoQty(true);
      toast.success('Prescription added');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const deletePrescription = async (pid) => {
    try { await api.delete(`/prescriptions/${pid}`); setPrescriptions(p => p.filter(x => x.id !== pid)); toast.success('Removed'); }
    catch { toast.error('Failed'); }
  };

  const downloadPDF = async (type) => {
    setDownloading(type);
    try {
      const res = type === 'prescription' ? await pdfAPI.prescription(id) : await pdfAPI.bill(id);
      downloadBlob(res.data, `${type}-${appt?.appointmentNumber || id}.pdf`);
    } catch { toast.error(`Failed to download ${type} PDF`); } finally { setDownloading(''); }
  };

  if (!appt) return (
    <div className="flex justify-center p-16">
      <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
    </div>
  );

  const patient = appt.patient;
  const isCompleted = appt.status === 'completed';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-teal-600 font-medium">← Back</button>
          <h2 className="text-xl font-bold text-gray-800">Appointment #{appt.appointmentNumber}</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {appt.status}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadPDF('prescription')} disabled={!!downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
            {downloading === 'prescription' ? '⏳' : '📄'} Prescription PDF
          </button>
          <button onClick={() => downloadPDF('bill')} disabled={!!downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {downloading === 'bill' ? '⏳' : '🧾'} Bill PDF
          </button>
        </div>
      </div>

      {/* Patient Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Patient</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ['Name', patient?.name], ['Patient ID', patient?.patientId], ['Phone', patient?.phone],
            ['Blood Group', patient?.bloodGroup], ['Date of Birth', patient?.dateOfBirth],
            ['Appointment', `${appt.appointmentDate} ${appt.appointmentTime?.slice(0,5) || ''}`],
          ].map(([label, val]) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
              <div className="text-sm font-semibold text-gray-700 mt-0.5">{val || '—'}</div>
            </div>
          ))}
        </div>
        {patient?.allergies && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            ⚠️ <strong>Allergies:</strong> {patient.allergies}
          </div>
        )}
        {patient?.medicalHistory && (
          <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm">
            <span className="font-medium text-gray-600">Medical History:</span> {patient.medicalHistory}
          </div>
        )}
        {appt.reason && (
          <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            📝 <strong>Reason:</strong> {appt.reason}
          </div>
        )}
      </div>

      {/* ── VITALS ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🩺 Patient Vitals</h3>
          {vitalsRecorded && (
            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">✓ Recorded</span>
          )}
        </div>

        <form onSubmit={saveVitals} className="space-y-5">

          {/* Row 1: Cardiovascular + Temperature + SpO2 */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Vital Signs</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Heart Rate */}
              {['heartRate', 'systolic', 'diastolic'].slice(0,1).map(key => {
                const vf = VITAL_FIELDS.find(v => v.key === key);
                const status = vitalStatus(vitalsForm[key], vf.normal);
                return (
                  <div key={key} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">{vf.icon} {vf.label}</div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={vitalsForm[key]} placeholder={vf.placeholder}
                        onChange={e => setV(key, e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                      <span className="text-xs text-gray-400 whitespace-nowrap">{vf.unit}</span>
                    </div>
                    {vitalsForm[key] && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                        <span className="text-xs" style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Blood Pressure — combined systolic/diastolic */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">💉 Blood Pressure</div>
                <div className="flex items-center gap-1">
                  <input type="number" value={vitalsForm.systolic} placeholder="120"
                    onChange={e => setV('systolic', e.target.value)}
                    className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-center focus:outline-none focus:border-teal-400" />
                  <span className="text-gray-400 font-bold">/</span>
                  <input type="number" value={vitalsForm.diastolic} placeholder="80"
                    onChange={e => setV('diastolic', e.target.value)}
                    className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-center focus:outline-none focus:border-teal-400" />
                  <span className="text-xs text-gray-400">mmHg</span>
                </div>
                {(vitalsForm.systolic || vitalsForm.diastolic) && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[vitalStatus(vitalsForm.systolic, [90, 140])] }} />
                    <span className="text-xs text-gray-500">{vitalsForm.systolic || '—'}/{vitalsForm.diastolic || '—'}</span>
                  </div>
                )}
              </div>

              {/* Temperature */}
              {(() => {
                const vf = VITAL_FIELDS.find(v => v.key === 'temperature');
                const status = vitalStatus(vitalsForm.temperature, vf.normal);
                return (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">{vf.icon} {vf.label}</div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" step="0.1" value={vitalsForm.temperature} placeholder={vf.placeholder}
                        onChange={e => setV('temperature', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                      <span className="text-xs text-gray-400">{vf.unit}</span>
                    </div>
                    {vitalsForm.temperature && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                        <span className="text-xs" style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SpO2 */}
              {(() => {
                const vf = VITAL_FIELDS.find(v => v.key === 'spo2');
                const status = vitalStatus(vitalsForm.spo2, vf.normal);
                return (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">{vf.icon} {vf.label}</div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={vitalsForm.spo2} placeholder={vf.placeholder}
                        onChange={e => setV('spo2', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                      <span className="text-xs text-gray-400">{vf.unit}</span>
                    </div>
                    {vitalsForm.spo2 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                        <span className="text-xs" style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Row 2: Body Measurements + Blood Sugar + Resp Rate */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Measurements</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Weight */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">⚖️ Weight</div>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.1" value={vitalsForm.weight} placeholder="70"
                    onChange={e => setV('weight', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                  <span className="text-xs text-gray-400">kg</span>
                </div>
              </div>

              {/* Height */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">📏 Height</div>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.1" value={vitalsForm.height} placeholder="170"
                    onChange={e => setV('height', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                  <span className="text-xs text-gray-400">cm</span>
                </div>
              </div>

              {/* BMI — auto */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">📊 BMI</div>
                <div className="font-bold text-lg" style={{ color: bmiColor(bmi) }}>
                  {bmi || '—'}
                </div>
                {bmi && (
                  <div className="text-xs mt-0.5" style={{ color: bmiColor(bmi) }}>{bmiLabel(bmi)}</div>
                )}
              </div>

              {/* Blood Sugar */}
              <div className="bg-gray-50 rounded-xl p-3 col-span-1 md:col-span-1">
                <div className="text-xs text-gray-500 mb-1">🩸 Blood Sugar</div>
                <div className="flex items-center gap-1 mb-1.5">
                  <input type="number" step="0.1" value={vitalsForm.bloodSugar} placeholder="95"
                    onChange={e => setV('bloodSugar', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">mg/dL</span>
                </div>
                <div className="flex gap-1">
                  {[['fasting', 'F'], ['random', 'R'], ['post_prandial', 'PP']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setV('bloodSugarType', val)}
                      className={`flex-1 text-xs py-0.5 rounded font-medium transition-all ${vitalsForm.bloodSugarType === val ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {vitalsForm.bloodSugar && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[vitalStatus(vitalsForm.bloodSugar, [70, 140])] }} />
                    <span className="text-xs text-gray-400">{vitalsForm.bloodSugarType === 'fasting' ? 'Fasting' : vitalsForm.bloodSugarType === 'post_prandial' ? 'Post-meal' : 'Random'}</span>
                  </div>
                )}
              </div>

              {/* Respiratory Rate */}
              {(() => {
                const vf = VITAL_FIELDS.find(v => v.key === 'respiratoryRate');
                const status = vitalStatus(vitalsForm.respiratoryRate, vf.normal);
                return (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">{vf.icon} Resp. Rate</div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={vitalsForm.respiratoryRate} placeholder={vf.placeholder}
                        onChange={e => setV('respiratoryRate', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                      <span className="text-xs text-gray-400">/min</span>
                    </div>
                    {vitalsForm.respiratoryRate && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                        <span className="text-xs" style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Symptoms</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_SYMPTOMS.map(s => (
                <button key={s} type="button" onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    vitalsForm.symptoms.includes(s)
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            {vitalsForm.symptoms.length > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm text-orange-800 mb-2">
                <strong>Presenting symptoms:</strong> {vitalsForm.symptoms.join(', ')}
              </div>
            )}
            <textarea rows={2} value={vitalsForm.vitalNotes}
              onChange={e => setV('vitalNotes', e.target.value)}
              placeholder="Additional observations, nurse notes…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>

          <button type="submit" disabled={vitalsSaving}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {vitalsSaving ? 'Saving…' : vitalsRecorded ? '💾 Update Vitals' : '💾 Save Vitals'}
          </button>
        </form>
      </div>

      {/* ── CLINICAL NOTES ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Clinical Notes</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
            <textarea rows={2} value={notes.diagnosis} onChange={e => setNotes(n => ({ ...n, diagnosis: e.target.value }))}
              placeholder="Enter diagnosis…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor's Notes</label>
            <textarea rows={2} value={notes.notes} onChange={e => setNotes(n => ({ ...n, notes: e.target.value }))}
              placeholder="Observations, follow-up instructions…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Done</label>
            <textarea rows={2} value={notes.treatmentDone} onChange={e => setNotes(n => ({ ...n, treatmentDone: e.target.value }))}
              placeholder="Describe treatment/procedure done for this appointment…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Bill</label>
            <input type="number" step="0.01" min="0" value={notes.treatmentBill}
              onChange={e => setNotes(n => ({ ...n, treatmentBill: e.target.value }))}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveNotes} disabled={saving}
              className="bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
            {!isCompleted ? (
              <button onClick={completeConsultation} disabled={saving}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                ✓ Complete Consultation
              </button>
            ) : (
              <span className="text-sm text-green-600 font-medium">✓ Consultation completed</span>
            )}
          </div>
        </div>
      </div>

      {/* ── PRESCRIPTIONS ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Prescriptions</h3>

        {prescriptions.length > 0 && (
          <div className="space-y-3 mb-6">
            {prescriptions.map((p, idx) => (
              <div key={p.id} className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-800">{p.medication?.name}</span>
                      {p.medication?.dosage && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{p.medication.dosage}</span>}
                      {p.medication?.category && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded capitalize">{p.medication.category}</span>}
                    </div>
                    {p.medication?.composition && <div className="text-xs text-blue-500 mb-2">⚗ {p.medication.composition}</div>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.frequency && <span className="font-mono font-bold text-base text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-lg tracking-widest">{p.frequency}</span>}
                      {p.timing && <span className="text-xs text-gray-500">{p.timing}</span>}
                      {p.duration && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">📅 {p.duration}</span>}
                      {p.quantity && <span className="text-xs text-gray-500 ml-auto">Qty: <strong>{p.quantity}</strong></span>}
                    </div>
                    {p.instructions && <div className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">📝 {p.instructions}</div>}
                  </div>
                  <button onClick={() => deletePrescription(p.id)} className="text-red-300 hover:text-red-500 text-sm p-1 flex-shrink-0">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addPrescription} className="border-2 border-dashed border-gray-200 rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-gray-600">+ Add Medicine</div>

          {/* Medication Search */}
          <div className="relative" ref={medRef}>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Medicine *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
              <input value={medSearch} onFocus={() => setMedOpen(true)}
                onChange={e => { setMedSearch(e.target.value); setMedOpen(true); if (!e.target.value) clearMed(); }}
                placeholder="Type name, generic name or composition…"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            {rxForm.selectedMed && (
              <div className="mt-1.5 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-semibold text-teal-800">{rxForm.selectedMed.name}</span>
                {rxForm.selectedMed.dosage && <span className="text-teal-600 text-xs">{rxForm.selectedMed.dosage}</span>}
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded capitalize">{rxForm.selectedMed.category}</span>
                {rxForm.selectedMed.stockQuantity < 10 && <span className="text-xs text-red-500">Low stock</span>}
                <button type="button" onClick={clearMed} className="ml-auto text-gray-400 hover:text-red-500">✕</button>
              </div>
            )}
            {allergyWarning && (
              <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-medium">
                ⚠️ Patient has a recorded allergy that may relate to this medication
              </div>
            )}
            {medOpen && medSearch && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                {filteredMeds.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No medications found</div>
                ) : filteredMeds.slice(0, 12).map(m => (
                  <button key={m.id} type="button" onClick={() => selectMed(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">{m.name}</span>
                      {m.dosage && <span className="text-xs text-gray-400">{m.dosage}</span>}
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded capitalize ml-auto">{m.category}</span>
                    </div>
                    {m.composition && <div className="text-xs text-blue-500 mt-0.5">⚗ {m.composition}</div>}
                    {m.genericName && <div className="text-xs text-gray-400">{m.genericName}</div>}
                    <div className="text-xs mt-0.5">Stock: <span className={m.stockQuantity < 10 ? 'text-red-500 font-semibold' : 'text-gray-400'}>{m.stockQuantity}</span></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dose Slots */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dose Schedule</div>
            <div className="grid grid-cols-3 gap-3">
              {SLOT_KEYS.map(k => {
                const meta = SLOT_META[k]; const slot = slots[k]; const active = slot.dose !== '0';
                return (
                  <div key={k} className={`rounded-xl border-2 p-3 transition-all ${active ? 'border-teal-300 bg-white shadow-sm' : 'border-transparent bg-gray-100'}`}>
                    <div className="text-center text-xs font-semibold text-gray-600 mb-2.5">{meta.icon} {meta.label}</div>
                    <div className="flex flex-wrap gap-1 justify-center mb-2">
                      {DOSE_OPTS.map(d => (
                        <button key={d} type="button" onClick={() => setSlot(k, 'dose', d)}
                          className={`w-8 h-7 rounded-full text-xs font-bold transition-all ${slot.dose === d ? 'bg-teal-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                    {active && (
                      <>
                        <div className="flex gap-1 justify-center">
                          {MEAL_TIMING.map(t => (
                            <button key={t} type="button" onClick={() => setSlot(k, 'timing', t)}
                              className={`px-1.5 py-0.5 rounded text-xs font-medium transition-all ${slot.timing === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="text-center text-xs text-gray-400 mt-1">{slot.timing} {meta.meal}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-100">
              <span className="font-mono font-extrabold text-xl text-teal-700 tracking-widest">{buildFrequency(slots)}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500 font-medium">{freqLabel(slots)}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">{buildTiming(slots)}</span>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 block">Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_CHIPS.map(d => (
                <button key={d} type="button"
                  onClick={() => { setRxForm(f => ({ ...f, duration: d, customDuration: '' })); setAutoQty(true); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${rxForm.duration === d && !rxForm.customDuration ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                  {d}
                </button>
              ))}
              <input value={rxForm.customDuration}
                onChange={e => { setRxForm(f => ({ ...f, customDuration: e.target.value, duration: '' })); setAutoQty(true); }}
                placeholder="Custom…"
                className={`px-3 py-1 rounded-full text-xs border focus:outline-none w-24 ${rxForm.customDuration ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}`} />
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-end gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Total Quantity {autoQty && <span className="text-teal-600">(auto)</span>}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={rxForm.quantity}
                  onChange={e => { setRxForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 })); setAutoQty(false); }}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500" />
                {!autoQty && <button type="button" onClick={() => setAutoQty(true)} className="text-xs text-teal-600 hover:underline">Reset auto</button>}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Instructions <span className="text-gray-400">(any language — Kannada, Hindi, English…)</span>
            </label>
            <textarea rows={2} lang="mul" value={rxForm.instructions}
              onChange={e => setRxForm(f => ({ ...f, instructions: e.target.value }))}
              placeholder="ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ · After food · खाने के बाद लें"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>

          <button type="submit" className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
            + Add to Prescription
          </button>
        </form>
      </div>

      {/* ── PREVIOUS VISITS ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Previous Visits</h3>
        {historyLoading ? (
          <div className="text-sm text-gray-400">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">No previous visits found</div>
        ) : (
          <div className="space-y-4">
            {history.map(visit => {
              const vt = visit.vitals;
              const symptomList = vt?.symptoms ? parseSymptoms(vt.symptoms) : [];
              return (
                <div key={visit.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-white transition-colors">
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{visit.appointmentDate}</span>
                      {visit.appointmentTime && <span className="text-xs text-gray-500">at {visit.appointmentTime.slice(0,5)}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${visit.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{visit.status}</span>
                    </div>
                    <span className="text-xs text-gray-500">Dr. {visit.doctor?.name || '—'}{visit.doctor?.specialization ? ` · ${visit.doctor.specialization}` : ''}</span>
                  </div>

                  {/* Vitals snapshot */}
                  {vt && vt.id && (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 mb-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                      {vt.heartRate && <span>❤️ <strong>{vt.heartRate}</strong> bpm</span>}
                      {(vt.systolic || vt.diastolic) && <span>💉 <strong>{vt.systolic||'—'}/{vt.diastolic||'—'}</strong> mmHg</span>}
                      {vt.temperature && <span>🌡️ <strong>{vt.temperature}</strong>°C</span>}
                      {vt.spo2 && <span>💧 <strong>{vt.spo2}</strong>%</span>}
                      {vt.weight && <span>⚖️ <strong>{vt.weight}</strong> kg</span>}
                      {vt.bmi && <span>📊 BMI <strong>{vt.bmi}</strong> ({bmiLabel(vt.bmi)})</span>}
                      {vt.bloodSugar && <span>🩸 <strong>{vt.bloodSugar}</strong> mg/dL</span>}
                      {symptomList.length > 0 && (
                        <span className="text-orange-600">🤒 {symptomList.join(', ')}</span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                    <div><div className="text-xs text-gray-400 uppercase mb-0.5">Reason</div><div className="text-gray-700">{visit.reason || '—'}</div></div>
                    <div><div className="text-xs text-gray-400 uppercase mb-0.5">Diagnosis</div><div className="text-gray-700">{visit.diagnosis || '—'}</div></div>
                    {visit.notes && <div className="md:col-span-2"><div className="text-xs text-gray-400 uppercase mb-0.5">Notes</div><div className="text-gray-700">{visit.notes}</div></div>}
                  </div>

                  {visit.prescriptions?.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 uppercase mb-1.5">Medicines</div>
                      <div className="space-y-1">
                        {visit.prescriptions.map(rx => (
                          <div key={rx.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="font-medium">{rx.medication?.name}</span>
                            {rx.medication?.dosage && <span className="text-xs text-gray-400">{rx.medication.dosage}</span>}
                            {rx.frequency && <span className="font-mono text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{rx.frequency}</span>}
                            {rx.timing && <span className="text-xs text-gray-500">{rx.timing}</span>}
                            {rx.duration && <span className="text-xs text-gray-400">· {rx.duration}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
