import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientAPI, reportAPI, appointmentAPI, pdfAPI } from '../services/api';
import Badge from '../components/Badge';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [reports, setReports] = useState([]);
  const [tab, setTab] = useState('info');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', type: 'lab_report', description: '', file: null });
  const [uploading, setUploading] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    patientAPI.getOne(id).then((r) => setPatient(r.data)).catch(() => navigate('/patients'));
    loadReports();
  }, [id]);

  const loadReports = () => reportAPI.getByPatient(id).then((r) => setReports(r.data));

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return toast.error('Please select a file');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('title', uploadForm.title);
      fd.append('type', uploadForm.type);
      fd.append('description', uploadForm.description);
      await reportAPI.upload(id, fd);
      toast.success('Report uploaded');
      setUploadModal(false);
      setUploadForm({ title: '', type: 'lab_report', description: '', file: null });
      loadReports();
    } catch (err) { toast.error('Upload failed'); }
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

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Delete this report')) return;
    try { await reportAPI.delete(reportId); toast.success('Report deleted'); loadReports(); }
    catch { toast.error('Error'); }
  };

  const handleViewAppointment = async (appointmentId) => {
    setDetailLoading(true);
    setDetailModal(true);
    try {
      const res = await appointmentAPI.getOne(appointmentId);
      setSelectedAppointment(res.data);
    } catch {
      toast.error('Unable to load consultation details');
      setDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadAppointment = async (appointment, type = 'prescription') => {
    try {
      const res = type === 'bill'
        ? await pdfAPI.bill(appointment.id)
        : await pdfAPI.prescription(appointment.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appointment.appointmentNumber || 'appointment'}-${type}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to download ${type} PDF`);
    }
  };

  if (!patient) return <div style={{ padding: 48, textAlign: 'center' }}>Loading...</div>;

  const reportCols = [
    { key: 'title', label: 'Title', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.originalName}</div></div> },
    { key: 'type', label: 'Type', render: (v) => <Badge text={v.replace('_', ' ')} type="default" /> },
    { key: 'fileSize', label: 'Size', render: (v) => v ? `${(v / 1024).toFixed(1)} KB` : '-'},
    { key: 'uploadedBy', label: 'Uploaded By' },
    { key: 'createdAt', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => handleDownload(r)}>Download</button>
        <button className={styles.btnDelete} onClick={() => handleDeleteReport(r.id)}>Delete</button>
      </div>
    )},
  ];

  const apptCols = [
    { key: 'appointmentNumber', label: 'Apt #' },
    { key: 'appointmentDate', label: 'Date' },
    { key: 'appointmentTime', label: 'Time', render: (v) => v.slice(0, 5) },
    { key: 'doctor', label: 'Doctor', render: (v) => v ? `Dr. ${v.name}` : '-'},
    { key: 'type', label: 'Type', render: (v) => <Badge text={v} type="default" /> },
    { key: 'status', label: 'Status', render: (v) => <Badge text={v} type={v} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => handleViewAppointment(r.id)}>View</button>
        <button className={styles.btnSecondary} title="Download Prescription PDF" onClick={() => handleDownloadAppointment(r, 'prescription')}>
          ⬇ Rx
        </button>
        <button className={styles.btnSecondary} title="Download Bill PDF" onClick={() => handleDownloadAppointment(r, 'bill')}>
          ⬇ Bill
        </button>
      </div>
    ) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className={styles.btnSecondary} onClick={() => navigate('/patients')}>← Back</button>
        <h2 className={styles.pageTitle}>{patient.name}</h2>
        <span style={{ fontFamily: 'monospace', background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{patient.patientId}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
        {['info', 'appointments', 'reports'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', border: 'none', borderBottom:tab === t ? '3px solid #2563eb' : '3px solid transparent', background: 'none', fontWeight: 600, fontSize: 14, color:tab === t ? '#2563eb' : '#64748b', cursor: 'pointer' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className={styles.card} style={{ padding: 24 }}>
          <div className={styles.infoGrid}>
            {[
              ['Date of Birth', patient.dateOfBirth],
              ['Gender', patient.gender],
              ['Blood Group', patient.bloodGroup],
              ['Phone', patient.phone],
              ['Email', patient.email],
              ['City', patient.city],
              ['State', patient.state],
              ['Emergency Contact', patient.emergencyContactName],
              ['Emergency Phone', patient.emergencyContactPhone],
              ['Insurance Provider', patient.insuranceProvider],
              ['Insurance Number', patient.insuranceNumber],
            ].map(([label, value]) => (
              <div key={label} className={styles.infoItem}>
                <div className={styles.infoLabel}>{label}</div>
                <div className={styles.infoValue}>{value || '-'}</div>
              </div>
            ))}
          </div>
          {patient.allergies && (
            <div style={{ marginTop: 20 }}>
              <div className={styles.infoLabel}>Allergies</div>
              <div style={{ background: '#fef9c3', padding: '10px 14px', borderRadius: 8, marginTop: 6, fontSize: 14 }}>{patient.allergies}</div>
            </div>
          )}
          {patient.medicalHistory && (
            <div style={{ marginTop: 16 }}>
              <div className={styles.infoLabel}>Medical History</div>
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, marginTop: 6, fontSize: 14 }}>{patient.medicalHistory}</div>
            </div>
          )}
          {Array.isArray(patient.chronicConditions) && patient.chronicConditions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className={styles.infoLabel}>Chronic Conditions</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {patient.chronicConditions.map((c) => (
                  <span key={c} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '3px 9px' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(patient.clinicalAlerts) && patient.clinicalAlerts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className={styles.infoLabel}>Clinical Alerts</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {patient.clinicalAlerts.map((a) => (
                  <span key={a} style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '3px 9px' }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'appointments' && (
        <div className={styles.card}><Table columns={apptCols} data={patient.appointments || []} loading={false} emptyMessage="No appointments found" /></div>
      )}

      {tab === 'reports' && (
        <div>
          <div className={styles.pageHeader}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Medical Reports ({reports.length})</h3>
            <button className={styles.btnPrimary} onClick={() => setUploadModal(true)}>+ Upload Report</button>
          </div>
          <div className={styles.card}><Table columns={reportCols} data={reports} loading={false} emptyMessage="No reports uploaded" /></div>
        </div>
      )}

      <Modal isOpen={uploadModal} onClose={() => setUploadModal(false)} title="Upload Patient Report">
        <form onSubmit={handleUpload} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className={styles.field}><label className={styles.label}>Title *</label><input className={styles.input} value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} required /></div>
            <div className={styles.field}><label className={styles.label}>Report Type</label>
              <select className={styles.input} value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}>
                {['lab_report', 'radiology', 'discharge_summary', 'prescription', 'medical_certificate', 'other'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Description</label><textarea className={styles.input} rows={2} value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} /></div>
            <div className={styles.field}>
              <label className={styles.label}>File * (PDF, JPG, PNG, DOC, max 10MB)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.csv" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })} required style={{ fontSize: 14 }} />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setUploadModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title="Appointment Consultation Details" size="lg">
        {detailLoading ? (
          <div style={{ padding: 16, textAlign: 'center' }}>Loading consultation details...</div>
        ) : !selectedAppointment ? (
          <div style={{ padding: 16, textAlign: 'center' }}>No details found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className={styles.infoGrid}>
              {[
                ['Appointment #', selectedAppointment.appointmentNumber],
                ['Date', selectedAppointment.appointmentDate],
                ['Time', selectedAppointment.appointmentTime.slice(0, 5)],
                ['Doctor', selectedAppointment.doctor ? `Dr. ${selectedAppointment.doctor.name}` : '-'],
                ['Type', selectedAppointment.type],
                ['Status', selectedAppointment.status],
                ['Treatment Bill', selectedAppointment.treatmentBill ? `$${selectedAppointment.treatmentBill}` : '-'],
              ].map(([label, value]) => (
                <div key={label} className={styles.infoItem}>
                  <div className={styles.infoLabel}>{label}</div>
                  <div className={styles.infoValue}>{value || '-'}</div>
                </div>
              ))}
            </div>

            <div>
              <div className={styles.infoLabel}>Treatment Done</div>
              <div style={{ background: '#fff7ed', padding: '10px 14px', borderRadius: 8, marginTop: 6, fontSize: 14 }}>
                {selectedAppointment.treatmentDone || '-'}
              </div>
            </div>

            <div>
              <div className={styles.infoLabel}>Consultation Notes</div>
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, marginTop: 6, fontSize: 14 }}>
                {selectedAppointment.notes || selectedAppointment.reason || '-'}
              </div>
            </div>

            <div>
              <div className={styles.infoLabel}>Prescriptions / Medications</div>
              {selectedAppointment.prescriptions.length ? (
                <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Medicine</th>
                        <th style={{ padding: '8px 10px' }}>Dosage</th>
                        <th style={{ padding: '8px 10px' }}>Frequency</th>
                        <th style={{ padding: '8px 10px' }}>Duration</th>
                        <th style={{ padding: '8px 10px' }}>Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAppointment.prescriptions.map((p) => (
                        <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px' }}>{p.medication.name || p.customMedicationName || '-'}</td>
                          <td style={{ padding: '8px 10px' }}>{p.dosage || '-'}</td>
                          <td style={{ padding: '8px 10px' }}>{p.frequency || '-'}</td>
                          <td style={{ padding: '8px 10px' }}>{p.duration || '-'}</td>
                          <td style={{ padding: '8px 10px' }}>{p.instructions || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#64748b', marginTop: 6 }}>No prescriptions for this appointment.</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
