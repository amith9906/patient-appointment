import React, { useState, useEffect } from 'react';
import api, { pdfAPI } from '../../services/api';
import { toast } from 'react-toastify';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const STATUS_FLOW = { ordered: 'sample_collected', sample_collected: 'processing', processing: 'completed' };
const STATUS_COLORS = { ordered: 'bg-blue-100 text-blue-700', sample_collected: 'bg-yellow-100 text-yellow-700', processing: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' };
const STATUS_LABELS = { ordered: 'Ordered', sample_collected: 'Sample Collected', processing: 'Processing', completed: 'Completed', cancelled: 'Cancelled' };
const NEXT_LABELS = { ordered: 'Mark Collected', sample_collected: 'Start Processing', processing: 'Enter Results' };

export default function LabDashboard() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ordered');
  const [resultModal, setResultModal] = useState(null);
  const [resultForm, setResultForm] = useState({ result: '', resultValue: '', isAbnormal: false, technicianNotes: '' });

  const load = () => {
    setLoading(true);
    const params = filter !== 'all' ? { status: filter } : {};
    api.get('/labs/tests', { params }).then(r => setTests(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const advance = async (test) => {
    const nextStatus = STATUS_FLOW[test.status];
    if (!nextStatus) return;
    if (nextStatus === 'completed') { setResultModal(test); setResultForm({ result: '', resultValue: '', isAbnormal: false, technicianNotes: '' }); return; }
    try {
      await api.put(`/labs/tests/${test.id}`, { status: nextStatus });
      toast.success(`Status updated to ${STATUS_LABELS[nextStatus]}`);
      load();
    } catch { toast.error('Update failed'); }
  };

  const submitResult = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/labs/tests/${resultModal.id}`, { ...resultForm, status: 'completed', completedDate: new Date() });
      toast.success('Results saved!');
      setResultModal(null);
      load();
    } catch { toast.error('Failed to save results'); }
  };

  const counts = tests.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  const downloadReport = async (test) => {
    try {
      const res = await pdfAPI.labReport(test.id);
      downloadBlob(res.data, `lab-report-${test.testNumber}.pdf`);
    } catch { toast.error('Failed to download report'); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Lab Test Queue</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[['ordered','Pending','bg-blue-50 text-blue-700'],['sample_collected','Collected','bg-yellow-50 text-yellow-700'],['processing','Processing','bg-orange-50 text-orange-700'],['completed','Completed','bg-green-50 text-green-700']].map(([s, label, cls]) => (
          <div key={s} className={`rounded-xl p-4 text-center cursor-pointer border-2 ${filter === s ? 'border-current' : 'border-transparent'} ${cls}`} onClick={() => setFilter(s)}>
            <div className="text-2xl font-bold">{counts[s] || 0}</div>
            <div className="text-xs font-medium mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all','ordered','sample_collected','processing','completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium ${filter === s ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600'}`}>
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div>
      ) : tests.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border"><div className="text-5xl mb-3">🔬</div><p className="text-gray-400">No tests in this queue</p></div>
      ) : (
        <div className="space-y-3">
          {tests.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-800">{t.testName} <span className="text-sm font-normal text-gray-500">({t.testCode})</span></div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {t.patient.name}  |  <span className="font-mono text-xs">{t.patient.patientId}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Lab: {t.lab.name}  |  #{t.testNumber}  |  ${t.price}  |  {t.category}
                  </div>
                  {t.normalRange && <div className="text-xs text-gray-400">Normal: {t.normalRange} {t.unit}</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLORS[t.status] || ''}`}>{STATUS_LABELS[t.status]}</span>
                  {t.isAbnormal && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Warning️ Abnormal</span>}
                </div>
              </div>
              {t.status !== 'completed' && t.status !== 'cancelled' && STATUS_FLOW[t.status] && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <button onClick={() => advance(t)}
                    className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-medium transition-colors">
                    {'->'} {NEXT_LABELS[t.status]}
                  </button>
                </div>
              )}
              {t.status === 'completed' && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-3">
                  {t.result && (
                    <div className="flex-1 bg-green-50 rounded-lg p-3 text-sm">
                      <span className="font-medium text-green-700">Result:</span> {t.resultValue} - {t.result.slice(0,100)}
                    </div>
                  )}
                  <button onClick={() => downloadReport(t)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
                    Doc Download Report
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Enter Results - {resultModal.testName}</h3>
              <button onClick={() => setResultModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitResult} className="p-5 space-y-4">
              {resultModal.normalRange && <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">Normal Range: <strong>{resultModal.normalRange} {resultModal.unit}</strong></div>}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Result Value</label>
                <input value={resultForm.resultValue} onChange={e => setResultForm(f => ({...f, resultValue: e.target.value}))} placeholder="e.g. 7.4, Positive, 120 mg/dL"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Full Result / Remarks</label>
                <textarea rows={3} value={resultForm.result} onChange={e => setResultForm(f => ({...f, result: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Abnormal Result</label>
                <select value={resultForm.isAbnormal ? 'true' : 'false'} onChange={e => setResultForm(f => ({...f, isAbnormal: e.target.value === 'true'}))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                  <option value="false">Normal</option><option value="true">Abnormal</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Technician Notes</label>
                <textarea rows={2} value={resultForm.technicianNotes} onChange={e => setResultForm(f => ({...f, technicianNotes: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setResultModal(null)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700">Save Results</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
