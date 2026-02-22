import React, { useState, useEffect, useCallback } from 'react';
import api, { pdfAPI, reportAPI, labReportTemplateAPI } from '../../services/api';
import { toast } from 'react-toastify';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const STATUS_FLOW = {
  ordered: 'sample_collected',
  sample_collected: 'processing',
  processing: 'completed',
};
const STATUS_COLORS = {
  ordered:          'bg-blue-100 text-blue-700',
  sample_collected: 'bg-yellow-100 text-yellow-700',
  processing:       'bg-orange-100 text-orange-700',
  completed:        'bg-green-100 text-green-700',
  cancelled:        'bg-red-100 text-red-600',
};
const STATUS_LABELS = {
  ordered:          'Ordered',
  sample_collected: 'Sample Collected',
  processing:       'Processing',
  completed:        'Completed',
  cancelled:        'Cancelled',
};
const NEXT_LABELS = {
  ordered:          'Mark Sample Collected',
  sample_collected: 'Start Processing',
  processing:       'Enter Results & Publish',
};

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Auto-flag if value is outside normal range
const isOutOfRange = (value, field) => {
  if (field.type !== 'number') return false;
  const v = parseFloat(value);
  if (isNaN(v)) return false;
  if (field.normalMin !== '' && field.normalMin !== undefined && v < Number(field.normalMin)) return true;
  if (field.normalMax !== '' && field.normalMax !== undefined && v > Number(field.normalMax)) return true;
  return false;
};

export default function LabDashboard() {
  const [tests, setTests]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [resultModal, setResultModal] = useState(null);

  // Freetext form
  const [resultForm, setResultForm] = useState({ result: '', resultValue: '', isAbnormal: false, technicianNotes: '', reportFile: null });

  // Template form
  const [templates, setTemplates]               = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateValues, setTemplateValues]     = useState({});
  const [abnormalFields, setAbnormalFields]     = useState([]);
  const [lockedToTemplate, setLockedToTemplate] = useState(false); // true when doctor pre-ordered a template

  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = filter !== 'all' ? { status: filter } : {};
    api.get('/labs/tests', { params }).then(r => setTests(r.data || [])).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Load templates once
  useEffect(() => {
    labReportTemplateAPI.getAll().then(r => setTemplates(r.data || [])).catch(() => {});
  }, []);

  const openResultModal = (test) => {
    setResultModal(test);
    setResultForm({ result: '', resultValue: '', isAbnormal: false, technicianNotes: test.technicianNotes || '', reportFile: null });

    const preId = test.templateId || '';
    // If doctor pre-assigned a template use that; otherwise auto-select first available template
    const autoId = preId || (templates.length > 0 ? templates[0].id : '');
    setSelectedTemplateId(autoId);
    setTemplateValues(test.templateValues || {});
    setAbnormalFields(test.abnormalFields || []);
    setLockedToTemplate(!!preId);
  };

  // When templates finish loading and modal is already open with no template selected, auto-select first
  useEffect(() => {
    if (resultModal && !lockedToTemplate && !selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = async (test) => {
    const nextStatus = STATUS_FLOW[test.status];
    if (!nextStatus) return;
    if (nextStatus === 'completed') { openResultModal(test); return; }
    try {
      await api.put(`/labs/tests/${test.id}`, { status: nextStatus });
      toast.success(`Status updated to ${STATUS_LABELS[nextStatus]}`);
      load();
    } catch { toast.error('Update failed'); }
  };

  const handleTemplateValueChange = (field, value) => {
    setTemplateValues(prev => ({ ...prev, [field.key]: value }));
    if (isOutOfRange(value, field)) {
      setAbnormalFields(prev => prev.includes(field.key) ? prev : [...prev, field.key]);
    } else {
      setAbnormalFields(prev => prev.filter(k => k !== field.key));
    }
  };

  const toggleAbnormal = (key) => {
    setAbnormalFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  const submitResult = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Upload file if attached
      if (resultForm.reportFile && resultModal.patient?.id) {
        const fd = new FormData();
        fd.append('file', resultForm.reportFile);
        fd.append('title', `${resultModal.testName} — Lab Report`);
        fd.append('type', 'lab_report');
        fd.append('labTestId', resultModal.id);
        if (resultModal.appointment?.id) fd.append('appointmentId', resultModal.appointment.id);
        await reportAPI.upload(resultModal.patient.id, fd);
      }

      // 2. Build payload
      const payload = {
        status: 'completed',
        completedDate: new Date(),
        technicianNotes: resultForm.technicianNotes,
      };

      if (selectedTemplate) {
        payload.templateId     = selectedTemplate.id;
        payload.templateValues = templateValues;
        payload.abnormalFields = abnormalFields;
        payload.isAbnormal     = abnormalFields.length > 0;
        // Plain-text summary for legacy field
        const summary = (selectedTemplate.fields || [])
          .map(f => `${f.label}: ${templateValues[f.key] || '—'}${f.unit ? ' ' + f.unit : ''}`)
          .join(' | ');
        payload.result = summary;
      } else {
        payload.result      = resultForm.result;
        payload.resultValue = resultForm.resultValue;
        payload.isAbnormal  = resultForm.isAbnormal;
      }

      await api.put(`/labs/tests/${resultModal.id}`, payload);
      toast.success('Results published to doctor successfully!');
      setResultModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to publish results');
    } finally {
      setSubmitting(false);
    }
  };

  const counts = tests.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const downloadReport = async (test) => {
    try {
      const res = await pdfAPI.labReport(test.id);
      downloadBlob(res.data, `lab-report-${test.testNumber}.pdf`);
    } catch { toast.error('Failed to download report'); }
  };

  const viewUploadedReport = async (report) => {
    try {
      const res = await reportAPI.download(report.id);
      const blob = new Blob([res.data], { type: report.mimeType || 'application/octet-stream' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { toast.error('Failed to open file'); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Lab Test Queue</h2>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-5 flex-wrap">
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Step 1</span> Mark Sample Collected
        <span className="text-gray-300 mx-1">→</span>
        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">Step 2</span> Start Processing
        <span className="text-gray-300 mx-1">→</span>
        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Step 3</span> Enter Results &amp; Publish to Doctor
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          ['ordered', 'Pending', 'bg-blue-50 text-blue-700'],
          ['sample_collected', 'Collected', 'bg-yellow-50 text-yellow-700'],
          ['processing', 'Processing', 'bg-orange-50 text-orange-700'],
          ['completed', 'Published', 'bg-green-50 text-green-700'],
        ].map(([s, label, cls]) => (
          <div key={s}
            className={`rounded-xl p-4 text-center cursor-pointer border-2 ${filter === s ? 'border-current' : 'border-transparent'} ${cls}`}
            onClick={() => setFilter(s)}>
            <div className="text-2xl font-bold">{counts[s] || 0}</div>
            <div className="text-xs font-medium mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'ordered', 'sample_collected', 'processing', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${filter === s ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600'}`}>
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border">
          <div className="text-5xl mb-3">🔬</div>
          <p className="text-gray-400">No tests in this queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{t.testName}</span>
                    {t.testCode && <span className="text-sm font-normal text-gray-400">({t.testCode})</span>}
                    {t.isAbnormal && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">⚠ Abnormal</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    Patient: <strong>{t.patient?.name}</strong> &nbsp;|&nbsp;
                    <span className="font-mono text-xs">{t.patient?.patientId}</span>
                    {t.appointment?.appointmentNumber && (
                      <span className="ml-2 text-xs text-gray-400">Appt: {t.appointment.appointmentNumber}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Lab: {t.lab?.name}</span>
                    {t.testNumber && <span>#{t.testNumber}</span>}
                    {t.price > 0 && <span>₹{t.price}</span>}
                    {t.category && <span>{t.category}</span>}
                    {t.template && (
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        🧪 Template: {t.template.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLORS[t.status] || ''}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                  {t.status === 'completed' && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ Published
                    </span>
                  )}
                </div>
              </div>

              {/* Step progress */}
              {t.status !== 'cancelled' && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1 mb-3">
                    {[
                      { s: 'ordered', label: '1. Ordered' },
                      { s: 'sample_collected', label: '2. Sample Collected' },
                      { s: 'processing', label: '3. Processing' },
                      { s: 'completed', label: '4. Published ✓' },
                    ].map(({ s, label }, i) => {
                      const statOrder = ['ordered', 'sample_collected', 'processing', 'completed'];
                      const currentIdx = statOrder.indexOf(t.status);
                      const stepIdx = statOrder.indexOf(s);
                      const done = stepIdx < currentIdx;
                      const active = stepIdx === currentIdx;
                      return (
                        <React.Fragment key={s}>
                          {i > 0 && <div className={`flex-1 h-0.5 ${done || active ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
                          <div className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            done    ? 'bg-green-100 text-green-700' :
                            active  ? 'bg-indigo-600 text-white' :
                                      'bg-gray-100 text-gray-400'
                          }`}>{label}</div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {t.status !== 'completed' && STATUS_FLOW[t.status] && (
                    <button onClick={() => advance(t)}
                      className={`text-sm px-5 py-2 rounded-lg hover:opacity-90 font-semibold transition-colors ${
                        STATUS_FLOW[t.status] === 'completed'
                          ? 'bg-green-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}>
                      → {NEXT_LABELS[t.status]}
                    </button>
                  )}
                </div>
              )}

              {/* Completed: show results */}
              {t.status === 'completed' && (
                <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
                  {/* Completion date */}
                  {t.completedDate && (
                    <div className="text-xs text-green-600 font-medium">
                      ✓ Results published on {fmtDate(t.completedDate)}
                    </div>
                  )}

                  {/* Template result grid */}
                  {t.template && t.templateValues && (
                    <div className="bg-indigo-50 rounded-xl p-3 text-xs">
                      <div className="font-semibold text-indigo-800 mb-2">{t.template.name}</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                        {(t.template.fields || []).map(f => {
                          const val = t.templateValues[f.key];
                          const isAbn = (t.abnormalFields || []).includes(f.key);
                          return (
                            <div key={f.key} className={`rounded-lg px-2 py-1 ${isAbn ? 'bg-red-100 text-red-800' : 'bg-white text-gray-700'}`}>
                              <span className="text-gray-500">{f.label}: </span>
                              <strong>{val || '—'}</strong>
                              {f.unit && <span className="text-gray-400 ml-0.5">{f.unit}</span>}
                              {isAbn && <span className="ml-1">⚠</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Freetext result */}
                  {!t.template && (t.resultValue || t.result) && (
                    <div className="bg-green-50 rounded-lg p-3 text-sm">
                      <span className="font-medium text-green-700">Result: </span>
                      {t.resultValue && <strong className="mr-1">{t.resultValue}</strong>}
                      {t.result && t.result !== t.resultValue && <span>{t.result.slice(0, 200)}</span>}
                    </div>
                  )}
                  {!t.template && !t.templateValues && !t.resultValue && !t.result && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
                      ⚠ No result values entered — click "Re-enter / Update Results" to add template data
                    </div>
                  )}

                  {/* Technician notes */}
                  {t.technicianNotes && (
                    <div className="text-xs text-gray-500 italic">
                      Tech notes: {t.technicianNotes}
                    </div>
                  )}

                  {/* Uploaded file */}
                  {t.report && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 font-medium">
                        📎 {t.report.originalName}
                      </span>
                      <button onClick={() => viewUploadedReport(t.report)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                        🔍 View
                      </button>
                    </div>
                  )}

                  {/* Action buttons row */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => downloadReport(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
                      📄 Download PDF
                    </button>
                    <button onClick={() => openResultModal(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors">
                      ✏️ Re-enter / Update Results
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Result Entry & Publish Modal ===== */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="p-5 border-b flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    {resultModal.testName}
                    {resultModal.isAbnormal && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠ Abnormal</span>}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Patient: <strong className="text-gray-700">{resultModal.patient?.name}</strong>
                    &nbsp;·&nbsp; {resultModal.patient?.patientId}
                    {resultModal.appointment?.appointmentNumber && (
                      <span>&nbsp;·&nbsp; Appt #{resultModal.appointment.appointmentNumber}</span>
                    )}
                  </p>
                  {lockedToTemplate && selectedTemplate ? (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg text-xs font-semibold">
                      🧪 Template assigned by doctor: {selectedTemplate.name}
                    </div>
                  ) : null}
                </div>
                <button onClick={() => setResultModal(null)} className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
              </div>
            </div>

            <form onSubmit={submitResult} className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* ── Template selector ── */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  🧪 Report Template <span className="text-gray-400 font-normal">(select to fill structured report)</span>
                </label>
                {lockedToTemplate ? (
                  /* Template was pre-assigned by the doctor — show locked indicator */
                  selectedTemplate ? (
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-indigo-800">{selectedTemplate.name}</span>
                      <span className="text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">{selectedTemplate.category}</span>
                      <span className="text-xs text-indigo-400 ml-auto">Assigned by doctor</span>
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="flex items-center gap-2 py-3 text-indigo-500 text-sm">
                      <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                      Loading template...
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5 text-sm text-yellow-800">
                      ⚠ Assigned template not found — please select one below
                    </div>
                  )
                ) : (
                  /* No pre-assigned template — let tech choose */
                  <select
                    value={selectedTemplateId}
                    onChange={e => {
                      setSelectedTemplateId(e.target.value);
                      setTemplateValues({});
                      setAbnormalFields([]);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                    <option value="">— No template (enter result manually) —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Normal range hint (only when no template selected) */}
              {resultModal.normalRange && !selectedTemplate && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                  Reference Range: <strong>{resultModal.normalRange} {resultModal.unit}</strong>
                </div>
              )}

              {/* ── Template fields ── */}
              {selectedTemplate ? (
                <div className="border border-indigo-100 rounded-xl overflow-hidden">
                  <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white text-sm">{selectedTemplate.name}</span>
                      <span className="text-indigo-200 text-xs ml-2">— {selectedTemplate.category}</span>
                    </div>
                    <span className="text-xs text-indigo-200">{selectedTemplate.fields?.length} parameters</span>
                  </div>

                  {/* Column header */}
                  <div className="grid bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: '1fr 140px 60px 80px' }}>
                    {['Parameter & Normal Range', 'Value', 'Unit', 'Flag'].map(h => (
                      <div key={h} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
                    ))}
                  </div>

                  <div className="divide-y divide-gray-50">
                    {(selectedTemplate.fields || []).map((field, fi) => {
                      const val = templateValues[field.key] || '';
                      const isAbn = abnormalFields.includes(field.key);
                      return (
                        <div key={field.key}
                          className={`grid items-center ${isAbn ? 'bg-red-50' : fi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                          style={{ gridTemplateColumns: '1fr 140px 60px 80px' }}>
                          {/* Label */}
                          <div className="px-3 py-2.5">
                            <div className="text-sm font-medium text-gray-800">{field.label}</div>
                            {(field.normalRange || (field.normalMin !== undefined && field.normalMax !== undefined)) && (
                              <div className="text-xs text-gray-400">
                                Ref: {field.normalRange || `${field.normalMin}–${field.normalMax}`}
                                {field.unit ? ` ${field.unit}` : ''}
                              </div>
                            )}
                          </div>
                          {/* Input */}
                          <div className="px-2 py-1.5">
                            {field.type === 'select' ? (
                              <select
                                value={val}
                                onChange={e => handleTemplateValueChange(field, e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none ${isAbn ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-indigo-400'}`}>
                                <option value="">— Select —</option>
                                {(field.options || '').split(',').filter(Boolean).map(opt => (
                                  <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type === 'number' ? 'number' : 'text'}
                                step="any"
                                value={val}
                                onChange={e => handleTemplateValueChange(field, e.target.value)}
                                placeholder="Enter value"
                                className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none ${isAbn ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-indigo-400'}`}
                              />
                            )}
                          </div>
                          {/* Unit */}
                          <div className="px-2 text-xs text-gray-400 text-center">{field.unit || ''}</div>
                          {/* Abnormal toggle */}
                          <div className="px-2 flex justify-center">
                            <button type="button"
                              onClick={() => toggleAbnormal(field.key)}
                              className={`text-xs px-2 py-1 rounded-lg font-semibold min-w-[52px] ${isAbn ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                              title={isAbn ? 'Mark normal' : 'Mark abnormal'}>
                              {isAbn ? '⚠ Abn' : 'Nml'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {abnormalFields.length > 0 && (
                    <div className="bg-red-50 px-4 py-2 text-xs text-red-700 font-semibold border-t border-red-100">
                      ⚠ {abnormalFields.length} abnormal field{abnormalFields.length > 1 ? 's' : ''} flagged
                    </div>
                  )}
                </div>
              ) : (
                /* ── Free text form ── */
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Result Value</label>
                    <input value={resultForm.resultValue}
                      onChange={e => setResultForm(f => ({ ...f, resultValue: e.target.value }))}
                      placeholder="e.g. 7.4, Positive, 120 mg/dL"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Full Result / Remarks</label>
                    <textarea rows={3} value={resultForm.result}
                      onChange={e => setResultForm(f => ({ ...f, result: e.target.value }))}
                      placeholder="Detailed findings, interpretation..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Result Status</label>
                    <select value={resultForm.isAbnormal ? 'true' : 'false'}
                      onChange={e => setResultForm(f => ({ ...f, isAbnormal: e.target.value === 'true' }))}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                      <option value="false">Normal</option>
                      <option value="true">Abnormal ⚠</option>
                    </select>
                  </div>
                </>
              )}

              {/* Technician notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Technician Notes <span className="text-gray-400 font-normal">(internal — not shown to patient)</span>
                </label>
                <textarea rows={2} value={resultForm.technicianNotes}
                  onChange={e => setResultForm(f => ({ ...f, technicianNotes: e.target.value }))}
                  placeholder="Sample quality, instrument used, repeat required..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>

              {/* File upload */}
              <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/30">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Attach Report File <span className="text-gray-400 font-normal">(optional — PDF or image)</span>
                </label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setResultForm(f => ({ ...f, reportFile: e.target.files[0] || null }))}
                  className="w-full text-sm text-gray-600" />
                <p className="text-xs text-gray-400 mt-1.5">
                  File will be saved to the patient record and visible to the doctor online.
                </p>
                {resultForm.reportFile && (
                  <div className="mt-2 text-xs text-indigo-700 font-medium">
                    ✓ {resultForm.reportFile.name} ({(resultForm.reportFile.size / 1024).toFixed(0)} KB)
                  </div>
                )}
              </div>

              {/* Publish button */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-xs text-green-700 mb-2">
                  <strong>Publishing will:</strong> mark test as Completed and make results immediately visible to the ordering doctor in the appointment.
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setResultModal(null)}
                    className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {submitting ? 'Publishing...' : '✓ Publish Results to Doctor'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
