const { DoctorAvailability } = require('../models');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toMinutes = (time) => {
  if (!time) return 0;
  const parts = String(time).split(':').map((v) => Number(v));
  if (parts.length < 2) return 0;
  const [hour, minute] = parts;
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
};

const formatTime = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const ensureScheduleForDay = (doctor, dayOfWeek, schedules) => {
  if (schedules?.length) return schedules;
  const todayName = DAY_NAMES[dayOfWeek] || '';
  if (doctor.availableDays?.some((day) => String(day || '').toLowerCase() === todayName.toLowerCase())) {
    return [{
      dayOfWeek,
      startTime: doctor.availableFrom || '09:00',
      endTime: doctor.availableTo || '17:00',
      slotDurationMinutes: 30,
      bufferMinutes: 0,
      maxAppointmentsPerSlot: 1,
    }];
  }
  return [];
};

const buildSlotsFromSchedules = (schedules, bookedTimes) => {
  const slots = [];
  schedules.forEach((schedule) => {
    const slotDuration = Number(schedule.slotDurationMinutes || 30);
    const buffer = Number(schedule.bufferMinutes || 0);
    const step = slotDuration + buffer;
    let cursor = toMinutes(schedule.startTime);
    const end = toMinutes(schedule.endTime);
    while (cursor + slotDuration <= end) {
      const time = formatTime(cursor);
      const count = bookedTimes.get(time) || 0;
      const capacity = Number(schedule.maxAppointmentsPerSlot || 1);
      slots.push({
        time,
        available: count < capacity,
        capacity,
        slotDuration,
        buffer,
      });
      cursor += step || slotDuration || 1;
    }
  });
  return slots;
};

const fetchSchedules = (doctorId, dayOfWeek) => DoctorAvailability.findAll({
  where: { doctorId, dayOfWeek, isActive: true },
  order: [['startTime', 'ASC']],
});

const findScheduleForTime = (schedules, timeMinutes) => {
  return schedules.find((schedule) => {
    const start = toMinutes(schedule.startTime);
    const end = toMinutes(schedule.endTime);
    return timeMinutes >= start && timeMinutes < end;
  });
};

module.exports = {
  DAY_NAMES,
  toMinutes,
  formatTime,
  ensureScheduleForDay,
  buildSlotsFromSchedules,
  fetchSchedules,
  findScheduleForTime,
};
