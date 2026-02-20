const { Lab, Hospital, LabTest, Patient, Doctor, Appointment } = require('../models');
const { Op } = require('sequelize');

exports.getAllLabs = async (req, res) => {
  try {
    const labs = await Lab.findAll({
      where: { isActive: true },
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(labs);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createLab = async (req, res) => {
  try {
    const lab = await Lab.create(req.body);
    res.status(201).json(lab);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.updateLab = async (req, res) => {
  try {
    const lab = await Lab.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ message: 'Lab not found' });
    await lab.update(req.body);
    res.json(lab);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.deleteLab = async (req, res) => {
  try {
    const lab = await Lab.findByPk(req.params.id);
    if (!lab) return res.status(404).json({ message: 'Lab not found' });
    await lab.update({ isActive: false });
    res.json({ message: 'Lab deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Lab Tests
exports.getAllTests = async (req, res) => {
  try {
    const { labId, patientId, status, search } = req.query;
    const where = {};
    if (labId) where.labId = labId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (search) where.testName = { [Op.iLike]: `%${search}%` };

    const tests = await LabTest.findAll({
      where,
      include: [
        { model: Lab, as: 'lab', attributes: ['id', 'name'] },
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId'] },
        { model: Appointment, as: 'appointment', attributes: ['id', 'appointmentNumber'] },
      ],
      order: [['orderedDate', 'DESC']],
    });
    res.json(tests);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOneTest = async (req, res) => {
  try {
    const test = await LabTest.findByPk(req.params.id, {
      include: [
        { model: Lab, as: 'lab' },
        { model: Patient, as: 'patient' },
        { model: Appointment, as: 'appointment' },
      ],
    });
    if (!test) return res.status(404).json({ message: 'Lab test not found' });
    res.json(test);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createTest = async (req, res) => {
  try {
    const test = await LabTest.create(req.body);
    res.status(201).json(test);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.updateTest = async (req, res) => {
  try {
    const test = await LabTest.findByPk(req.params.id);
    if (!test) return res.status(404).json({ message: 'Lab test not found' });
    if (req.body.status === 'completed' && !req.body.completedDate) {
      req.body.completedDate = new Date();
    }
    await test.update(req.body);
    res.json(test);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.deleteTest = async (req, res) => {
  try {
    const test = await LabTest.findByPk(req.params.id);
    if (!test) return res.status(404).json({ message: 'Lab test not found' });
    await test.update({ status: 'cancelled' });
    res.json({ message: 'Lab test cancelled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
