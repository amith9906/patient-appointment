import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const STATUS_COLORS = { scheduled: 'bg-blue-100 text-blue-700', postponed: 'bg-orange-100 text-orange-700', confirmed: 'bg-green-100 text-green-700', in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-600' };

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      api.get('/doctors/me'),
      api.get('/doctors/me/appointments', { params: { date: today } }),
      api.get('/doctors/me/appointments'),
    ]).then(([d, todayA, allA]) => {
      setDoctor(d.data);
      setTodayAppts(todayA.data);
      setStats({
        total: allA.data.length,
        today: todayA.data.length,
        pending: allA.data.filter(a => ['scheduled', 'postponed'].includes(a.status)).length,
        completed: allA.data.filter(a => a.status === 'completed').length,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome, Dr. {user.name}! 👨‍⚕️</h1>
        {doctor && <p className="text-teal-200 mt-1">{doctor.specialization}  |  {doctor.hospital.name}</p>}
        <p className="text-teal-300 text-sm mt-1">{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Appointments', value: stats.total, icon: 'Calendar', color: 'text-blue-600 bg-blue-50' },
          { label: "Today's Schedule", value: stats.today, icon: '🗓️', color: 'text-teal-600 bg-teal-50' },
          { label: 'Pending', value: stats.pending, icon: 'Pending', color: 'text-orange-600 bg-orange-50' },
          { label: 'Completed', value: stats.completed, icon: 'Done', color: 'text-green-600 bg-green-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 ${s.color}`}>{s.icon}</div>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-800 text-lg">Today's Schedule</h2>
          <Link to="/doctor-portal/appointments" className="text-sm text-teal-600 font-medium">View all {'->'}</Link>
        </div>
        {todayAppts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">Sun</div>
            <p>No appointments today. Enjoy your day!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayAppts.map(a => (
              <Link key={a.id} to={`/doctor-portal/appointments/${a.id}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50 transition-colors group">
                <div className="text-center bg-teal-50 rounded-lg p-2 min-w-[52px] group-hover:bg-white transition-colors">
                  <div className="text-xs text-teal-500">TIME</div>
                  <div className="font-bold text-teal-700">{a.appointmentTime.slice(0,5)}</div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{a.patient.name}</div>
                  <div className="text-sm text-gray-500">{a.type.replace('_',' ')}  |  {a.reason.slice(0,60)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status.replace('_',' ')}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Doctor Info */}
      {doctor && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-4">My Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['License #', doctor.licenseNumber],
              ['Experience', `${doctor.experience} years`],
              ['Consultation Fee', `$${doctor.consultationFee}`],
              ['Department', doctor.department.name],
              ['Available', `${doctor.availableFrom.slice(0,5)} - ${doctor.availableTo.slice(0,5)}`],
              ['Phone', doctor.phone],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
                <div className="text-sm font-semibold text-gray-700 mt-1">{value || '-'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
