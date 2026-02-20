import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-orange-100 text-orange-600',
};

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    const params = filter !== 'all' ? { status: filter } : {};
    api.get('/patients/me/appointments', { params })
      .then(r => setAppointments(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    try {
      await api.put(`/appointments/${id}/cancel`, { reason: 'Cancelled by patient' });
      toast.success('Appointment cancelled');
      load();
    } catch { toast.error('Could not cancel'); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">My Appointments</h2>
        <Link to="/patient-portal/book" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Book New</Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['all','scheduled','confirmed','completed','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors
              ${filter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-gray-500">No appointments found</p>
          <Link to="/patient-portal/book" className="mt-4 inline-block text-sm bg-blue-600 text-white px-6 py-2 rounded-lg">Book Appointment</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="text-center bg-blue-50 rounded-xl p-3 min-w-[60px]">
                    <div className="text-xs text-blue-400 font-medium">{new Date(a.appointmentDate).toLocaleDateString('en',{month:'short'})}</div>
                    <div className="text-2xl font-bold text-blue-700">{new Date(a.appointmentDate).getDate()}</div>
                    <div className="text-xs text-blue-400">{new Date(a.appointmentDate).toLocaleDateString('en',{year:'numeric'})}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">Dr. {a.doctor?.name}</div>
                    <div className="text-sm text-blue-600">{a.doctor?.specialization}</div>
                    <div className="text-sm text-gray-500 mt-1">⏰ {a.appointmentTime?.slice(0,5)} · {a.type?.replace('_',' ')}</div>
                    <div className="text-xs text-gray-400 mt-1">#{a.appointmentNumber}</div>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>
                  {a.status?.replace('_',' ')}
                </span>
              </div>
              {a.reason && <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">📝 {a.reason}</div>}
              {a.diagnosis && <div className="mt-2 text-sm bg-green-50 rounded-lg px-3 py-2 text-green-800">🩺 <strong>Diagnosis:</strong> {a.diagnosis}</div>}
              {['scheduled','confirmed'].includes(a.status) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <button onClick={() => handleCancel(a.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">Cancel Appointment</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
