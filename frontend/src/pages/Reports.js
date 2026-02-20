import React, { useState, useEffect } from 'react';
import { patientAPI, reportAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

export default function Reports() {
  const [patients, setPatients] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', type: 'lab_report', description: '', file: null });

  useEffect(() => { patientAPI.getAll().then((r) => setPatients(r.data)); }, []);

  const loadReports = (patientId) => {
    if (!patientId) { setReports([]); return; }
    setLoading(true);
    reportAPI.getByPatient(patientId).then((r) => setReports(r.data)).finally(() => setLoading(false));
  };

  const handlePatientChange = (id) => { setSelectedPatient(id); loadReports(id); };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return toast.error('Please select a patient first');
    if (!uploadForm.file) return toast.error('Please select a file');
    setUploading(true);
    try {
      const fd = new FormData();
      Object.entries(uploadForm).forEach(([k, v]) => { if (k !== 'file') fd.append(k, v); });
      fd.append('file', uploadForm.file);
      await reportAPI.upload(selectedPatient, fd);
      toast.success('Report uploaded successfully');
      setUploadModal(false);
      setUploadForm({ title: '', type: 'lab_report', description: '', file: null });
      loadReports(selectedPatient);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (report) => {
    try {
      const res = await reportAPI.download(report.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = report.originalName || report.fileName;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try { await reportAPI.delete(id); toast.success('Report deleted'); loadReports(selectedPatient); }
    catch { toast.error('Error'); }
  };

  const columns = [
    { key: 'title', label: 'Title', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.originalName}</div></div> },
    { key: 'type', label: 'Type', render: (v) => <Badge text={v.replace(/_/g, ' ')} type="default" /> },
    { key: 'fileSize', label: 'Size', render: (v) => v ? `${(v / 1024).toFixed(1)} KB` : '—' },
    { key: 'mimeType', label: 'Format', render: (v) => v?.split('/')[1]?.toUpperCase() || '—' },
    { key: 'uploadedBy', label: 'Uploaded By' },
    { key: 'createdAt', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => handleDownload(r)}>⬇ Download</button>
        <button className={styles.btnDelete} onClick={() => handleDelete(r.id)}>Delete</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Patient Reports</h2><p className={styles.pageSubtitle}>Upload and manage medical reports</p></div>
        <button className={styles.btnPrimary} onClick={() => setUploadModal(true)} disabled={!selectedPatient}>+ Upload Report</button>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} style={{ flex: 1 }} value={selectedPatient} onChange={(e) => handlePatientChange(e.target.value)}>
          <option value="">-- Select a Patient to view reports --</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>)}
        </select>
      </div>

      {!selectedPatient ? (
        <div className={styles.card} style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Select a patient to view their reports</div>
        </div>
      ) : (
        <div className={styles.card}><Table columns={columns} data={reports} loading={loading} emptyMessage="No reports for this patient" /></div>
      )}

      <Modal isOpen={uploadModal} onClose={() => setUploadModal(false)} title="Upload Medical Report">
        <form onSubmit={handleUpload} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div className={styles.field}><label className={styles.label}>Report Title *</label><input className={styles.input} value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} required placeholder="e.g. Blood Test Results" /></div>
            <div className={styles.field}><label className={styles.label}>Report Type</label>
              <select className={styles.input} value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}>
                {['lab_report', 'radiology', 'discharge_summary', 'prescription', 'medical_certificate', 'other'].map(t =>
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Description</label><textarea className={styles.input} rows={3} value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} placeholder="Optional notes about this report..." /></div>
            <div className={styles.field}>
              <label className={styles.label}>Select File *</label>
              <div style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: '20px', textAlign: 'center', background: '#f8fafc' }}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.csv"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  required style={{ fontSize: 14 }} />
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Supported: PDF, JPG, PNG, DOC, DOCX, XLSX, CSV (max 10MB)</div>
                {uploadForm.file && <div style={{ marginTop: 8, fontSize: 13, color: '#2563eb', fontWeight: 600 }}>Selected: {uploadForm.file.name}</div>}
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setUploadModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={uploading}>{uploading ? '⏳ Uploading...' : '⬆ Upload Report'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
