import React from 'react';
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  addDays, subDays, format, isSameDay, parseISO, isToday,
} from 'date-fns';

// ─── Constants ───────────────────────────────────────────────────────────────

const TIME_SLOTS = [];
for (let h = 8; h < 20; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}
// -> ['08:00', '08:30', ..., '19:30']

const STATUS_STYLE = {
  scheduled:  { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-800',   dot: 'bg-blue-400' },
  postponed:  { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', dot: 'bg-orange-400' },
  confirmed:  { bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-800',  dot: 'bg-green-400' },
  in_progress:{ bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-800',  dot: 'bg-amber-400' },
  completed:  { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500',   dot: 'bg-gray-400' },
  cancelled:  { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-400',    dot: 'bg-red-300' },
  no_show:    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', dot: 'bg-orange-400' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slotTime(appt) {
  // appointmentTime arrives as "09:00:00" or "09:00"; normalise to "HH:MM"
  return (appt.appointmentTime || '').slice(0, 5);
}

function apptDate(appt) {
  // appointmentDate is a date string like "2025-01-13"
  try { return parseISO(appt.appointmentDate); } catch { return null; }
}

function getWeekDays(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ─── Appointment Card ─────────────────────────────────────────────────────────

function ApptCard({ appt, showDoctor, onClick, compact }) {
  const s = STATUS_STYLE[appt.status] || STATUS_STYLE.scheduled;
  const isCancelled = appt.status === 'cancelled' || appt.status === 'no_show';

  return (
    <button
      onClick={() => onClick(appt)}
      className={`w-full text-left rounded border ${s.bg} ${s.border} ${s.text} px-1.5 py-1 mb-0.5 hover:opacity-80 transition-opacity ${isCancelled ? 'opacity-60' : ''}`}
      style={{ fontSize: 11, lineHeight: '1.3' }}
    >
      <div className={`font-semibold truncate ${isCancelled ? 'line-through' : ''}`}>
        {appt.patient.name || '-'}
      </div>
      {showDoctor && appt.doctor.name && (
        <div className="truncate opacity-70">Dr. {appt.doctor.name}</div>
      )}
      {!compact && appt.type && (
        <div className="truncate opacity-60 capitalize">{appt.type.replace(/_/g, ' ')}</div>
      )}
    </button>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekGrid({ weekDays, appointments, showDoctor, onAppointmentClick }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: 600 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', minWidth: 600 }}>
        {/* Day headers */}
        <div className="sticky top-0 z-10 bg-white border-b border-r border-gray-200 h-10" />
        {weekDays.map((day) => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()}
              className={`sticky top-0 z-10 border-b border-r border-gray-200 h-10 flex flex-col items-center justify-center
                ${today ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{format(day, 'EEE')}</div>
              <div style={{ fontSize: 13, fontWeight:today ? 700 : 500}}>{format(day, 'd')}</div>
            </div>
          );
        })}

        {/* Time rows */}
        {TIME_SLOTS.map((slot, idx) => (
          <React.Fragment key={slot}>
            {/* Time label */}
            <div className={`border-b border-r border-gray-100 flex items-start justify-end pr-2 pt-0.5
              ${idx % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
              style={{ height: 52, fontSize: 10, color: '#9ca3af', paddingTop: 4 }}>
              {idx % 2 === 0 ? slot : ''}
            </div>

            {/* Day cells */}
            {weekDays.map((day) => {
              const cellAppts = appointments.filter(a => {
                const d = apptDate(a);
                return d && isSameDay(d, day) && slotTime(a) === slot;
              });
              return (
                <div key={day.toISOString()}
                  className={`border-b border-r border-gray-100 p-0.5
                    ${isToday(day) ? 'bg-blue-50/30' : ''}
                    ${idx % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                  style={{ height: 52, overflow: 'hidden' }}>
                  {cellAppts.map(a => (
                    <ApptCard key={a.id} appt={a} showDoctor={showDoctor}
                      onClick={onAppointmentClick} compact />
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayGrid({ day, appointments, showDoctor, onAppointmentClick }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: 600 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', minWidth: 320 }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-r border-gray-200 h-10" />
        <div className={`sticky top-0 z-10 border-b border-r border-gray-200 h-10 flex items-center justify-center
          ${isToday(day) ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{format(day, 'EEEE, MMMM d, yyyy')}</span>
        </div>

        {/* Rows */}
        {TIME_SLOTS.map((slot, idx) => {
          const cellAppts = appointments.filter(a => {
            const d = apptDate(a);
            return d && isSameDay(d, day) && slotTime(a) === slot;
          });
          return (
            <React.Fragment key={slot}>
              <div className={`border-b border-r border-gray-100 flex items-start justify-end pr-2
                ${idx % 2 === 0 ? 'border-gray-200' : ''}`}
                style={{ height: 56, fontSize: 10, color: '#9ca3af', paddingTop: 4 }}>
                {idx % 2 === 0 ? slot : ''}
              </div>
              <div className={`border-b border-r border-gray-100 p-1
                ${idx % 2 === 0 ? 'border-gray-200' : ''}`}
                style={{ minHeight: 56 }}>
                {cellAppts.map(a => {
                  const s = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled;
                  return (
                    <button key={a.id} onClick={() => onAppointmentClick(a)}
                      className={`w-full text-left rounded-lg border ${s.bg} ${s.border} ${s.text} px-3 py-2 mb-1 hover:opacity-80 transition-opacity`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{a.patient.name || '-'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text} border ${s.border}`}>
                          {a.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {showDoctor && a.doctor.name && (
                        <div className="text-xs mt-0.5 opacity-75">Dr. {a.doctor.name}  |  {a.doctor.specialization}</div>
                      )}
                      {a.type && <div className="text-xs opacity-60 capitalize mt-0.5">{a.type.replace(/_/g, ' ')}</div>}
                      {a.reason && <div className="text-xs opacity-50 truncate mt-0.5">{a.reason}</div>}
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export default function CalendarView({
  appointments = [],
  view = 'week',
  currentDate,
  onNavigate,
  onViewChange,
  onAppointmentClick,
  showDoctor = true,
  loading = false,
}) {
  const date = currentDate || new Date();
  const weekDays = getWeekDays(date);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(date,   { weekStartsOn: 1 });

  const handlePrev = () => {
    onNavigate(view === 'week' ? subWeeks(date, 1) : subDays(date, 1));
  };
  const handleNext = () => {
    onNavigate(view === 'week' ? addWeeks(date, 1) : addDays(date, 1));
  };
  const handleToday = () => onNavigate(new Date());

  const headerLabel = view === 'week'
    ? `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
    : format(date, 'EEEE, MMMM d, yyyy');

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={handlePrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors">
            ‹
          </button>
          <button onClick={handleToday}
            className="px-3 h-8 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors">
            Today
          </button>
          <button onClick={handleNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors">
            ›
          </button>
          <span className="font-semibold text-gray-800 ml-1" style={{ fontSize: 14 }}>{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {['week', 'day'].map(v => (
            <button key={v} onClick={() => onViewChange(v)}
              className={`px-3 h-7 text-xs font-medium rounded-lg border transition-colors capitalize
                ${view === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}
        {view === 'week' ? (
          <WeekGrid weekDays={weekDays} appointments={appointments} showDoctor={showDoctor} onAppointmentClick={onAppointmentClick} />
        ) : (
          <DayGrid day={date} appointments={appointments} showDoctor={showDoctor} onAppointmentClick={onAppointmentClick} />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50">
        {Object.entries(STATUS_STYLE).map(([status, s]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span style={{ fontSize: 11 }} className="text-gray-500 capitalize">{status.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
