import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/patients/me'),
      api.get('/patients/me/appointments'),
      api.get('/patients/me/reports'),
    ]).then(([p, a, r]) => {
      setPatient(p.data);
      const upcoming = (a.data || [])
        .filter((x) => ['scheduled', 'postponed', 'confirmed'].includes(x.status))
        .sort((x, y) => new Date(`${x.appointmentDate}T${x.appointmentTime || '00:00:00'}`) - new Date(`${y.appointmentDate}T${y.appointmentTime || '00:00:00'}`));
      setAppointments(upcoming.slice(0, 3));
      setReports(r.data.slice(0, 3));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  const statusColor = { scheduled: 'bg-blue-100 text-blue-700', postponed: 'bg-orange-100 text-orange-700', confirmed: 'bg-green-100 text-green-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-700' };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Welcome back, {user.name}! Hi</h1>
        <p className="text-blue-200 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        {patient && (
          <div className="mt-4 flex gap-6 text-sm">
            <span>🩸 {patient.bloodGroup || 'Blood group not set'}</span>
            <span>ID {patient.patientId}</span>
            {patient.allergies && <span>Warning️ Allergies on file</span>}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { to: '/patient-portal/book', icon: 'Calendar', label: 'Book Appointment', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { to: '/patient-portal/appointments', icon: '🗓️', label: 'My Appointments', color: 'bg-green-50 border-green-200 text-green-700' },
          { to: '/patient-portal/reports', icon: 'Report', label: 'My Reports', color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { to: '/patient-portal/prescriptions', icon: 'Rx', label: 'Prescriptions', color: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map(item => (
          <Link key={item.to} to={item.to} className={`border rounded-xl p-4 text-center hover:shadow-md transition-shadow ${item.color}`}>
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="text-sm font-semibold">{item.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Upcoming Appointments</h2>
            <Link to="/patient-portal/appointments" className="text-xs text-blue-600 font-medium">View all {'->'}</Link>
          </div>
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">Calendar</div>
              <p className="text-sm">No upcoming appointments</p>
              <Link to="/patient-portal/book" className="mt-3 inline-block text-xs bg-blue-600 text-white px-4 py-2 rounded-lg">Book Now</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center bg-white rounded-lg p-2 border min-w-[48px]">
                    <div className="text-xs text-gray-500">{new Date(a.appointmentDate).toLocaleDateString('en-US',{month:'short'})}</div>
                    <div className="text-lg font-bold text-gray-800">{new Date(a.appointmentDate).getDate()}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Dr. {a.doctor.name}</div>
                    <div className="text-xs text-gray-500">{a.doctor.specialization}  |  {a.appointmentTime.slice(0,5)}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Recent Reports</h2>
            <Link to="/patient-portal/reports" className="text-xs text-blue-600 font-medium">View all {'->'}</Link>
          </div>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">Report</div>
              <p className="text-sm">No reports uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl">{r.mimeType.includes('pdf') ? 'Doc' : 'Image'}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm truncate">{r.title}</div>
                    <div className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}  |  {r.type.replace('_',' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Health Info */}
      {patient && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Health Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Blood Group', patient.bloodGroup || '-'],
              ['Date of Birth', patient.dateOfBirth || '-'],
              ['Gender', patient.gender || '-'],
              ['Hospital', patient.hospital.name || '-'],
            ].map(([label, value]) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="font-semibold text-gray-800 capitalize">{value}</div>
              </div>
            ))}
          </div>
          {patient.allergies && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <span className="text-yellow-700 text-sm">Warning️ <strong>Allergies:</strong> {patient.allergies}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
