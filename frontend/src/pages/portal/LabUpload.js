import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import SearchableSelect from '../../components/SearchableSelect';

export default function LabUpload() {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ patientId: '', title: '', type: 'lab_report', description: '', file: null });
  const [uploading, setUploading] = useState(false);

  useEffect(() => { api.get('/patients').then(r => setPatients(r.data)).catch(() => {}); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.file) return toast.error('Please select a file');
    if (!form.patientId) return toast.error('Please select a patient');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('title', form.title);
      fd.append('type', form.type);
      fd.append('description', form.description);
      await api.post(`/reports/patient/${form.patientId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Report uploaded successfully!');
      setForm({ patientId: '', title: '', type: 'lab_report', description: '', file: null });
      document.getElementById('fileInput').value = '';
    } catch (err) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Upload Lab Report</h2>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleUpload} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Patient *</label>
            <SearchableSelect
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              value={form.patientId}
              onChange={(value) => setForm((f) => ({ ...f, patientId: value }))}
              options={patients.map((p) => ({ value: p.id, label: `${p.name} (${p.patientId})` }))}
              placeholder="Search patient..."
              emptyLabel="Select Patient"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Report Title *</label>
            <input required value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="e.g. Blood CBC Report" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Report Type</label>
            <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              {['lab_report','radiology','discharge_summary','medical_certificate','other'].map(t =>
                <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              placeholder="Optional notes..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">File *</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
              <div className="text-3xl mb-2">📁</div>
              <input id="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.csv"
                onChange={e => setForm(f => ({...f, file: e.target.files[0]}))} required className="text-sm" />
              <p className="text-xs text-gray-400 mt-2">PDF, JPG, PNG, DOC, XLSX  |  Max 10MB</p>
              {form.file && <p className="text-xs text-blue-600 mt-2 font-medium">{form.file.name}</p>}
            </div>
          </div>
          <button type="submit" disabled={uploading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {uploading ? 'Pending Uploading...' : '⬆️ Upload Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
