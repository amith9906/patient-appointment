const { Op } = require('sequelize');
const { Patient, Doctor, Appointment, IPDAdmission } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

exports.globalSearch = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ patients: [], doctors: [], appointments: [], admissions: [] });

    const like = { [Op.iLike]: `%${q}%` };
    const hospitalId = isSuperAdmin(req.user) ? null : scope.hospitalId;
    const LIMIT = 6;

    // Patient and Doctor WHERE uses hospitalId directly
    const entityWhere = hospitalId ? { hospitalId } : {};

    // Appointments are scoped by patient.hospitalId (no hospitalId on Appointment itself)
    const patientScopeWhere = hospitalId ? { ...entityWhere, name: like } : { name: like };

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [patients, doctors, appointments, admissions] = await Promise.all([
      Patient.findAll({
        where: { ...entityWhere, [Op.or]: [{ name: like }, { patientId: like }, { phone: like }] },
        attributes: ['id', 'name', 'patientId', 'phone', 'gender'],
        limit: LIMIT,
        order: [['name', 'ASC']],
      }),
      Doctor.findAll({
        where: { ...entityWhere, [Op.or]: [{ name: like }, { specialization: like }] },
        attributes: ['id', 'name', 'specialization'],
        limit: LIMIT,
        order: [['name', 'ASC']],
      }),
      Appointment.findAll({
        where: { appointmentDate: { [Op.gte]: cutoff } },
        include: [{
          model: Patient,
          as: 'patient',
          where: patientScopeWhere,
          attributes: ['id', 'name'],
          required: true,
        }],
        attributes: ['id', 'appointmentDate', 'appointmentTime', 'status'],
        limit: LIMIT,
        order: [['appointmentDate', 'DESC']],
      }),
      IPDAdmission.findAll({
        where: { ...entityWhere },
        include: [{
          model: Patient,
          as: 'patient',
          where: { name: like },
          attributes: ['id', 'name'],
          required: true,
        }],
        attributes: ['id', 'admissionDate', 'status'],
        limit: LIMIT,
        order: [['admissionDate', 'DESC']],
      }),
    ]);

    res.json({
      patients: patients.map((p) => ({ id: p.id, name: p.name, patientId: p.patientId, phone: p.phone, gender: p.gender })),
      doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization })),
      appointments: appointments.map((a) => ({ id: a.id, date: a.appointmentDate, time: a.appointmentTime, status: a.status, patientName: a.patient?.name })),
      admissions: admissions.map((a) => ({ id: a.id, date: a.admissionDate, status: a.status, patientName: a.patient?.name })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
