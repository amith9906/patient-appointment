const { MedicationAdministration, Prescription, Medication, Nurse, IPDAdmission } = require('../models');

exports.record = async (req, res) => {
  try {
    const { prescriptionId, admissionId, adminDate, adminTime, status, notes } = req.body;

    if (!prescriptionId || !adminDate || !adminTime) {
      return res.status(400).json({ message: 'prescriptionId, adminDate, and adminTime are required' });
    }

    // Identify nurse
    let nurseId = null;
    if (req.user.role === 'nurse') {
      const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
      if (nurse) nurseId = nurse.id;
    }

    if (!nurseId) {
      return res.status(403).json({ message: 'Only nursing staff can record medication administration' });
    }

    const record = await MedicationAdministration.create({
      prescriptionId,
      admissionId: admissionId || null,
      nurseId,
      adminDate,
      adminTime,
      status: status || 'given',
      notes
    });

    const full = await MedicationAdministration.findByPk(record.id, {
      include: [
        { model: Nurse, as: 'nurse', attributes: ['id', 'name'] },
        { 
          model: Prescription, 
          as: 'prescription',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name'] }]
        }
      ]
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const { admissionId, prescriptionId, date } = req.query;
    const where = {};
    if (admissionId) where.admissionId = admissionId;
    if (prescriptionId) where.prescriptionId = prescriptionId;
    if (date) where.adminDate = date;

    const logs = await MedicationAdministration.findAll({
      where,
      include: [
        { model: Nurse, as: 'nurse', attributes: ['id', 'name'] },
        { 
          model: Prescription, 
          as: 'prescription',
          include: [{ model: Medication, as: 'medication', attributes: ['id', 'name'] }]
        }
      ],
      order: [['adminDate', 'DESC'], ['adminTime', 'DESC']]
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteLog = async (req, res) => {
  try {
    const log = await MedicationAdministration.findByPk(req.params.id);
    if (!log) return res.status(404).json({ message: 'Log not found' });
    
    await log.destroy();
    res.json({ message: 'Administration log removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
