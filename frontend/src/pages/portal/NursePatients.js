import React, { useState, useEffect } from 'react';
import { ipdAPI, nurseAPI, doctorAPI, userAPI, vitalsAPI, clinicalNotesAPI, fluidBalanceAPI, medicationAdminAPI, nurseHandoverAPI, medicineInvoiceAPI } from '../../services/api';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import { toast } from 'react-toastify';
import styles from '../Page.module.css';

const VITAL_INIT = { temp: '', pulse: '', bp_systolic: '', bp_diastolic: '', spO2: '', respRate: '', weight: '', notes: '' };

export default function NursePatients() {
  const [medHistory, setMedHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nurse, setNurse] = useState(null);
    const [assignedAdmissions, setAssignedAdmissions] = useState([]);
    const [vitalModal, setVitalModal] = useState(null);
    const [vitalForm, setVitalForm] = useState(VITAL_INIT);
    const [historyModal, setHistoryModal] = useState(null);
    const [vitalsHistory, setVitalsHistory] = useState([]);
    const [noteModal, setNoteModal] = useState(null);
    const [noteForm, setNoteForm] = useState({ noteType: 'nursing', content: '' });
    const [showNotes, setShowNotes] = useState(false);
    const [noteHistory, setNoteHistory] = useState([]);
    const [medModal, setMedModal] = useState(null);
    const [saving, setSaving] = useState(false);
  const [handoverModal, setHandoverModal] = useState(null);
  const [handoverHistory, setHandoverHistory] = useState([]);
  const [fluidModal, setFluidModal] = useState(null);
  const [fluidData, setFluidData] = useState({ history: [], summary: { totalIntake: 0, totalOutput: 0, balance: 0 } });
  const [fluidForm, setFluidForm] = useState({ type: 'intake', route: 'Oral', amount: '', notes: '' });
  const [handoverForm, setHandoverForm] = useState({
      situation: '',
      background: '',
      assessment: '',
      recommendation: '',
      toNurseId: ''
  });
  const [allNurses, setAllNurses] = useState([]);

  useEffect(() => {
    loadData();
    loadNurses();
  }, []);

  const loadNurses = async () => {
    try {
        const res = await nurseAPI.getAll();
        setAllNurses(res.data || []);
    } catch {
        toast.error('Failed to load nurses for handover');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const nRes = await nurseAPI.getMe();
      const me = nRes.data;
      setNurse(me);

      // Fetch all active IPD admissions and filter by assignment
      // Ideally we'd have a specific endpoint for this
      const aRes = await ipdAPI.getAdmissions({ status: 'admitted' });
      
      // Filter patients where this nurse is assigned
      // Note: This logic assumes assignments are available in the admission data or we fetch them separately
      // For now, let's assume we can see assignments or we simply show all in the ward for the pilot
      setAssignedAdmissions(aRes.data || []);
    } catch (err) {
      toast.error('Failed to load assigned patients');
    } finally {
      setLoading(false);
    }
  };

  const openVitalRecord = (admission) => {
    setVitalForm(VITAL_INIT);
    setVitalModal(admission);
  };

  const sanitizeNumericField = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleVitalSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        admissionId: vitalModal.id,
        temp: sanitizeNumericField(vitalForm.temp),
        pulse: sanitizeNumericField(vitalForm.pulse),
        bp_systolic: sanitizeNumericField(vitalForm.bp_systolic),
        bp_diastolic: sanitizeNumericField(vitalForm.bp_diastolic),
        spO2: sanitizeNumericField(vitalForm.spO2),
        respRate: sanitizeNumericField(vitalForm.respRate),
        weight: sanitizeNumericField(vitalForm.weight),
        notes: vitalForm.notes,
      };
            const res = await vitalsAPI.record(payload);
            const created = res.data || res;
            toast.success('Vitals recorded successfully');
            setVitalModal(null);
            if (historyModal && historyModal.id === payload.admissionId) {
                setVitalsHistory((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
            }
    } catch (err) {
      toast.error('Failed to record vitals');
    } finally {
      setSaving(false);
    }
  };

  const viewHistory = async (admission) => {
    setHistoryModal(admission);
    try {
        const res = await vitalsAPI.getHistory({ admissionId: admission.id });
        setVitalsHistory(res.data?.data || []);
    } catch {
        toast.error('Failed to load history');
    }
  };

  const openNoteModal = (admission) => {
    setNoteForm({ noteType: 'nursing', content: '' });
    setNoteModal(admission);
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
                // Create clinical note tied to patient/admission
                const res = await clinicalNotesAPI.create({ patientId: noteModal.patient.id, encounterId: noteModal.id, type: noteForm.noteType, content: { text: noteForm.content } });
                const created = res.data || res;
                toast.success('Clinical note added');
                // Normalize created note shape so the note history UI can render it
                const authorRole = created.author?.role || created.authorRole || (created.doctor ? 'doctor' : created.nurse ? 'nurse' : null);
                const authorId = created.author?.id || created.authorId || null;
                const lookupNurse = authorId ? allNurses.find(x => x.id === authorId) : null;
                const authorName = created.author?.name || created.doctor?.name || created.nurse?.name || created.authorName || (authorRole === 'nurse' ? (lookupNurse?.name) : null) || null;

                const normalized = {
                    id: created.id || `tmp-${Date.now()}`,
                    noteType: created.type || noteForm.noteType,
                    noteDate: created.noteDate || created.createdAt || new Date().toISOString(),
                    content: (created.content && typeof created.content === 'object') ? (created.content.text || '') : (created.content || noteForm.content),
                    doctor: created.doctor || null,
                    nurse: created.nurse || null,
                    authorRole,
                    authorId,
                    authorName: authorName || 'Unknown',
                };
                // Capture the admission id before closing the note modal so we can
                // append to the note history if the history view for this admission
                // is currently open.
                const admissionId = noteModal?.id;
                // If note history modal is open for this admission, append newly created note
                if (showNotes && showNotes.id === admissionId) {
                    // If authorName still unknown, attempt an immediate fetch for the author
                    if ((normalized.authorName === 'Unknown' || !normalized.authorName) && normalized.authorId) {
                        try {
                            if (normalized.authorRole === 'nurse') {
                                const r = await nurseAPI.getOne(normalized.authorId);
                                normalized.authorName = r.data?.name || r.data?.fullName || normalized.authorName;
                            } else if (normalized.authorRole === 'doctor') {
                                const r = await doctorAPI.getOne(normalized.authorId);
                                normalized.authorName = r.data?.name || r.data?.fullName || normalized.authorName;
                            }
                        } catch (e) {
                            // ignore fetch failure
                        }
                    }
                    setNoteHistory((prev) => [normalized, ...(Array.isArray(prev) ? prev : [])]);
                }
                setNoteModal(null);
    } catch {
        toast.error('Failed to add note');
    } finally {
        setSaving(false);
    }
  };

  const viewNotes = async (admission) => {
      setShowNotes(admission);
      try {
          const res = await ipdAPI.getAdmission(admission.id);
          const payload = res.data || res;
          const notes = payload?.ipdNotes || payload?.notes || payload?.data?.ipdNotes || payload?.data?.notes || payload?.history || [];
          // Also fetch clinical notes tied to this encounter/admission and merge
          let clinical = [];
          try {
              const cRes = await clinicalNotesAPI.getAll({ encounterId: admission.id });
              clinical = cRes.data || cRes;
          } catch (e) {
              // ignore clinical notes fetch errors, fallback to ipd notes only
              clinical = [];
          }

          const normalizeIpd = (n) => ({
              id: n.id,
              noteType: n.noteType || n.type || 'nursing',
              noteDate: n.noteDate || n.createdAt,
              content: typeof n.content === 'object' ? (n.content.text || '') : (n.content || ''),
              doctor: n.doctor || null,
              nurse: n.nurse || null,
              authorRole: n.author?.role || n.authorRole || (n.doctor ? 'doctor' : n.nurse ? 'nurse' : null),
              authorId: n.author?.id || n.authorId || n.createdById || null,
              authorName: n.author?.name || n.doctor?.name || n.nurse?.name || n.authorName || n.createdByName || 'Unknown',
          });

          const normalizeClinical = (c) => {
              const authorRole = c.author?.role || c.authorRole || (c.doctor ? 'doctor' : c.nurse ? 'nurse' : null);
              const authorId = c.author?.id || c.authorId || null;
              const lookupNurse = authorId ? allNurses.find(x => x.id === authorId) : null;
              const authorName = c.author?.name || c.doctor?.name || c.nurse?.name || c.authorName || (authorRole === 'nurse' ? (lookupNurse?.name) : null) || null;
              return {
                  id: c.id,
                  noteType: c.type || c.noteType || 'nursing',
                  noteDate: c.noteDate || c.createdAt,
                  content: (c.content && typeof c.content === 'object') ? (c.content.text || '') : (c.content || ''),
                  doctor: c.doctor || null,
                  nurse: c.nurse || null,
                  authorRole,
                  authorId,
                  authorName: authorName || 'Unknown',
              };
          };

          const ipdNotes = Array.isArray(notes) ? notes.map(normalizeIpd) : [];
          const clinicalNotes = Array.isArray(clinical) ? clinical.map(normalizeClinical) : [];

          // Merge and sort by date (newest first)
          const merged = [...clinicalNotes, ...ipdNotes].sort((a, b) => new Date(b.noteDate) - new Date(a.noteDate));
                    setNoteHistory(merged);
                    // Resolve any missing author names by fetching user details
                    resolveMissingAuthors(merged);
      } catch (err) {
          console.error(err);
          toast.error('Failed to load notes');
      }
  };

    // Fetch missing author details (doctor/nurse) for notes that only contain authorId
    const resolveMissingAuthors = async (notes) => {
        if (!Array.isArray(notes) || !notes.length) return;
        const missing = notes.filter(n => (!n.authorName || n.authorName === 'Unknown') && n.authorId);
        if (!missing.length) return;
        const uniq = Array.from(new Map(missing.map(n => [n.authorId, n.authorRole || 'nurse'])).entries());
        const fetches = uniq.map(async ([id, role]) => {
            try {
                if (role === 'nurse') {
                    try {
                        const r = await nurseAPI.getOne(id);
                        return { id, name: r.data?.name || r.data?.fullName || null };
                    } catch (e) {
                        // fallback to generic users endpoint
                        try {
                            const u = await userAPI.getAll({ id });
                            const user = Array.isArray(u.data) ? u.data[0] : u.data?.[0] || u.data;
                            return { id, name: user?.name || user?.fullName || null };
                        } catch (ee) {
                            return { id, name: null };
                        }
                    }
                }
                if (role === 'doctor') {
                    try {
                        const r = await doctorAPI.getOne(id);
                        return { id, name: r.data?.name || r.data?.fullName || null };
                    } catch (e) {
                        try {
                            const u = await userAPI.getAll({ id });
                            const user = Array.isArray(u.data) ? u.data[0] : u.data?.[0] || u.data;
                            return { id, name: user?.name || user?.fullName || null };
                        } catch (ee) {
                            return { id, name: null };
                        }
                    }
                }
            } catch (e) {
                return { id, name: null };
            }
            return { id, name: null };
        });
        try {
            const results = await Promise.all(fetches);
            const map = Object.fromEntries(results.map(r => [r.id, r.name]));
            setNoteHistory(prev => (Array.isArray(prev) ? prev.map(n => ({
                ...n,
                authorName: (n.authorName && n.authorName !== 'Unknown') ? n.authorName : (map[n.authorId] || n.authorName)
            })) : prev));
        } catch (e) {
            // ignore resolution failures
        }
    };

  const viewMeds = async (admission) => {
    try {
        const res = await ipdAPI.getAdmission(admission.id);
        setMedModal(res.data);
    } catch {
        toast.error('Failed to load medication log');
    }
  };

  const handleAdminister = async (prescriptionId, admissionId) => {
    try {
        await medicationAdminAPI.record({
            prescriptionId,
            admissionId,
            adminDate: new Date().toISOString().split('T')[0],
            adminTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
            status: 'given'
        });
        toast.success('Medication administration recorded');
        // Refresh modal data
                await viewMeds({ id: admissionId });
    } catch {
        toast.error('Failed to record administration');
    }
  };

    // Create a medicine invoice for a single prescription (IPD) so it can be billed
    const createInvoiceForPrescription = async (prescription) => {
        if (!medModal?.patient?.id) return toast.error('Missing patient information');
        try {
            const item = {
                medicationId: prescription.medication?.id,
                quantity: prescription.quantity || 1,
                unitPrice: prescription.unitPrice || prescription.medication?.unitPrice || 0,
            };
            const payload = {
                patientId: medModal.patient.id,
                invoiceDate: new Date().toISOString().slice(0,10),
                paymentMode: 'cash',
                isPaid: false,
                items: [item],
            };
            const res = await medicineInvoiceAPI.create(payload);
            const invoice = res.data || res;
            toast.success(`Invoice created ${invoice.invoiceNumber || invoice.id || ''}`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to create invoice');
        }
    };

    // Create a single invoice for all active IPD prescriptions for this admission
    const createInvoiceForAllPrescriptions = async () => {
        if (!medModal?.patient?.id) return toast.error('Missing patient information');
        const prescriptions = medModal?.ipdPrescriptions || [];
        if (!prescriptions.length) return toast.error('No prescriptions to bill');
        try {
            const items = prescriptions.map((p) => ({
                medicationId: p.medication?.id,
                quantity: p.quantity || 1,
                unitPrice: p.unitPrice || p.medication?.unitPrice || 0,
            }));
            const payload = {
                patientId: medModal.patient.id,
                invoiceDate: new Date().toISOString().slice(0,10),
                paymentMode: 'cash',
                isPaid: false,
                items,
            };
            const res = await medicineInvoiceAPI.create(payload);
            const invoice = res.data || res;
            toast.success(`Invoice created ${invoice.invoiceNumber || invoice.id || ''}`);
            // Open invoice PDF in a new tab (server endpoint expected at /api/pdf/medicine-invoice/:id)
            try {
                const url = `/api/pdf/medicine-invoice/${invoice.id}`;
                window.open(url, '_blank');
            } catch (e) {
                // ignore open errors
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to create invoice');
        }
    };

  const openHandoverModal = async (admission) => {
    setHandoverModal(admission);
    setHandoverForm({
        situation: '',
        background: '',
        assessment: '',
        recommendation: '',
        toNurseId: ''
    });
    try {
        const res = await nurseHandoverAPI.get({ admissionId: admission.id });
        setHandoverHistory(res.data?.data || []);
    } catch(err) {
        console.error(err);
        toast.error('Failed to load handover history');
    }
  };

  const handleHandoverSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
        await nurseHandoverAPI.create({
            ...handoverForm,
            admissionId: handoverModal.id
        });
        toast.success('Handover log created');
        setHandoverModal(null);
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to create handover');
    } finally {
        setSaving(false);
    }
  };

  const viewFluids = async (admission) => {
    setFluidModal(admission);
    setFluidForm({ type: 'intake', route: 'Oral', amount: '', notes: '' });
    try {
                const res = await fluidBalanceAPI.getHistory({ admissionId: admission.id });
                const payload = res.data || res;
                const data = payload?.data || payload?.history || payload || [];
                const summary = payload?.summary || payload?.meta || { totalIntake: 0, totalOutput: 0, balance: 0 };
                setFluidData({ data: Array.isArray(data) ? data : [], summary });
    } catch(err) {
        console.error(err);
        toast.error('Failed to load fluid history');
    }
  };

  const handleFluidSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
        await fluidBalanceAPI.record({
            ...fluidForm,
            admissionId: fluidModal.id
        });
        toast.success('Fluid log recorded');
        // refresh the fluid log for this admission
        await viewFluids(fluidModal);
    } catch {
        toast.error('Failed to record fluid log');
    } finally {
        setSaving(false);
    }
  };

  const columns = [
    { header: 'Bed/Room', render: (a) => `${a.room?.roomNumber || 'N/A'}` },
    { header: 'Patient', render: (a) => (
        <div>
            <div className="font-bold">{a.patient?.name}</div>
            <div className="text-xs text-slate-500">{a.patient?.patientId} | {a.patient?.gender}</div>
        </div>
    )},
    { header: 'Admission Date', accessor: 'admissionDate' },
    { header: 'Doctor', render: (a) => `Dr. ${a.doctor?.name || 'TBD'}` },
    { 
      header: 'Actions', 
      render: (a) => (
        <div className="flex gap-2">
            <button className="btn-primary py-1 px-3 text-xs" onClick={() => openVitalRecord(a)}>Record Vitals</button>
            <button className="btn-secondary py-1 px-3 text-xs" onClick={() => viewHistory(a)}>History</button>
            <button className="btn-warning py-1 px-3 text-xs" onClick={() => openNoteModal(a)}>Add Note</button>
            <button className="btn-info py-1 px-3 text-xs" onClick={() => viewNotes(a)}>Notes</button>
            <button className="btn-success py-1 px-3 text-xs" onClick={() => viewMeds(a)}>Meds</button>
            <button className="btn-purple-500 py-1 px-3 text-xs text-white" onClick={() => openHandoverModal(a)}>Handover</button>
            <button className="btn-info py-1 px-3 text-xs" onClick={() => viewFluids(a)}>Fluids</button>
        </div>
      )
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Assigned Patients</h1>
          <p className={styles.subtitle}>Daily clinical charting and monitoring</p>
        </div>
        <button className="btn-secondary" onClick={loadData}>Refresh List</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
          <Table columns={columns} data={assignedAdmissions} loading={loading} />
      </div>

      {/* -- Vitals Recording Modal -- */}
      <Modal isOpen={!!vitalModal} onClose={() => setVitalModal(null)} title={`Record Vitals - ${vitalModal?.patient?.name}`} size="md">
          <form onSubmit={handleVitalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">TEMP (°C)</label>
                      <input type="number" step="0.1" className="form-control" value={vitalForm.temp} onChange={e => setVitalForm({...vitalForm, temp: e.target.value})} placeholder="37.0" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">PULSE (BPM)</label>
                      <input type="number" className="form-control" value={vitalForm.pulse} onChange={e => setVitalForm({...vitalForm, pulse: e.target.value})} placeholder="72" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">BP SYSTOLIC</label>
                      <input type="number" className="form-control" value={vitalForm.bp_systolic} onChange={e => setVitalForm({...vitalForm, bp_systolic: e.target.value})} placeholder="120" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">BP DIASTOLIC</label>
                      <input type="number" className="form-control" value={vitalForm.bp_diastolic} onChange={e => setVitalForm({...vitalForm, bp_diastolic: e.target.value})} placeholder="80" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">SPO2 (%)</label>
                      <input type="number" className="form-control" value={vitalForm.spO2} onChange={e => setVitalForm({...vitalForm, spO2: e.target.value})} placeholder="98" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">RESP RATE</label>
                      <input type="number" className="form-control" value={vitalForm.respRate} onChange={e => setVitalForm({...vitalForm, respRate: e.target.value})} placeholder="18" />
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">OBSERVATION NOTES</label>
                  <textarea className="form-control" rows="3" value={vitalForm.notes} onChange={e => setVitalForm({...vitalForm, notes: e.target.value})} placeholder="Any clinical observations..."></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                  <button type="button" className="btn-secondary" onClick={() => setVitalModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Vitals'}</button>
              </div>
          </form>
      </Modal>

      {/* -- History Modal -- */}
      <Modal isOpen={!!historyModal} onClose={() => setHistoryModal(null)} title={`Vitals History - ${historyModal?.patient?.name}`} size="lg">
          <div className="space-y-4">
              {vitalsHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">No vitals recorded yet for this admission</div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                          <thead>
                              <tr className="bg-slate-50">
                                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Date/Time</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Temp</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Pulse</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">BP</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">SpO2</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">By</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {vitalsHistory.map(h => (
                                  <tr key={h.id}>
                                      <td className="px-4 py-3 text-xs">{new Date(h.recordedAt).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-xs">{h.temp}°C</td>
                                      <td className="px-4 py-3 text-xs">{h.pulse}</td>
                                      <td className="px-4 py-3 text-xs">{h.bp_systolic}/{h.bp_diastolic}</td>
                                      <td className="px-4 py-3 text-xs">{h.spO2}%</td>
                                      <td className="px-4 py-3 text-xs italic">{h.nurse?.name || 'N/A'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      </Modal>

      {/* -- Add Note Modal -- */}
      <Modal isOpen={!!noteModal} onClose={() => setNoteModal(null)} title={`Add Clinical Note - ${noteModal?.patient?.name}`} size="md">
          <form onSubmit={handleNoteSubmit} className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">NOTE TYPE</label>
                  <select className="form-control" value={noteForm.noteType} onChange={e => setNoteForm({...noteForm, noteType: e.target.value})}>
                      <option value="nursing">Nursing Note</option>
                      <option value="progress">Progress Note</option>
                      <option value="orders">Doctor Orders Follow-up</option>
                      <option value="consultation">Consultation Note</option>
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">CONTENT</label>
                  <textarea className="form-control" rows="5" value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} placeholder="Enter clinical note details..." required></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                  <button type="button" className="btn-secondary" onClick={() => setNoteModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Note'}</button>
              </div>
          </form>
      </Modal>

      {/* -- Note History Modal -- */}
      <Modal isOpen={!!showNotes} onClose={() => setShowNotes(false)} title={`Clinical Notes - ${showNotes?.patient?.name}`} size="lg">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {noteHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">No clinical notes found for this admission</div>
              ) : (
                  <>
                      {noteHistory.map(n => (
                          <div key={n.id} className="p-4 bg-slate-50 rounded-xl border-l-4 border-blue-400">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <Badge type={n.noteType}>{n.noteType.toUpperCase()}</Badge>
                                      <span className="ml-2 text-xs text-slate-500">{new Date(n.noteDate).toLocaleString()}</span>
                                  </div>
                                  <div className="text-xs font-bold text-slate-700">
                                      {n.authorName ? (
                                          (n.authorRole === 'doctor' || n.doctor) ? `Dr. ${n.authorName}` : (n.authorRole === 'nurse' || n.nurse) ? `Nurse ${n.authorName}` : n.authorName
                                      ) : 'Unknown'}
                                  </div>
                              </div>
                              <div className="text-sm text-slate-700 whitespace-pre-wrap">{n.content}</div>
                          </div>
                      ))}
                  </>
              )}
          </div>
      </Modal>

      {/* -- Medication Log Modal -- */}
      <Modal isOpen={!!medModal} onClose={() => setMedModal(null)} title={`Medication Log - ${medModal?.patient?.name}`} size="lg">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {medModal?.ipdPrescriptions?.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">No medications prescribed for this admission</div>
              ) : (
                  <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button className="btn-primary py-1 px-3 text-sm" onClick={createInvoiceForAllPrescriptions}>Create Bill for All</button>
                      </div>
                      {medModal?.ipdPrescriptions?.map(p => (
                          <div key={p.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <div className="text-lg font-bold text-slate-800">{p.medication?.name}</div>
                                      <div className="text-xs text-slate-500 font-bold uppercase">{p.dosage} | {p.frequency} | {p.timing}</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                      <button className="btn-success py-1 px-4 text-sm font-bold" onClick={() => handleAdminister(p.id, medModal.id)}>
                                          Administer Now
                                      </button>
                                      <button className="btn-secondary py-1 px-4 text-sm" onClick={() => createInvoiceForPrescription(p)}>
                                          Create Bill
                                      </button>
                                  </div>
                              </div>

                              <div className="bg-slate-50 rounded-lg p-3">
                                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Administration History</div>
                                  {p.administrations?.length === 0 ? (
                                      <div className="text-xs text-slate-400 italic">No doses recorded yet</div>
                                  ) : (
                                      <div className="space-y-2">
                                          {p.administrations.map(log => (
                                              <div key={log.id} className="flex justify-between items-center text-xs p-2 bg-white rounded border border-slate-100">
                                                  <div>
                                                      <span className="font-bold text-emerald-600">✓ Given</span>
                                                      <span className="ml-2 text-slate-500">{new Date(log.adminDate).toLocaleDateString()} at {log.adminTime}</span>
                                                  </div>
                                                  <div className="text-slate-400 italic">By: {log.nurse?.name}</div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </>
              )}
          </div>
      </Modal>

      {/* -- Handover (SBAR) Modal -- */}
      <Modal isOpen={!!handoverModal} onClose={() => setHandoverModal(null)} title={`Digital Handover (SBAR) - ${handoverModal?.patient?.name}`} size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto pr-2">
              <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="p-1 bg-purple-100 text-purple-600 rounded">📝</span> New Handover Log
                  </h3>
                  <form onSubmit={handleHandoverSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">SITUATION</label>
                          <textarea className="form-control text-sm" rows="2" value={handoverForm.situation} onChange={e => setHandoverForm({...handoverForm, situation: e.target.value})} placeholder="Current status, airway, breathing..." required></textarea>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">BACKGROUND</label>
                          <textarea className="form-control text-sm" rows="3" value={handoverForm.background} onChange={e => setHandoverForm({...handoverForm, background: e.target.value})} placeholder="Medical history, recent procedures..." required></textarea>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">ASSESSMENT</label>
                          <textarea className="form-control text-sm" rows="2" value={handoverForm.assessment} onChange={e => setHandoverForm({...handoverForm, assessment: e.target.value})} placeholder="Vitals summary, neurological status..." required></textarea>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">RECOMMENDATION</label>
                          <textarea className="form-control text-sm" rows="2" value={handoverForm.recommendation} onChange={e => setHandoverForm({...handoverForm, recommendation: e.target.value})} placeholder="Pending tasks, doctor orders..." required></textarea>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">RECEIVING NURSE (OPTIONAL)</label>
                          <select className="form-control text-sm" value={handoverForm.toNurseId} onChange={e => setHandoverForm({...handoverForm, toNurseId: e.target.value})}>
                              <option value="">Select Receiving Nurse...</option>
                              {allNurses.map(n => (
                                  <option key={n.id} value={n.id}>{n.name}</option>
                              ))}
                          </select>
                      </div>
                      <div className="pt-4">
                          <button type="submit" className="btn-primary w-full py-2 font-bold" disabled={saving}>
                              {saving ? 'Creating Log...' : 'Submit Handover'}
                          </button>
                      </div>
                  </form>
              </div>

              <div className="border-l pl-6 border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="p-1 bg-blue-100 text-blue-600 rounded">📜</span> Handover History
                  </h3>
                  <div className="space-y-4">
                      {handoverHistory.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 text-xs italic">No previous handovers found</div>
                      ) : (
                          handoverHistory.map(h => (
                              <div key={h.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="text-xs text-slate-500">
                                          <div className="font-bold text-slate-700">{new Date(h.handoverDate).toLocaleDateString()} {h.handoverTime}</div>
                                          <div>From: {h.fromNurse?.name}</div>
                                      </div>
                                      <Badge type={h.status === 'signed_off' ? 'success' : 'warning'}>
                                          {h.status.replace('_', ' ').toUpperCase()}
                                      </Badge>
                                  </div>
                                  <div className="space-y-2 text-xs">
                                      <div className="grid grid-cols-4 gap-1">
                                          <span className="font-bold text-purple-600">S:</span>
                                          <span className="col-span-3 text-slate-600 truncate">{h.situation}</span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1">
                                          <span className="font-bold text-purple-600">B:</span>
                                          <span className="col-span-3 text-slate-600 truncate">{h.background}</span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1">
                                          <span className="font-bold text-purple-600">A:</span>
                                          <span className="col-span-3 text-slate-600 truncate">{h.assessment}</span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1">
                                          <span className="font-bold text-purple-600">R:</span>
                                          <span className="col-span-3 text-slate-600 truncate">{h.recommendation}</span>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      </Modal>

      {/* -- Fluid Balance (I/O) Modal -- */}
      <Modal isOpen={!!fluidModal} onClose={() => setFluidModal(null)} title={`Fluid Balance (Intake/Output) - ${fluidModal?.patient?.name}`} size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[75vh] overflow-y-auto pr-2">
              <div className="lg:col-span-1">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Record I/O Event</h3>
                  <form onSubmit={handleFluidSubmit} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Event Type</label>
                          <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                              <button type="button" 
                                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${fluidForm.type === 'intake' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}
                                      onClick={() => setFluidForm({...fluidForm, type: 'intake'})}>INTAKE</button>
                              <button type="button" 
                                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${fluidForm.type === 'output' ? 'bg-rose-100 text-rose-700' : 'text-slate-400'}`}
                                      onClick={() => setFluidForm({...fluidForm, type: 'output'})}>OUTPUT</button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">ROUTE/SOURCE</label>
                          <select className="form-control text-sm" value={fluidForm.route} onChange={e => setFluidForm({...fluidForm, route: e.target.value})}>
                              {fluidForm.type === 'intake' ? (
                                  <>
                                      <option value="Oral">Oral (Water/Food)</option>
                                      <option value="IV">IV Infusion</option>
                                      <option value="NG Tube">Nasogastric Tube</option>
                                  </>
                              ) : (
                                  <>
                                      <option value="Urine">Urine</option>
                                      <option value="Drainage">Surgical Drainage</option>
                                      <option value="Vomitus">Vomitus</option>
                                      <option value="Stool">Liquid Stool</option>
                                  </>
                              )}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT (ML)</label>
                          <input type="number" className="form-control" value={fluidForm.amount} onChange={e => setFluidForm({...fluidForm, amount: e.target.value})} placeholder="e.g. 200" required />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">NOTES</label>
                          <textarea className="form-control text-xs" rows="2" value={fluidForm.notes} onChange={e => setFluidForm({...fluidForm, notes: e.target.value})} placeholder="Optional remarks..."></textarea>
                      </div>
                      <button type="submit" className="btn-primary w-full font-bold" disabled={saving}>
                          {saving ? 'Saving...' : 'Record Log'}
                      </button>
                  </form>
              </div>

              <div className="lg:col-span-2">
                  <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <div className="text-[10px] font-bold text-emerald-600 uppercase">Total Intake</div>
                          <div className="text-xl font-bold text-emerald-700">{fluidData.summary?.totalIntake} ml</div>
                      </div>
                      <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <div className="text-[10px] font-bold text-rose-600 uppercase">Total Output</div>
                          <div className="text-xl font-bold text-rose-700">{fluidData.summary?.totalOutput} ml</div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="text-[10px] font-bold text-blue-600 uppercase">Net Balance</div>
                          <div className={`text-xl font-bold ${fluidData.summary?.balance >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                              {fluidData.summary?.balance > 0 ? '+' : ''}{fluidData.summary?.balance} ml
                          </div>
                      </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mb-4">Fluid Log History</h3>
                  {fluidData.data?.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs italic">No fluid logs found</div>
                  ) : (
                      <div className="space-y-2">
                          {fluidData.data?.map(f => (
                              <div key={f.id} className={`flex items-center justify-between p-3 rounded-lg border ${f.type === 'intake' ? 'bg-white border-emerald-100' : 'bg-white border-rose-100'}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${f.type === 'intake' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                          {f.type === 'intake' ? 'IN' : 'OUT'}
                                      </div>
                                      <div>
                                          <div className="text-xs font-bold text-slate-800">{f.amount} ml via {f.route}</div>
                                          <div className="text-[10px] text-slate-500">{new Date(f.recordedAt).toLocaleString()}</div>
                                      </div>
                                  </div>
                                  <div className="text-[10px] text-slate-400 italic">By: {f.nurse?.name}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </Modal>
    </div>
  );
}
