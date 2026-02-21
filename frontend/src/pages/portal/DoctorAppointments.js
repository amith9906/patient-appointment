import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doctorAPI, appointmentAPI } from '../../services/api';
import CalendarView from '../../components/CalendarView';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const STATUS_COLORS = {
  scheduled:   'bg-blue-100 text-blue-700',
  postponed:   'bg-orange-100 text-orange-700',
  confirmed:   'bg-green-100 text-green-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
  no_show:     'bg-orange-100 text-orange-600',
};
const STATUS_LABEL = {
  scheduled: 'Scheduled',
  postponed: 'Postponed',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Skipped',
};

export default function DoctorAppointments() {
  const navigate = useNavigate();

  // List view state
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState('list');

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('week');
  const [calendarAppointments, setCalendarAppointments] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Load list appointments
  const load = () => {
    setLoading(true);
    const params = {};
    if (filter !== 'all') params.status = filter;
    if (dateFilter) params.date = dateFilter;
    doctorAPI.getMyAppointments(params)
      .then(r => setAppointments(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter, dateFilter]);

  // Load calendar appointments when in calendar mode or week changes
  useEffect(() => {
    if (viewMode !== 'calendar') return;
    setCalendarLoading(true);
    const from = format(startOfWeek(calendarDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const to   = format(endOfWeek(calendarDate,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
    doctorAPI.getMyAppointments({ from, to })
      .then(r => setCalendarAppointments(r.data))
      .catch(() => setCalendarAppointments([]))
      .finally(() => setCalendarLoading(false));
  }, [viewMode, calendarDate]);

  const handleStatus = async (id, status) => {
    try {
      await appointmentAPI.update(id, { status });
      load();
    } catch {}
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">My Appointments</h2>

        {/* List / Calendar toggle */}
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
          {[['list', 'List List'], ['calendar', 'Calendar Calendar']].map(([v, label]) => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{
                padding: '6px 16px', fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background:viewMode === v ? '#0d9488' : '#fff',
                color:viewMode === v ? '#fff' : '#4b5563',
                transition: 'background 0.15s',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500" />
            {['all','scheduled','postponed','confirmed','in_progress','completed'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors
                  ${filter === s ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {s === 'all' ? 'All' : (STATUS_LABEL[s] || s)}
              </button>
            ))}
            <button onClick={() => { setFilter('all'); setDateFilter(''); }} className="text-xs text-gray-400 px-2">Clear</button>
          </div>

          {loading ? (
            <div className="flex justify-center p-16">
              <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center border border-gray-100">
              <div className="text-5xl mb-3">Calendar</div>
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
                        <div className="text-xs font-bold text-teal-500">{a.appointmentTime.slice(0,5)}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 text-lg">{a.patient.name}</div>
                        <div className="text-sm text-gray-500">{a.patient.patientId}  |  {a.type.replace('_',' ')}</div>
                        {a.reason && <div className="text-sm text-gray-600 mt-1">Note {a.reason}</div>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_COLORS[a.status] || ''}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 pt-3 border-t border-gray-50">
                    <Link to={`/doctor-portal/appointments/${a.id}`}
                      className="flex-1 text-center text-sm bg-teal-50 text-teal-700 hover:bg-teal-100 py-2 rounded-lg font-medium transition-colors">
                      {a.status === 'confirmed' ? 'Start Consultation' : a.status === 'in_progress' ? 'Continue Consultation' : 'View Details'}
                    </Link>
                    {['scheduled', 'postponed'].includes(a.status) && (
                      <button onClick={() => handleStatus(a.id,'confirmed')}
                        className="px-4 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium">
                        Confirm
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {viewMode === 'calendar' && (
        <CalendarView
          appointments={calendarAppointments}
          view={calendarView}
          currentDate={calendarDate}
          onNavigate={setCalendarDate}
          onViewChange={setCalendarView}
          onAppointmentClick={appt => navigate(`/doctor-portal/appointments/${appt.id}`)}
          showDoctor={false}
          loading={calendarLoading}
        />
      )}
    </div>
  );
}
