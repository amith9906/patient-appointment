import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const STATUS_COLORS = { scheduled: 'bg-blue-100 text-blue-700', confirmed: 'bg-green-100 text-green-700', in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-600', no_show: 'bg-orange-100 text-orange-600' };

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const load = () => {
    setLoading(true);
    const params = {};
    if (filter !== 'all') params.status = filter;
    if (dateFilter) params.date = dateFilter;
    api.get('/doctors/me/appointments', { params })
      .then(r => setAppointments(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter, dateFilter]);

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/appointments/${id}`, { status });
      load();
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">My Appointments</h2>

      <div className="flex flex-wrap gap-2 mb-5">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500" />
        {['all','scheduled','confirmed','in_progress','completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors
              ${filter === s ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {s === 'all' ? 'All' : s.replace('_',' ')}
          </button>
        ))}
        <button onClick={() => { setFilter('all'); setDateFilter(''); }} className="text-xs text-gray-400 px-2">Clear</button>
      </div>

      {loading ? (
        <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-gray-500">No appointments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="text-center bg-teal-50 rounded-xl p-3 min-w-[60px]">
                    <div className="text-xs text-teal-400">{new Date(a.appointmentDate).toLocaleDateString('en',{month:'short'})}</div>
                    <div className="text-xl font-bold text-teal-700">{new Date(a.appointmentDate).getDate()}</div>
                    <div className="text-xs font-bold text-teal-500">{a.appointmentTime?.slice(0,5)}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-lg">{a.patient?.name}</div>
                    <div className="text-sm text-gray-500">{a.patient?.patientId} · {a.type?.replace('_',' ')}</div>
                    {a.reason && <div className="text-sm text-gray-600 mt-1">📝 {a.reason}</div>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLORS[a.status] || ''}`}>{a.status?.replace('_',' ')}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2 pt-3 border-t border-gray-50">
                <Link to={`/doctor-portal/appointments/${a.id}`}
                  className="flex-1 text-center text-sm bg-teal-50 text-teal-700 hover:bg-teal-100 py-2 rounded-lg font-medium transition-colors">
                  {a.status === 'confirmed' ? 'Start Consultation' : a.status === 'in_progress' ? 'Continue Consultation' : 'View Details'}
                </Link>
                {a.status === 'scheduled' && <button onClick={() => handleStatus(a.id,'confirmed')} className="px-4 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium">Confirm</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
