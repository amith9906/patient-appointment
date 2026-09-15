import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DicomViewer from '../components/DicomViewer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export default function PatientPortalDashboard() {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [reports, setReports] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, appointments, prescriptions, reports, invoices
  const [activeDicomReport, setActiveDicomReport] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem('patientToken');

  useEffect(() => {
    if (!token) {
      navigate('/patient-portal/login');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_BASE}/patient-portal/me`, { headers }),
      axios.get(`${API_BASE}/patient-portal/appointments`, { headers }),
      axios.get(`${API_BASE}/patient-portal/prescriptions`, { headers }),
      axios.get(`${API_BASE}/patient-portal/reports`, { headers }),
      axios.get(`${API_BASE}/patient-portal/invoices`, { headers }),
    ])
      .then(([meRes, apptRes, rxRes, reportRes, invRes]) => {
        setProfile(meRes.data);
        setAppointments(apptRes.data);
        setPrescriptions(rxRes.data);
        setReports(reportRes.data);
        setInvoices(invRes.data);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('patientToken');
          localStorage.removeItem('patientUser');
          navigate('/patient-portal/login');
        } else {
          setError('Failed to load patient records.');
        }
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('patientToken');
    localStorage.removeItem('patientUser');
    navigate('/patient-portal/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Patient Portal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🩺</span>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Patient Portal</h1>
              <p className="text-xs text-slate-500">{profile?.hospital?.name || 'Hospital Self-Service'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800">{profile?.name}</div>
              <div className="text-xs text-slate-500">ID: {profile?.patientId}</div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto">
          {[
            ['overview', 'Overview'],
            ['appointments', `Appointments (${appointments.length})`],
            ['prescriptions', `Prescriptions (${prescriptions.length})`],
            ['reports', `Lab Reports (${reports.length})`],
            ['invoices', `Invoices (${invoices.length})`],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition whitespace-nowrap ${
                activeTab === tabKey
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold uppercase">Total Appointments</div>
                <div className="text-3xl font-extrabold text-blue-600 mt-1">{appointments.length}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold uppercase">Active Prescriptions</div>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">{prescriptions.length}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold uppercase">Lab & Imaging Reports</div>
                <div className="text-3xl font-extrabold text-purple-600 mt-1">{reports.length}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-semibold uppercase">Billing Invoices</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">{invoices.length}</div>
              </div>
            </div>

            {/* Profile & Recent Appointments */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Patient Profile</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-slate-400">Name:</span> <strong className="text-slate-800">{profile?.name}</strong></div>
                  <div><span className="text-slate-400">Patient ID:</span> <strong className="text-slate-800">{profile?.patientId}</strong></div>
                  <div><span className="text-slate-400">Phone:</span> <span className="text-slate-800">{profile?.phone}</span></div>
                  <div><span className="text-slate-400">Email:</span> <span className="text-slate-800">{profile?.email || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Gender:</span> <span className="text-slate-800 capitalize">{profile?.gender}</span></div>
                  <div><span className="text-slate-400">Hospital:</span> <span className="text-slate-800">{profile?.hospital?.name}</span></div>
                </div>
              </div>

              <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Recent Appointments</h3>
                {appointments.length ? (
                  <div className="divide-y divide-slate-100">
                    {appointments.slice(0, 4).map((a) => (
                      <div key={a.id} className="py-3 flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">Appt #{a.appointmentNumber}</div>
                          <div className="text-xs text-slate-500">{a.appointmentDate} at {a.appointmentTime}</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          a.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          a.status === 'pending_confirmation' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No appointments found.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Appointment History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                    <th className="p-3">Appt #</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td className="p-3 font-semibold text-slate-800">{a.appointmentNumber}</td>
                      <td className="p-3 text-slate-600">{a.appointmentDate} {a.appointmentTime}</td>
                      <td className="p-3 text-slate-600 capitalize">{a.type}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          a.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>{a.status}</span>
                      </td>
                      <td className="p-3 text-slate-500">{a.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PRESCRIPTIONS */}
        {activeTab === 'prescriptions' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Prescriptions</h2>
            <div className="divide-y divide-slate-100">
              {prescriptions.map((p) => (
                <div key={p.id} className="py-4">
                  <div className="font-bold text-slate-800 text-base">{p.medication?.catalog?.name || 'Medication'}</div>
                  <div className="text-xs text-slate-500 mb-2">
                    Generic: {p.medication?.catalog?.genericName || 'N/A'} | Composition: {p.medication?.catalog?.composition || 'N/A'}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div><strong>Dosage:</strong> {p.dosage || 'As advised'}</div>
                    <div><strong>Frequency:</strong> {p.frequency || '1-0-1'}</div>
                    <div><strong>Duration:</strong> {p.duration || '5 days'}</div>
                    <div><strong>Instructions:</strong> {p.instructions || 'After food'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS */}
        {activeTab === 'reports' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Lab & Medical Reports</h2>
            <div className="divide-y divide-slate-100">
              {reports.map((r) => {
                const isDicom = r.mimeType === 'application/dicom' || (r.originalName && r.originalName.toLowerCase().endsWith('.dcm')) || (r.fileName && r.fileName.toLowerCase().endsWith('.dcm'));
                return (
                  <div key={r.id} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{r.title}</div>
                      <div className="text-xs text-slate-500">Type: {r.type} | Date: {new Date(r.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2">
                      {isDicom && (
                        <button
                          onClick={() => setActiveDicomReport(r)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition"
                        >
                          👁️ View DICOM Scan
                        </button>
                      )}
                      <a
                        href={`${API_BASE}/patient-portal/reports/${r.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                      >
                        Download File
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeDicomReport && (
          <DicomViewer
            fileUrl={`${API_BASE}/patient-portal/reports/${activeDicomReport.id}/view`}
            token={token}
            title={activeDicomReport.title || activeDicomReport.originalName}
            onClose={() => setActiveDicomReport(null)}
          />
        )}

        {/* TAB 5: INVOICES */}
        {activeTab === 'invoices' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Billing History</h2>
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">Invoice #{inv.invoiceNumber}</div>
                    <div className="text-xs text-slate-500">Date: {inv.invoiceDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-slate-900 text-sm">Rs {Number(inv.totalAmount || 0).toFixed(2)}</div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      inv.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.isPaid ? 'PAID' : 'PENDING'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
