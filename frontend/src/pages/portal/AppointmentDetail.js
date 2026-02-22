import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { pdfAPI, vitalsAPI, appointmentAPI, labAPI, reportAPI, packageAPI, labReportTemplateAPI } from '../../services/api';
import { toast } from 'react-toastify';
import SearchableSelect from '../../components/SearchableSelect';

// Prescription constants

const SLOT_KEYS = ['M', 'A', 'N'];
const SLOT_META = {
  M: { label: 'Morning',   meal: 'Breakfast', icon: 'M' },
  A: { label: 'Afternoon', meal: 'Lunch',     icon: 'A' },
  N: { label: 'Night',     meal: 'Dinner',    icon: 'N' },
};
const DOSE_OPTS   = ['0', '0.5', '1', '1.5', '2'];
const MEAL_TIMING = ['Before', 'After', 'With'];
const DURATION_CHIPS = ['1 Day', '3 Days', '5 Days', '7 Days', '10 Days', '2 Weeks', '1 Month', '3 Months'];
const RX_INSTRUCTION_CHIPS = [
  'After food',
  'Before food',
  'With food',
  'At bedtime',
  'Drink plenty of water',
  'Complete full course',
  'Do not skip dose',
];
const PRESCRIPTION_LANGS = [
  { code: 'kn', label: 'Kannada' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mwr', label: 'Marwadi' },
  { code: 'mr', label: 'Marathi' },
];
const LANG_LABEL_BY_CODE = PRESCRIPTION_LANGS.reduce((acc, item) => ({ ...acc, [item.code]: item.label }), {});

const INIT_SLOTS = {
  M: { dose: '1', timing: 'After' },
  A: { dose: '0', timing: 'After' },
  N: { dose: '1', timing: 'After' },
};
const INIT_RX = {
  medicationId: '',
  selectedMed: null,
  duration: '5 Days',
  customDuration: '',
  instructions: '',
  translatedInstructions: {},
  quantity: 10,
};

// Vitals constants

const VITAL_FIELDS = [
  { key: 'heartRate',       label: 'Heart Rate',   icon: 'HR', unit: 'bpm',   normal: [60, 100],   placeholder: '72' },
  { key: 'systolic',        label: 'BP Systolic',  icon: 'BP', unit: 'mmHg',  normal: [90, 140],   placeholder: '120' },
  { key: 'diastolic',       label: 'BP Diastolic', icon: 'BP', unit: 'mmHg',  normal: [60, 90],    placeholder: '80' },
  { key: 'temperature',     label: 'Temperature',  icon: 'T',  unit: 'C',     normal: [36.1, 37.2],placeholder: '36.6' },
  { key: 'spo2',            label: 'SpO2',         icon: 'O2', unit: '%',     normal: [95, 100],   placeholder: '98' },
  { key: 'weight',          label: 'Weight',       icon: 'W',  unit: 'kg',    normal: null,        placeholder: '70' },
  { key: 'height',          label: 'Height',       icon: 'H',  unit: 'cm',    normal: null,        placeholder: '170' },
  { key: 'bloodSugar',      label: 'Blood Sugar',  icon: 'BS', unit: 'mg/dL', normal: [70, 140],   placeholder: '95' },
  { key: 'respiratoryRate', label: 'Resp. Rate',   icon: 'RR', unit: '/min',  normal: [12, 20],    placeholder: '16' },
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

// Helpers

function doseToNum(d) {
  if (d === '0.5') return 0.5;
  if (d === '1.5') return 1.5;
  return parseFloat(d) || 0;
}
function buildFrequency(slots) { return SLOT_KEYS.map(k => slots[k].dose).join('-'); }
function buildTiming(slots) {
  return SLOT_KEYS.filter(k => slots[k].dose !== '0')
    .map(k => `${slots[k].timing} ${SLOT_META[k].meal}`).join(' - ') || 'As needed';
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
const NOTE_TEMPLATE_KEY = 'clinical_note_templates_v1';
const RX_MACRO_KEY = 'prescription_macros_v1';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function parseSymptoms(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return raw.split(',').map(s => s.trim()).filter(Boolean); }
}

function parseTranslatedInstructions(raw) {
  if (!raw) return {};
  const src = typeof raw === 'string' ? (() => {
    try { return JSON.parse(raw); } catch { return {}; }
  })() : raw;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const out = {};
  Object.keys(src).forEach((key) => {
    const code = String(key || '').toLowerCase();
    const text = String(src[key] || '').trim();
    if (text) out[code] = text;
  });
  return out;
}

//  Component 

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appt, setAppt]                   = useState(null);
  const [medications, setMedications]     = useState([]);
  const [notes, setNotes]                 = useState({ diagnosis: '', notes: '', treatmentDone: '', treatmentBill: '' });
  const [noteTemplates, setNoteTemplates] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTE_TEMPLATE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [history, setHistory]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [downloading, setDownloading]     = useState('');
  const [dischargeModal, setDischargeModal] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ conditionAtDischarge: 'Stable', dischargeDate: new Date().toISOString().split('T')[0], dischargeNotes: '' });

  // Prescription form
  const [rxForm, setRxForm]   = useState(INIT_RX);
  const [slots, setSlots]     = useState(INIT_SLOTS);
  const [autoQty, setAutoQty] = useState(true);
  const [medSearch, setMedSearch] = useState('');
  const [medOpen, setMedOpen]     = useState(false);
  const [rxTargetLangs, setRxTargetLangs] = useState(['kn', 'hi']);
  const [translatingRx, setTranslatingRx] = useState(false);
  const [rxMacros, setRxMacros] = useState(() => {
    try {
      const raw = localStorage.getItem(RX_MACRO_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [rxMacroName, setRxMacroName] = useState('');
  const [selectedRxMacroId, setSelectedRxMacroId] = useState('');
  const medRef = useRef(null);

  // Vitals form
  const [vitalsForm, setVitalsForm]   = useState(INIT_VITALS_FORM);
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [vitalsRecorded, setVitalsRecorded] = useState(false);

  // Bill items
  const [billItems, setBillItems] = useState([]);
  const [billSaving, setBillSaving] = useState(false);
  const [patientPackages, setPatientPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [consumingPackageId, setConsumingPackageId] = useState('');

  // Lab tests
  const [labTests, setLabTests] = useState([]);
  const [labs, setLabs] = useState([]);
  const [labOrderOpen, setLabOrderOpen] = useState(false);
  const [labOrderForm, setLabOrderForm] = useState({ testName: '', category: '', labId: '', price: '', normalRange: '', unit: '', templateId: '' });
  const [labTemplates, setLabTemplates] = useState([]);
  const [labOrdering, setLabOrdering] = useState(false);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', type: 'other', file: null });

  //  Load data 

  useEffect(() => {
    Promise.all([
      api.get(`/appointments/${id}`),
      api.get('/medications'),
      api.get(`/prescriptions/appointment/${id}`),
      vitalsAPI.get(id),
      appointmentAPI.getBillItems(id),
      labAPI.getAllTests({ appointmentId: id }),
      labAPI.getAll(),
    ]).then(([a, m, p, v, b, lt, lb]) => {
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
      setBillItems((b.data || []).map(i => ({ ...i, _key: i.id })));
      setLabTests(lt.data || []);
      setLabs(lb.data || []);
      labReportTemplateAPI.getAll().then(r => setLabTemplates(r.data || [])).catch(() => {});

      // Load vitals if recorded
      if (v.data && v.data.id) {
        setVitalsRecorded(true);
        const vd = v.data;
        setVitalsForm({
          heartRate: vd.heartRate || '',
          systolic: vd.systolic || '',
          diastolic: vd.diastolic || '',
          temperature: vd.temperature || '',
          spo2: vd.spo2 || '',
          weight: vd.weight || '',
          height: vd.height || '',
          bloodSugar: vd.bloodSugar || '',
          bloodSugarType: vd.bloodSugarType || 'random',
          respiratoryRate: vd.respiratoryRate || '',
          symptoms: parseSymptoms(vd.symptoms),
          vitalNotes: vd.vitalNotes || '',
        });
      }

      // Load patient documents (reports linked to this appointment)
      if (apptData.patient.id) {
        reportAPI.getByPatient(apptData.patient.id)
          .then(r => setDocuments((r.data || []).filter(d => d.appointmentId === id)))
          .catch(() => {});
      }

      // Load patient history
      if (apptData.patient.id) {
        setHistoryLoading(true);
        api.get(`/patients/${apptData.patient.id}/history`)
          .then(h => {
            const prev = (h.data.appointments || [])
              .filter(v => v.id !== apptData.id)
              .sort((x, y) => new Date(`${y.appointmentDate}T${y.appointmentTime||'00:00'}`) - new Date(`${x.appointmentDate}T${x.appointmentTime||'00:00'}`));
            setHistory(prev);
          })
          .catch(() => setHistory([]))
          .finally(() => setHistoryLoading(false));

        setPackagesLoading(true);
        packageAPI.getPatientAssignments(apptData.patient.id, { status: 'active' })
          .then((r) => setPatientPackages(r.data || []))
          .catch(() => setPatientPackages([]))
          .finally(() => setPackagesLoading(false));
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

  useEffect(() => {
    try {
      localStorage.setItem(NOTE_TEMPLATE_KEY, JSON.stringify(noteTemplates));
    } catch {}
  }, [noteTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem(RX_MACRO_KEY, JSON.stringify(rxMacros));
    } catch {}
  }, [rxMacros]);

  // Close medication dropdown on outside click
  useEffect(() => {
    const h = e => { if (medRef.current && !medRef.current.contains(e.target)) setMedOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  //  Derived 

  const filteredMeds = medications.filter(m => {
    const q = medSearch.toLowerCase();
    return !q
      || String(m.name || '').toLowerCase().includes(q)
      || String(m.genericName || '').toLowerCase().includes(q)
      || String(m.composition || '').toLowerCase().includes(q);
  });

  const allergyWarning = rxForm.selectedMed && appt.patient.allergies &&
    appt.patient.allergies.toLowerCase().split(/[,;\s]+/)
      .some(a => a.length > 2 && rxForm.selectedMed.name.toLowerCase().includes(a));

  const bmi = calcBMI(vitalsForm.weight, vitalsForm.height);

  //  Handlers 

  //  Bill items helpers 

  const addBillRow = () => setBillItems(prev => [...prev, { _key: Date.now(), description: '', category: 'other', quantity: 1, unitPrice: '', amount: 0 }]);

  const updateBillRow = (key, field, value) => {
    setBillItems(prev => prev.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item, [field]: value };
      const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
      const price = parseFloat(field === 'unitPrice' ? value : updated.unitPrice) || 0;
      updated.amount = parseFloat((qty * price).toFixed(2));
      return updated;
    }));
  };

  const removeBillRow = (key) => setBillItems(prev => prev.filter(i => i._key !== key));

  const saveBill = async () => {
    const validItems = billItems.filter(i => i.description.trim() && parseFloat(i.unitPrice) > 0);
    setBillSaving(true);
    try {
      const res = await appointmentAPI.saveBillItems(id, validItems);
      const total = validItems.reduce((s, i) => s + Number(i.amount || 0), 0);
      setAppt(a => ({ ...a, treatmentBill: total }));
      setBillItems((res.data || []).map(i => ({ ...i, _key: i.id })));
      toast.success('Bill saved');
    } catch { toast.error('Failed to save bill'); } finally { setBillSaving(false); }
  };

  const togglePaid = async () => {
    try {
      const res = await appointmentAPI.markPaid(id);
      setAppt(a => ({ ...a, isPaid: res.data.isPaid }));
      toast.success(res.data.isPaid ? 'Marked as Paid' : 'Marked as Unpaid');
    } catch { toast.error('Failed to update payment status'); }
  };

  const saveNotes = async () => {
    setSaving(true);
    try { await api.put(`/appointments/${id}`, notes); setAppt(a => ({ ...a, ...notes })); toast.success('Notes saved'); }
    catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const saveNoteTemplate = () => {
    const name = String(templateName || '').trim();
    if (!name) return toast.error('Template name is required');
    const payload = {
      id: `tpl-${Date.now()}`,
      name,
      diagnosis: notes.diagnosis || '',
      notes: notes.notes || '',
      treatmentDone: notes.treatmentDone || '',
    };

    setNoteTemplates((prev) => {
      const existing = prev.find((x) => String(x.name || '').toLowerCase() === name.toLowerCase());
      if (existing) {
        return prev.map((x) => (x.id === existing.id ? { ...x, ...payload, id: existing.id } : x));
      }
      return [payload, ...prev].slice(0, 30);
    });
    setTemplateName('');
    toast.success('Clinical template saved');
  };

  const applyNoteTemplate = () => {
    if (!selectedTemplateId) return toast.error('Select a template');
    const tpl = noteTemplates.find((x) => x.id === selectedTemplateId);
    if (!tpl) return toast.error('Template not found');
    setNotes((prev) => ({
      ...prev,
      diagnosis: tpl.diagnosis || '',
      notes: tpl.notes || '',
      treatmentDone: tpl.treatmentDone || '',
    }));
    toast.success(`Applied template: ${tpl.name}`);
  };

  const deleteNoteTemplate = () => {
    if (!selectedTemplateId) return toast.error('Select a template');
    const tpl = noteTemplates.find((x) => x.id === selectedTemplateId);
    if (!tpl) return;
    setNoteTemplates((prev) => prev.filter((x) => x.id !== selectedTemplateId));
    setSelectedTemplateId('');
    toast.success(`Deleted template: ${tpl.name}`);
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
  const toggleRxTargetLang = (code) => {
    setRxTargetLangs((prev) => (
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    ));
  };
  const addInstructionChip = (chip) => {
    const base = String(rxForm.instructions || '').trim();
    const next = base ? `${base}; ${chip}` : chip;
    setRxForm((f) => ({ ...f, instructions: next, translatedInstructions: {} }));
  };

  const saveRxMacro = () => {
    const name = String(rxMacroName || '').trim();
    if (!name) return toast.error('Macro name is required');
    if (!rxForm.medicationId || !rxForm.selectedMed) return toast.error('Select medicine before saving macro');
    const duration = rxForm.customDuration || rxForm.duration;
    const payload = {
      id: `rxm-${Date.now()}`,
      name,
      medicationId: rxForm.medicationId,
      medicationName: rxForm.selectedMed.name,
      slots,
      duration: duration || '',
      instructions: rxForm.instructions || '',
      quantity: Number(rxForm.quantity || 0) || 1,
    };
    setRxMacros((prev) => {
      const existing = prev.find((x) => String(x.name || '').toLowerCase() === name.toLowerCase());
      if (existing) {
        return prev.map((x) => (x.id === existing.id ? { ...payload, id: existing.id } : x));
      }
      return [payload, ...prev].slice(0, 50);
    });
    setRxMacroName('');
    toast.success('Prescription macro saved');
  };

  const applyRxMacro = () => {
    if (!selectedRxMacroId) return toast.error('Select a prescription macro');
    const macro = rxMacros.find((x) => x.id === selectedRxMacroId);
    if (!macro) return toast.error('Prescription macro not found');
    const med = medications.find((m) => m.id === macro.medicationId) || null;
    const nextSlots = macro.slots && typeof macro.slots === 'object' ? macro.slots : INIT_SLOTS;
    setSlots(nextSlots);
    setRxForm((f) => ({
      ...f,
      medicationId: med?.id || '',
      selectedMed: med || null,
      duration: macro.duration || '5 Days',
      customDuration: '',
      instructions: macro.instructions || '',
      translatedInstructions: {},
      quantity: Number(macro.quantity || 1),
    }));
    setMedSearch(med?.name || macro.medicationName || '');
    setAutoQty(false);
    toast.success(`Applied macro: ${macro.name}`);
  };

  const deleteRxMacro = () => {
    if (!selectedRxMacroId) return toast.error('Select a prescription macro');
    const macro = rxMacros.find((x) => x.id === selectedRxMacroId);
    if (!macro) return;
    setRxMacros((prev) => prev.filter((x) => x.id !== selectedRxMacroId));
    setSelectedRxMacroId('');
    toast.success(`Deleted macro: ${macro.name}`);
  };

  const translateRxInstructions = async () => {
    const text = String(rxForm.instructions || '').trim();
    if (!text) return toast.error('Write note text before translation');
    if (!rxTargetLangs.length) return toast.error('Select at least one language');

    setTranslatingRx(true);
    try {
      const res = await api.post('/prescriptions/translate', {
        text,
        targetLanguages: rxTargetLangs,
        sourceLanguage: 'auto',
      });
      const translated = parseTranslatedInstructions(res.data.translations);
      setRxForm((f) => ({ ...f, translatedInstructions: translated }));

      const failed = Array.isArray(res.data.failures) ? res.data.failures.length : 0;
      if (failed > 0) toast.warning(`Translated with ${failed} language failure(s)`);
      else toast.success('Translation completed');
    } catch (err) {
      toast.error(err.response.data.message || 'Translation failed');
    } finally {
      setTranslatingRx(false);
    }
  };

  const addPrescription = async (e) => {
    e.preventDefault();
    if (!rxForm.medicationId) return toast.error('Please select a medication');
    const dur = rxForm.customDuration || rxForm.duration;
    try {
      const res = await api.post('/prescriptions', {
        appointmentId: id, medicationId: rxForm.medicationId,
        dosage: rxForm.selectedMed.dosage || '',
        frequency: buildFrequency(slots), timing: buildTiming(slots),
        duration: dur,
        instructions: rxForm.instructions,
        instructionsOriginal: rxForm.instructions,
        translatedInstructions: rxForm.translatedInstructions || {},
        quantity: rxForm.quantity,
      });
      setPrescriptions(p => [...p, res.data]);
      setRxForm(INIT_RX); setSlots(INIT_SLOTS); setMedSearch(''); setAutoQty(true);
      toast.success('Prescription added');
    } catch (err) { toast.error(err.response.data.message || 'Failed'); }
  };

  const deletePrescription = async (pid) => {
    try { await api.delete(`/prescriptions/${pid}`); setPrescriptions(p => p.filter(x => x.id !== pid)); toast.success('Removed'); }
    catch { toast.error('Failed'); }
  };

  const orderLabTest = async (e) => {
    e.preventDefault();
    if (!labOrderForm.testName.trim()) return toast.error('Test name is required');
    setLabOrdering(true);
    try {
      await labAPI.createTest({
        ...labOrderForm,
        appointmentId: id,
        patientId: appt.patient.id,
        price:labOrderForm.price ? parseFloat(labOrderForm.price) : undefined,
      });
      const res = await labAPI.getAllTests({ appointmentId: id });
      setLabTests(res.data || []);
      setLabOrderForm({ testName: '', category: '', labId: '', price: '', normalRange: '', unit: '', templateId: '' });
      setLabOrderOpen(false);
      toast.success('Lab test ordered');
    } catch (err) { toast.error(err.response.data.message || 'Failed to order test'); }
    finally { setLabOrdering(false); }
  };

  const cancelLabTest = async (testId) => {
    try {
      await labAPI.updateTest(testId, { status: 'cancelled' });
      setLabTests(prev => prev.map(t => t.id === testId ? { ...t, status: 'cancelled' } : t));
      toast.success('Test cancelled');
    } catch { toast.error('Failed to cancel test'); }
  };

  const refreshLabTests = async () => {
    try {
      const res = await labAPI.getAllTests({ appointmentId: id });
      setLabTests(res.data || []);
      toast.info('Lab tests refreshed');
    } catch { toast.error('Failed to refresh'); }
  };

  const uploadDoc = async (e) => {
    e.preventDefault();
    if (!docForm.file) return toast.error('Please select a file');
    if (!docForm.title.trim()) return toast.error('Please enter a title');
    const patientId = appt.patient.id;
    if (!patientId) return;
    setDocUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', docForm.title);
      fd.append('type', docForm.type);
      fd.append('appointmentId', id);
      fd.append('file', docForm.file);
      await reportAPI.upload(patientId, fd);
      const r = await reportAPI.getByPatient(patientId);
      setDocuments((r.data || []).filter(d => d.appointmentId === id));
      setDocForm({ title: '', type: 'other', file: null });
      setDocUploadOpen(false);
      toast.success('Document uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setDocUploading(false); }
  };

  const downloadDoc = async (doc) => {
    try {
      const res = await reportAPI.download(doc.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = doc.originalName || doc.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  // Open a report file inline in a new browser tab (PDF / image renders natively)
  const viewFile = async (report) => {
    try {
      const res = await reportAPI.download(report.id);
      const blob = new Blob([res.data], { type: report.mimeType || 'application/octet-stream' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { toast.error('Failed to open file'); }
  };

  const downloadPDF = async (type) => {
    setDownloading(type);
    try {
      const res = type === 'prescription' ? await pdfAPI.prescription(id) : await pdfAPI.bill(id);
      downloadBlob(res.data, `${type}-${appt.appointmentNumber || id}.pdf`);
    } catch { toast.error(`Failed to download ${type} PDF`); } finally { setDownloading(''); }
  };

  const downloadDischargeSummary = async () => {
    setDownloading('discharge');
    try {
      const res = await pdfAPI.dischargeSummary(id, dischargeForm);
      downloadBlob(res.data, `discharge-summary-${appt.appointmentNumber || id}.pdf`);
      toast.success('Discharge summary downloaded');
    } catch { toast.error('Failed to generate discharge summary'); } finally { setDownloading(''); }
  };

  const consumePackageVisit = async (assignment) => {
    if (!assignment?.id) return;
    const note = window.prompt('Optional note for package usage') || '';
    setConsumingPackageId(assignment.id);
    try {
      await packageAPI.consumeVisit(assignment.id, { appointmentId: id, notes: note || null });
      const [apptRes, pkgRes] = await Promise.all([
        api.get(`/appointments/${id}`),
        packageAPI.getPatientAssignments(appt.patient.id, { status: 'active' }),
      ]);
      setAppt(apptRes.data);
      setNotes((prev) => ({
        ...prev,
        notes: apptRes.data.notes || prev.notes,
      }));
      setPatientPackages(pkgRes.data || []);
      toast.success('Package visit consumed and consultation fee adjusted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to consume package visit');
    } finally {
      setConsumingPackageId('');
    }
  };

  if (!appt) return (
    <div className="flex justify-center p-16">
      <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
    </div>
  );

  const patient = appt.patient;
  const isCompleted = appt.status === 'completed';

  //  Render 

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-teal-600 font-medium">Back</button>
          <h2 className="text-xl font-bold text-gray-800">Appointment #{appt.appointmentNumber}</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {appt.status}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadPDF('prescription')} disabled={!!downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
            {downloading === 'prescription' ? 'Downloading...' : 'Prescription PDF'}
          </button>
          <button onClick={() => downloadPDF('bill')} disabled={!!downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {downloading === 'bill' ? 'Downloading...' : 'Bill PDF'}
          </button>
          <button onClick={() => setDischargeModal(true)} disabled={!!downloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
            📄 Discharge Summary
          </button>
        </div>
      </div>

      {/* Discharge Summary Modal */}
      {dischargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Discharge Summary</h3>
                <p className="text-xs text-gray-400 mt-0.5">Generate PDF discharge summary for {appt.patient?.name}</p>
              </div>
              <button onClick={() => setDischargeModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Preview of what will be included */}
              <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-1.5">
                <div className="font-semibold text-gray-600 mb-2 text-sm">Will include from appointment:</div>
                {[
                  ['Chief Complaint', appt.reason],
                  ['Diagnosis', appt.diagnosis],
                  ['Treatment Given', appt.treatmentDone],
                  ['Advice', appt.advice],
                  ['Follow-up Date', appt.followUpDate],
                ].map(([label, val]) => val && (
                  <div key={label} className="flex gap-2">
                    <span className="text-gray-400 min-w-[110px]">{label}:</span>
                    <span className="text-gray-700 line-clamp-1">{val}</span>
                  </div>
                ))}
                {appt.prescriptions?.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 min-w-[110px]">Medicines:</span>
                    <span className="text-gray-700">{appt.prescriptions.length} prescription(s)</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Condition at Discharge</label>
                <select value={dischargeForm.conditionAtDischarge}
                  onChange={e => setDischargeForm(f => ({ ...f, conditionAtDischarge: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                  {['Stable', 'Improved', 'LAMA', 'Expired', 'Transferred'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Discharge Date</label>
                <input type="date" value={dischargeForm.dischargeDate}
                  onChange={e => setDischargeForm(f => ({ ...f, dischargeDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Additional Discharge Notes</label>
                <textarea rows={3} value={dischargeForm.dischargeNotes}
                  onChange={e => setDischargeForm(f => ({ ...f, dischargeNotes: e.target.value }))}
                  placeholder="Any additional instructions or notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDischargeModal(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={downloadDischargeSummary} disabled={downloading === 'discharge'}
                  className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {downloading === 'discharge' ? 'Generating...' : '📄 Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Patient</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ['Name', patient.name], ['Patient ID', patient.patientId], ['Phone', patient.phone],
            ['Blood Group', patient.bloodGroup], ['Date of Birth', patient.dateOfBirth],
            ['Appointment', `${appt.appointmentDate} ${appt.appointmentTime.slice(0,5) || ''}`],
          ].map(([label, val]) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
              <div className="text-sm font-semibold text-gray-700 mt-0.5">{val || '-'}</div>
            </div>
          ))}
        </div>
        {patient.allergies && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <strong>Allergies:</strong> {patient.allergies}
          </div>
        )}
        {patient.medicalHistory && (
          <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm">
            <span className="font-medium text-gray-600">Medical History:</span> {patient.medicalHistory}
          </div>
        )}
        {appt.reason && (
          <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            x <strong>Reason:</strong> {appt.reason}
          </div>
        )}
      </div>

      {/*  VITALS  */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Patient Vitals</h3>
          {vitalsRecorded && (
            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">Recorded</span>
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

              {/* Blood Pressure  combined systolic/diastolic */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Blood Pressure</div>
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
                    <span className="text-xs text-gray-500">{vitalsForm.systolic || '-'} / {vitalsForm.diastolic || '-'}</span>
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
                <div className="text-xs text-gray-500 mb-1">a Weight</div>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.1" value={vitalsForm.weight} placeholder="70"
                    onChange={e => setV('weight', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                  <span className="text-xs text-gray-400">kg</span>
                </div>
              </div>

              {/* Height */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">x Height</div>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.1" value={vitalsForm.height} placeholder="170"
                    onChange={e => setV('height', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-teal-400" />
                  <span className="text-xs text-gray-400">cm</span>
                </div>
              </div>

              {/* BMI  auto */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">x` BMI</div>
                <div className="font-bold text-lg" style={{ color: bmiColor(bmi) }}>
                  {bmi || ''}
                </div>
                {bmi && (
                  <div className="text-xs mt-0.5" style={{ color: bmiColor(bmi) }}>{bmiLabel(bmi)}</div>
                )}
              </div>

              {/* Blood Sugar */}
              <div className="bg-gray-50 rounded-xl p-3 col-span-1 md:col-span-1">
                <div className="text-xs text-gray-500 mb-1">x Blood Sugar</div>
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
              placeholder="Additional observations, nurse notes"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>

          <button type="submit" disabled={vitalsSaving}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {vitalsSaving ? 'Saving...' : vitalsRecorded ? 'Update Vitals' : 'Save Vitals'}
          </button>
        </form>
      </div>

      {/*  CLINICAL NOTES  */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Clinical Notes</h3>
        <div className="mb-4 p-3 rounded-lg border border-teal-100 bg-teal-50">
          <div className="text-xs font-semibold text-teal-700 mb-2">Quick Templates</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="border border-teal-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-teal-400 bg-white"
            />
            <button
              type="button"
              onClick={saveNoteTemplate}
              className="text-xs bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 font-medium"
            >
              Save Current
            </button>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="border border-teal-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-teal-400 bg-white"
            >
              <option value="">Select template</option>
              {noteTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyNoteTemplate}
                className="flex-1 text-xs bg-white text-teal-700 border border-teal-300 px-3 py-2 rounded-lg hover:bg-teal-100 font-medium"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={deleteNoteTemplate}
                className="flex-1 text-xs bg-white text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
            <textarea rows={2} value={notes.diagnosis} onChange={e => setNotes(n => ({ ...n, diagnosis: e.target.value }))}
              placeholder="Enter diagnosis"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor's Notes</label>
            <textarea rows={2} value={notes.notes} onChange={e => setNotes(n => ({ ...n, notes: e.target.value }))}
              placeholder="Observations, follow-up instructions"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Done</label>
            <textarea rows={2} value={notes.treatmentDone} onChange={e => setNotes(n => ({ ...n, treatmentDone: e.target.value }))}
              placeholder="Describe treatment/procedure done for this appointment"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>
          {/*  Bill Items  */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Bill Items</label>
              <button type="button" onClick={addBillRow}
                className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-lg hover:bg-teal-100 font-medium">
                + Add Item
              </button>
            </div>

            {billItems.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-2">No bill items yet. Click "+ Add Item" to add charges.</div>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 60px 80px 70px 28px', gap: 4 }}
                  className="text-xs font-semibold text-gray-500 pb-1 border-b border-gray-100">
                  <span>Description</span><span>Category</span><span>Qty</span><span>Unit Price</span><span className="text-right">Amount</span><span/>
                </div>
                {billItems.map(item => (
                  <div key={item._key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 60px 80px 70px 28px', gap: 4, alignItems: 'center' }}>
                    <input type="text" value={item.description} placeholder="e.g. Wound dressing"
                      onChange={e => updateBillRow(item._key, 'description', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500" />
                    <select value={item.category} onChange={e => updateBillRow(item._key, 'category', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500">
                      {['procedure','medication','lab_test','room_charge','other'].map(c =>
                        <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                    </select>
                    <input type="number" min="0.5" step="0.5" value={item.quantity}
                      onChange={e => updateBillRow(item._key, 'quantity', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500" />
                    <input type="number" min="0" step="0.01" value={item.unitPrice} placeholder="0.00"
                      onChange={e => updateBillRow(item._key, 'unitPrice', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500" />
                    <span className="text-xs font-semibold text-gray-700 text-right pr-1">{Number(item.amount || 0).toFixed(2)}</span>
                    <button type="button" onClick={() => removeBillRow(item._key)}
                      className="text-red-300 hover:text-red-500 text-base font-bold text-center">x</button>
                  </div>
                ))}
              </div>
            )}

            {/* Totals & pay status */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-gray-500 space-y-0.5">
                {Number(appt.fee || 0) > 0 && <div>Consultation fee: <strong>{Number(appt.fee).toFixed(2)}</strong></div>}
                <div>Treatment items: <strong>{billItems.reduce((s,i) => s + Number(i.amount||0), 0).toFixed(2)}</strong></div>
                <div className="text-sm font-bold text-gray-800 pt-1">
                  Total: {(Number(appt.fee || 0) + billItems.reduce((s,i) => s + Number(i.amount||0), 0)).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={saveBill} disabled={billSaving}
                  className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
                  {billSaving ? 'Saving' : 'Save Bill'}
                </button>
                <button type="button" onClick={togglePaid}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${appt.isPaid ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                  {appt.isPaid ? 'Paid' : 'Mark as Paid'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveNotes} disabled={saving}
              className="bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Saving' : 'Save Notes'}
            </button>
            {!isCompleted ? (
              <button onClick={completeConsultation} disabled={saving}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                S Complete Consultation
              </button>
            ) : (
              <span className="text-sm text-green-600 font-medium">S Consultation completed</span>
            )}
          </div>
        </div>
      </div>

      {/*  PRESCRIPTIONS  */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Patient Packages</h3>
        {packagesLoading ? (
          <div className="text-sm text-gray-500">Loading active packages...</div>
        ) : patientPackages.length === 0 ? (
          <div className="text-sm text-gray-500">No active package found for this patient.</div>
        ) : (
          <div className="space-y-2">
            {patientPackages.map((pkg) => {
              const used = Number(pkg.usedVisits || 0);
              const total = Number(pkg.totalVisits || 0);
              const remaining = Math.max(total - used, 0);
              return (
                <div key={pkg.id} className="border border-teal-100 bg-teal-50 rounded-lg px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-teal-900">{pkg.plan?.name || 'Package Plan'}</div>
                      <div className="text-xs text-teal-700">
                        Visits: {used}/{total} | Remaining: {remaining} | Expiry: {pkg.expiryDate || '-'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => consumePackageVisit(pkg)}
                      disabled={remaining <= 0 || consumingPackageId === pkg.id}
                      className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-md hover:bg-teal-700 disabled:opacity-50"
                    >
                      {consumingPackageId === pkg.id ? 'Applying...' : 'Use Package Visit'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/*  PRESCRIPTIONS  */}
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
                      <span className="font-semibold text-gray-800">{p.medication.name}</span>
                      {p.medication.dosage && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{p.medication.dosage}</span>}
                      {p.medication.category && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded capitalize">{p.medication.category}</span>}
                    </div>
                    {p.medication.composition && <div className="text-xs text-blue-500 mb-2">Composition: {p.medication.composition}</div>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.frequency && <span className="font-mono font-bold text-base text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-lg tracking-widest">{p.frequency}</span>}
                      {p.timing && <span className="text-xs text-gray-500">{p.timing}</span>}
                      {p.duration && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Duration: {p.duration}</span>}
                      {p.quantity && <span className="text-xs text-gray-500 ml-auto">Qty: <strong>{p.quantity}</strong></span>}
                    </div>
                    {(p.instructionsOriginal || p.instructions) && (
                      <div className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">
                        <strong>Original:</strong> {p.instructionsOriginal || p.instructions}
                      </div>
                    )}
                    {Object.entries(parseTranslatedInstructions(p.translatedInstructions)).map(([code, text]) => (
                      <div key={code} className="mt-1 text-xs text-cyan-800 bg-cyan-50 border border-cyan-100 rounded px-2.5 py-1.5">
                        <strong>{LANG_LABEL_BY_CODE[code] || code.toUpperCase()}:</strong> {text}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => deletePrescription(p.id)} className="text-red-300 hover:text-red-500 text-sm p-1 flex-shrink-0">x</button>
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
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm"></span>
              <input value={medSearch} onFocus={() => setMedOpen(true)}
                onChange={e => { setMedSearch(e.target.value); setMedOpen(true); if (!e.target.value) clearMed(); }}
                placeholder="Type name, generic name or composition"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            {rxForm.selectedMed && (
              <div className="mt-1.5 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-semibold text-teal-800">{rxForm.selectedMed.name}</span>
                {rxForm.selectedMed.dosage && <span className="text-teal-600 text-xs">{rxForm.selectedMed.dosage}</span>}
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded capitalize">{rxForm.selectedMed.category}</span>
                {rxForm.selectedMed.stockQuantity < 10 && <span className="text-xs text-red-500 font-semibold">Low stock: {rxForm.selectedMed.stockQuantity} remaining</span>}
                <button type="button" onClick={clearMed} className="ml-auto text-gray-400 hover:text-red-500">x</button>
              </div>
            )}
            {allergyWarning && (
              <div className="mt-1.5 bg-red-100 border-2 border-red-500 rounded-lg px-3 py-2.5 text-sm text-red-800 font-semibold flex items-start gap-2">
                <span className="text-red-600 text-base">⚠</span>
                <div>
                  <div>ALLERGY ALERT — Patient may be allergic to this medicine!</div>
                  <div className="text-xs font-normal mt-0.5 text-red-700">Recorded allergies: {appt.patient.allergies}</div>
                </div>
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
                    {m.composition && <div className="text-xs text-blue-500 mt-0.5">Composition: {m.composition}</div>}
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
                placeholder="Custom"
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
              Instructions <span className="text-gray-400">(any language - Kannada, Hindi, English)</span>
            </label>
            <textarea rows={2} lang="mul" value={rxForm.instructions}
              onChange={e => setRxForm(f => ({ ...f, instructions: e.target.value, translatedInstructions: {} }))}
              placeholder="After food - Use as advised by doctor"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none" />
            <div className="mt-2 flex flex-wrap gap-2">
              {RX_INSTRUCTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => addInstructionChip(chip)}
                  className="px-2 py-1 rounded-full text-xs border bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESCRIPTION_LANGS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleRxTargetLang(lang.code)}
                  className={`px-2 py-1 rounded-full text-xs border ${
                    rxTargetLangs.includes(lang.code)
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
              <button
                type="button"
                onClick={translateRxInstructions}
                disabled={translatingRx}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white border border-indigo-600 disabled:opacity-50"
              >
                {translatingRx ? 'Translating...' : 'Translate Note'}
              </button>
            </div>
            {Object.keys(rxForm.translatedInstructions || {}).length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-[11px] font-semibold text-gray-500 uppercase">Translated Preview</div>
                {Object.entries(rxForm.translatedInstructions).map(([code, text]) => (
                  <div key={code} className="text-xs text-cyan-800 bg-cyan-50 border border-cyan-100 rounded px-2.5 py-1.5">
                    <strong>{LANG_LABEL_BY_CODE[code] || code.toUpperCase()}:</strong> {text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Prescription Macros</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={rxMacroName}
                onChange={(e) => setRxMacroName(e.target.value)}
                placeholder="Macro name (e.g. Viral Fever Adult)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
              <select
                value={selectedRxMacroId}
                onChange={(e) => setSelectedRxMacroId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="">Select macro</option>
                {rxMacros.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={saveRxMacro} className="px-3 py-2 text-xs rounded-lg bg-teal-600 text-white font-semibold">
                  Save Macro
                </button>
                <button type="button" onClick={applyRxMacro} className="px-3 py-2 text-xs rounded-lg bg-indigo-600 text-white font-semibold">
                  Apply
                </button>
                <button type="button" onClick={deleteRxMacro} className="px-3 py-2 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 font-semibold">
                  Delete
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
            + Add to Prescription
          </button>
        </form>
      </div>

      {/*  LAB TESTS  */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Lab Tests</h3>
          <div className="flex items-center gap-2">
            <button onClick={refreshLabTests}
              className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-100 font-medium"
              title="Refresh to see latest results from lab">
              ↻ Refresh
            </button>
            <button onClick={() => setLabOrderOpen(o => !o)}
              className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 font-medium">
              {labOrderOpen ? 'Cancel' : '+ Order Test'}
            </button>
          </div>
        </div>

        {/* Order form */}
        {labOrderOpen && (
          <form onSubmit={orderLabTest} className="border-2 border-dashed border-indigo-200 rounded-xl p-4 mb-4 space-y-3 bg-indigo-50/30">
            <div className="text-xs font-semibold text-indigo-700 mb-1">New Lab Test Order</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Test Name *</label>
                <input value={labOrderForm.testName} required onChange={e => setLabOrderForm(f => ({ ...f, testName: e.target.value }))}
                  placeholder="e.g. Complete Blood Count"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Category</label>
                <input value={labOrderForm.category} onChange={e => setLabOrderForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Blood, Urine, Imaging"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Lab</label>
                <SearchableSelect
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                  value={labOrderForm.labId}
                  onChange={(value) => setLabOrderForm((f) => ({ ...f, labId: value }))}
                  options={labs.map((l) => ({ value: l.id, label: l.name }))}
                  placeholder="Search lab..."
                  emptyLabel="-- Select Lab --"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Price (Rs)</label>
                <input type="number" min="0" step="0.01" value={labOrderForm.price} onChange={e => setLabOrderForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Optional"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Normal Range</label>
                <input value={labOrderForm.normalRange} onChange={e => setLabOrderForm(f => ({ ...f, normalRange: e.target.value }))}
                  placeholder="e.g. 4.5-11.0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Unit</label>
                <input value={labOrderForm.unit} onChange={e => setLabOrderForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="e.g. x10^3/uL"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Report Template <span className="text-gray-400">(lab tech will fill structured values)</span></label>
                <select value={labOrderForm.templateId} onChange={e => setLabOrderForm(f => ({ ...f, templateId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  <option value="">— None (free text) —</option>
                  {labTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}{tpl.category ? ` (${tpl.category})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={labOrdering}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {labOrdering ? 'Ordering' : '+ Order Lab Test'}
            </button>
          </form>
        )}

        {/* Tests list */}
        {/* Results available banner */}
        {labTests.some(t => t.status === 'completed') && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-semibold flex items-center gap-2">
            ✅ Lab results are available — review the published reports below.
          </div>
        )}

        {labTests.length === 0 ? (
          <div className="text-sm text-gray-400 italic text-center py-4">No lab tests ordered for this appointment</div>
        ) : (
          <div className="space-y-2">
            {labTests.map(t => {
              const statusColors = { ordered: 'bg-blue-100 text-blue-700', sample_collected: 'bg-yellow-100 text-yellow-700', processing: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-500' };
              const statusLabels = { ordered: 'Ordered', sample_collected: 'Sample Collected', processing: 'Processing', completed: 'Results Published', cancelled: 'Cancelled' };
              return (
                <div key={t.id} className={`rounded-xl p-3 border ${t.status === 'completed' ? 'bg-green-50/30 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800">{t.testName}
                          {t.testCode && <span className="text-xs font-normal text-gray-400 ml-1">({t.testCode})</span>}
                        </span>
                        {t.isAbnormal && t.status === 'completed' && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">⚠ Abnormal Values</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3">
                        {t.category && <span>{t.category}</span>}
                        {t.lab?.name && <span>Lab: {t.lab.name}</span>}
                        {t.price > 0 && <span>Rs {Number(t.price).toFixed(2)}</span>}
                        {t.normalRange && <span>Normal: {t.normalRange} {t.unit}</span>}
                        {t.status === 'completed' && t.completedDate && (
                          <span className="text-green-600 font-medium">
                            ✓ Published {new Date(t.completedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {/* ── Structured template result ── */}
                      {t.status === 'completed' && t.template && t.templateValues && (
                        <div className="mt-2 border border-indigo-100 rounded-xl overflow-hidden">
                          <div className="bg-indigo-600 px-3 py-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">🧪 {t.template.name}</span>
                            <div className="flex items-center gap-2">
                              {t.isAbnormal && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">⚠ Abnormal Values</span>}
                              <span className="text-xs text-indigo-200">Lab Report</span>
                            </div>
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '5px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Parameter</th>
                                <th style={{ padding: '5px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Result</th>
                                <th style={{ padding: '5px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Unit</th>
                                <th style={{ padding: '5px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Normal Range</th>
                                <th style={{ padding: '5px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(t.template.fields || []).map((field, fi) => {
                                const val = t.templateValues[field.key];
                                const isAbn = (t.abnormalFields || []).includes(field.key);
                                return (
                                  <tr key={field.key} style={{ borderTop: '1px solid #f1f5f9', background: isAbn ? '#fff1f2' : fi % 2 === 0 ? '#fff' : '#fafafa' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: 500, color: '#1e293b' }}>{field.label}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: isAbn ? '#dc2626' : '#166534', fontSize: 13 }}>{val || '—'}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>{field.unit || '—'}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>{field.normalRange || '—'}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <span style={{ background: isAbn ? '#fee2e2' : '#dcfce7', color: isAbn ? '#dc2626' : '#15803d', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                        {isAbn ? '⚠ HIGH/LOW' : '✓ Normal'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {t.technicianNotes && (
                            <div style={{ padding: '6px 10px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#64748b' }}>
                              <strong>Tech notes:</strong> {t.technicianNotes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Freetext result (no template) ── */}
                      {t.status === 'completed' && !t.template && (t.resultValue || t.result) && (
                        <div className="mt-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5 text-xs text-green-800">
                          <strong>Result:</strong>
                          {t.resultValue && <span className="font-bold mx-1">{t.resultValue}</span>}
                          {t.result && t.result !== t.resultValue && <span>{t.result}</span>}
                          {t.isAbnormal && <span className="ml-1 bg-red-100 text-red-600 px-1 py-0.5 rounded">Abnormal</span>}
                        </div>
                      )}
                      {t.status === 'completed' && !t.template && !t.resultValue && !t.result && (
                        <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 italic">
                          No detailed result values recorded — check with lab technician
                        </div>
                      )}
                      {t.status === 'completed' && !t.template && t.technicianNotes && (
                        <div className="mt-1 text-xs text-gray-500 italic">Notes: {t.technicianNotes}</div>
                      )}
                      {/* Uploaded report file — scoped to this patient only */}
                      {t.status === 'completed' && t.report && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 font-medium">
                            📎 {t.report.originalName}
                            {t.report.fileSize && <span className="text-gray-400 ml-1">({(t.report.fileSize / 1024).toFixed(0)} KB)</span>}
                          </span>
                          <button
                            onClick={() => viewFile(t.report)}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                            View Online
                          </button>
                          <button
                            onClick={() => downloadDoc(t.report)}
                            className="text-xs bg-gray-600 text-white px-2.5 py-0.5 rounded-lg hover:bg-gray-700 font-medium transition-colors">
                            Download
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                      {(t.status === 'ordered' || t.status === 'sample_collected') && (
                        <button onClick={() => cancelLabTest(t.id)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium">Cancel</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/*  DOCUMENTS  */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Documents</h3>
          <button onClick={() => setDocUploadOpen(o => !o)}
            className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg hover:bg-purple-100 font-medium">
            {docUploadOpen ? 'Cancel' : '+ Upload File'}
          </button>
        </div>

        {/* Upload form */}
        {docUploadOpen && (
          <form onSubmit={uploadDoc} className="border-2 border-dashed border-purple-200 rounded-xl p-4 mb-4 space-y-3 bg-purple-50/30">
            <div className="text-xs font-semibold text-purple-700 mb-1">Upload Document</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Title *</label>
                <input value={docForm.title} required onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Chest X-Ray Report"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
                <select value={docForm.type} onChange={e => setDocForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                  {['lab_report','radiology','discharge_summary','prescription','medical_certificate','other'].map(t =>
                    <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">File *</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => setDocForm(f => ({ ...f, file: e.target.files[0] }))}
                className="w-full text-sm text-gray-600" required />
              <div className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC (max 10 MB)</div>
            </div>
            <button type="submit" disabled={docUploading}
              className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {docUploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>
        )}

        {documents.length === 0 ? (
          <div className="text-sm text-gray-400 italic text-center py-4">No documents attached to this appointment</div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800 truncate">{doc.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {doc.type.replace(/_/g,' ')} - {doc.originalName}
                    {doc.fileSize && <span> - {(doc.fileSize / 1024).toFixed(0)} KB</span>}
                  </div>
                </div>
                <button onClick={() => downloadDoc(doc)}
                  className="ml-3 text-xs bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 font-medium transition-colors">
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*  PREVIOUS VISITS  */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Previous Visits</h3>
        {historyLoading ? (
          <div className="text-sm text-gray-400">Loading history</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">No previous visits found</div>
        ) : (
          <div className="space-y-4">
            {history.map(visit => {
              const vt = visit.vitals || null;
              const symptomList = vt?.symptoms ? parseSymptoms(vt.symptoms) : [];
              return (
                <div key={visit.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-white transition-colors">
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{visit.appointmentDate}</span>
                      {visit.appointmentTime && <span className="text-xs text-gray-500">at {visit.appointmentTime.slice(0,5)}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${visit.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{visit.status}</span>
                    </div>
                    <span className="text-xs text-gray-500">Dr. {visit.doctor.name || '-'}{visit.doctor.specialization ? ` - ${visit.doctor.specialization}` : ''}</span>
                  </div>

                  {/* Vitals snapshot */}
                  {vt && vt.id && (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 mb-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                      {vt.heartRate && <span>HR <strong>{vt.heartRate}</strong> bpm</span>}
                      {(vt.systolic || vt.diastolic) && <span>BP <strong>{vt.systolic||'-'}/{vt.diastolic||'-'}</strong> mmHg</span>}
                      {vt.temperature && <span>Temp <strong>{vt.temperature}</strong>C</span>}
                      {vt.spo2 && <span>SpO2 <strong>{vt.spo2}</strong>%</span>}
                      {vt.weight && <span>Weight <strong>{vt.weight}</strong> kg</span>}
                      {vt.bmi && <span>BMI <strong>{vt.bmi}</strong> ({bmiLabel(vt.bmi)})</span>}
                      {vt.bloodSugar && <span>Sugar <strong>{vt.bloodSugar}</strong> mg/dL</span>}
                      {symptomList.length > 0 && (
                        <span className="text-orange-600">Symptoms: {symptomList.join(', ')}</span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                    <div><div className="text-xs text-gray-400 uppercase mb-0.5">Reason</div><div className="text-gray-700">{visit.reason || '-'}</div></div>
                    <div><div className="text-xs text-gray-400 uppercase mb-0.5">Diagnosis</div><div className="text-gray-700">{visit.diagnosis || '-'}</div></div>
                    {visit.notes && <div className="md:col-span-2"><div className="text-xs text-gray-400 uppercase mb-0.5">Notes</div><div className="text-gray-700">{visit.notes}</div></div>}
                  </div>

                  {visit.prescriptions.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 uppercase mb-1.5">Medicines</div>
                      <div className="space-y-1">
                        {visit.prescriptions.map(rx => (
                          <div key={rx.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="font-medium">{rx.medication.name}</span>
                            {rx.medication.dosage && <span className="text-xs text-gray-400">{rx.medication.dosage}</span>}
                            {rx.frequency && <span className="font-mono text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{rx.frequency}</span>}
                            {rx.timing && <span className="text-xs text-gray-500">{rx.timing}</span>}
                            {rx.duration && <span className="text-xs text-gray-400"> {rx.duration}</span>}
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
