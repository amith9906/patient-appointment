const { FluidBalance, Nurse, IPDAdmission } = require('../models');

exports.record = async (req, res) => {
  try {
    const { admissionId, type, route, amount, notes, recordedAt } = req.body;

    if (!admissionId || !type || !route || !amount) {
      return res.status(400).json({ message: 'admissionId, type, route, and amount are required' });
    }

    // Identify nurse
    let nurseId = null;
    if (req.user.role === 'nurse') {
      const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
      if (nurse) nurseId = nurse.id;
    }

    if (!nurseId) {
      return res.status(403).json({ message: 'Only nursing staff can record fluid balance' });
    }

    const fluid = await FluidBalance.create({
      admissionId,
      nurseId,
      type,
      route,
      amount: Number(amount),
      notes,
      recordedAt: recordedAt || new Date()
    });

    const full = await FluidBalance.findByPk(fluid.id, {
      include: [{ model: Nurse, as: 'nurse', attributes: ['id', 'name'] }]
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { admissionId, date } = req.query;
    const where = {};
    if (admissionId) where.admissionId = admissionId;
    
    // If date provided, filter by that day
    if (date) {
        const { Op } = require('sequelize');
        where.recordedAt = {
            [Op.gte]: new Date(`${date}T00:00:00`),
            [Op.lte]: new Date(`${date}T23:59:59`)
        };
    }

    const history = await FluidBalance.findAll({
      where,
      include: [{ model: Nurse, as: 'nurse', attributes: ['id', 'name'] }],
      order: [['recordedAt', 'DESC']]
    });

    // Calculate totals
    const totalIntake = history.filter(f => f.type === 'intake').reduce((sum, f) => sum + f.amount, 0);
    const totalOutput = history.filter(f => f.type === 'output').reduce((sum, f) => sum + f.amount, 0);

    res.json({
      data: history,
      summary: {
        totalIntake,
        totalOutput,
        balance: totalIntake - totalOutput
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteLog = async (req, res) => {
  try {
    const log = await FluidBalance.findByPk(req.params.id);
    if (!log) return res.status(404).json({ message: 'Log not found' });
    
    await log.destroy();
    res.json({ message: 'Fluid balance log removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
