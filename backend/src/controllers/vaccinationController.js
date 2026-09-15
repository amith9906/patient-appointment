const { VaccinationSchedule, Patient, Doctor } = require('../models');

const STANDARD_IAP_VACCINES = [
  { name: 'BCG', ageDesc: 'At Birth', offsetUnit: 'days', offsetVal: 0 },
  { name: 'OPV 0 & Hepatitis B 1', ageDesc: 'At Birth', offsetUnit: 'days', offsetVal: 0 },
  { name: 'DTwP/DTaP 1, IPV 1, Hib 1, Rotavirus 1, PCV 1', ageDesc: '6 Weeks', offsetUnit: 'weeks', offsetVal: 6 },
  { name: 'DTwP/DTaP 2, IPV 2, Hib 2, Rotavirus 2, PCV 2', ageDesc: '10 Weeks', offsetUnit: 'weeks', offsetVal: 10 },
  { name: 'DTwP/DTaP 3, IPV 3, Hib 3, Rotavirus 3, PCV 3', ageDesc: '14 Weeks', offsetUnit: 'weeks', offsetVal: 14 },
  { name: 'OPV 1, Hepatitis B 2', ageDesc: '6 Months', offsetUnit: 'months', offsetVal: 6 },
  { name: 'MMR 1, OPV 2', ageDesc: '9 Months', offsetUnit: 'months', offsetVal: 9 },
  { name: 'Hepatitis A 1, Typhoid Conjugate', ageDesc: '12 Months', offsetUnit: 'months', offsetVal: 12 },
  { name: 'MMR 2, Varicella 1, PCV Booster', ageDesc: '15 Months', offsetUnit: 'months', offsetVal: 15 },
  { name: 'DTwP/DTaP Booster 1, IPV Booster, Hib Booster', ageDesc: '18 Months', offsetUnit: 'months', offsetVal: 18 },
  { name: 'Hepatitis A 2', ageDesc: '2 Years', offsetUnit: 'years', offsetVal: 2 },
  { name: 'DTwP/DTaP Booster 2, OPV 3, MMR 3', ageDesc: '4-5 Years', offsetUnit: 'years', offsetVal: 4 },
  { name: 'Tdap / Td, HPV', ageDesc: '10-12 Years', offsetUnit: 'years', offsetVal: 10 },
];

function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function calculateDueDate(dobDate, unit, val) {
  const date = new Date(dobDate);
  if (isNaN(date.getTime())) return new Date();
  if (unit === 'days') date.setDate(date.getDate() + val);
  else if (unit === 'weeks') date.setDate(date.getDate() + (val * 7));
  else if (unit === 'months') date.setMonth(date.getMonth() + val);
  else if (unit === 'years') date.setFullYear(date.getFullYear() + val);
  return date;
}

exports.getPatientVaccinations = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    let records = await VaccinationSchedule.findAll({
      where: { patientId },
      include: [
        { model: Doctor, as: 'administeredByDoctor', attributes: ['id', 'name', 'specialization'] },
      ],
      order: [['dueDate', 'ASC']],
    });

    // Auto-generate standard schedule if no records exist yet
    if (records.length === 0 && patient.dob) {
      const dob = new Date(patient.dob);
      const newItems = STANDARD_IAP_VACCINES.map((item) => {
        const due = calculateDueDate(dob, item.offsetUnit, item.offsetVal);
        return {
          patientId,
          vaccineName: item.name,
          targetAgeDescription: item.ageDesc,
          dueDate: formatDate(due),
          status: 'due',
        };
      });

      await VaccinationSchedule.bulkCreate(newItems);

      records = await VaccinationSchedule.findAll({
        where: { patientId },
        include: [
          { model: Doctor, as: 'administeredByDoctor', attributes: ['id', 'name', 'specialization'] },
        ],
        order: [['dueDate', 'ASC']],
      });
    }

    return res.json({ patient, vaccinations: records });
  } catch (error) {
    console.error('Error fetching patient vaccinations:', error);
    return res.status(500).json({ error: 'Failed to fetch vaccination schedule' });
  }
};

exports.autoGenerateSchedule = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (!patient.dob) {
      return res.status(400).json({ error: 'Patient Date of Birth (DOB) is required to generate vaccination schedule' });
    }

    // Delete existing un-given schedule items if any
    await VaccinationSchedule.destroy({
      where: { patientId, status: 'due' },
    });

    const dob = new Date(patient.dob);
    const newItems = STANDARD_IAP_VACCINES.map((item) => {
      const due = calculateDueDate(dob, item.offsetUnit, item.offsetVal);
      return {
        patientId,
        vaccineName: item.name,
        targetAgeDescription: item.ageDesc,
        dueDate: formatDate(due),
        status: 'due',
      };
    });

    await VaccinationSchedule.bulkCreate(newItems);

    const records = await VaccinationSchedule.findAll({
      where: { patientId },
      include: [
        { model: Doctor, as: 'administeredByDoctor', attributes: ['id', 'name', 'specialization'] },
      ],
      order: [['dueDate', 'ASC']],
    });

    return res.json({ message: 'Vaccination schedule generated successfully', vaccinations: records });
  } catch (error) {
    console.error('Error auto-generating vaccination schedule:', error);
    return res.status(500).json({ error: 'Failed to generate vaccination schedule' });
  }
};

exports.createVaccination = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { vaccineName, targetAgeDescription, dueDate, givenDate, status, batchNumber, notes } = req.body;

    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const item = await VaccinationSchedule.create({
      patientId,
      vaccineName,
      targetAgeDescription: targetAgeDescription || 'Custom Milestone',
      dueDate: dueDate || formatDate(new Date()),
      givenDate: status === 'given' ? (givenDate || formatDate(new Date())) : null,
      status: status || 'due',
      batchNumber,
      notes,
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error('Error creating vaccination:', error);
    return res.status(500).json({ error: 'Failed to create vaccination record' });
  }
};

exports.updateVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, givenDate, administeredByDoctorId, batchNumber, notes, dueDate } = req.body;

    const item = await VaccinationSchedule.findByPk(id);
    if (!item) {
      return res.status(404).json({ error: 'Vaccination record not found' });
    }

    if (status !== undefined) item.status = status;
    if (givenDate !== undefined) item.givenDate = givenDate;
    if (status === 'given' && !item.givenDate) {
      item.givenDate = formatDate(new Date());
    }
    if (administeredByDoctorId !== undefined) item.administeredByDoctorId = administeredByDoctorId;
    if (batchNumber !== undefined) item.batchNumber = batchNumber;
    if (notes !== undefined) item.notes = notes;
    if (dueDate !== undefined) item.dueDate = dueDate;

    await item.save();

    const updated = await VaccinationSchedule.findByPk(id, {
      include: [
        { model: Doctor, as: 'administeredByDoctor', attributes: ['id', 'name', 'specialization'] },
      ],
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error updating vaccination record:', error);
    return res.status(500).json({ error: 'Failed to update vaccination record' });
  }
};

exports.deleteVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await VaccinationSchedule.findByPk(id);
    if (!item) {
      return res.status(404).json({ error: 'Vaccination record not found' });
    }
    await item.destroy();
    return res.json({ message: 'Vaccination record deleted successfully' });
  } catch (error) {
    console.error('Error deleting vaccination record:', error);
    return res.status(500).json({ error: 'Failed to delete vaccination record' });
  }
};
