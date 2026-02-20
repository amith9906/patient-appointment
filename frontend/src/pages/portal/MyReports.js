import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const TYPE_ICONS = { lab_report: '🧪', radiology: '🔬', discharge_summary: '📄', prescription: '💊', medical_certificate: '📜', other: '📋' };

export default function MyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/patients/me/reports').then(r => setReports(r.data)).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (report) => {
    try {
      const res = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = report.originalName || report.fileName;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const filtered = filter ? reports.filter(r => r.type === filter) : reports;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">My Medical Reports</h2>

      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium ${!filter ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
          All
        </button>
        {['lab_report','radiology','discharge_summary','prescription','medical_certificate','other'].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filter === t ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
            {TYPE_ICONS[t]} {t.replace(/_/g,' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-500">No reports found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="text-4xl">{TYPE_ICONS[r.type] || '📋'}</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{r.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">{r.type?.replace(/_/g,' ')} · {new Date(r.createdAt).toLocaleDateString()}</div>
                {r.description && <div className="text-xs text-gray-400 mt-1">{r.description}</div>}
                <div className="text-xs text-gray-400 mt-1">{r.mimeType?.split('/')[1]?.toUpperCase()} · {r.fileSize ? `${(r.fileSize/1024).toFixed(1)} KB` : ''}</div>
              </div>
              <button onClick={() => handleDownload(r)}
                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                ⬇ Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
