const { Medication, Hospital } = require('../models');
const { Op } = require('sequelize');

exports.getAll = async (req, res) => {
  try {
    const { hospitalId, category, search, lowStock } = req.query;
    const where = { isActive: true };
    if (hospitalId) where.hospitalId = hospitalId;
    if (category) where.category = category;
    if (lowStock === 'true') where.stockQuantity = { [Op.lt]: 10 };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { genericName: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const medications = await Medication.findAll({
      where,
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(medications);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const med = await Medication.findByPk(req.params.id, {
      include: [{ model: Hospital, as: 'hospital', attributes: ['id', 'name'] }],
    });
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    res.json(med);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const med = await Medication.create(req.body);
    res.status(201).json(med);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    await med.update(req.body);
    res.json(med);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });
    await med.update({ isActive: false });
    res.json({ message: 'Medication deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateStock = async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' | 'subtract'
    const med = await Medication.findByPk(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medication not found' });

    const newQty = operation === 'subtract'
      ? med.stockQuantity - quantity
      : med.stockQuantity + quantity;

    if (newQty < 0) return res.status(400).json({ message: 'Insufficient stock' });
    await med.update({ stockQuantity: newQty });
    res.json({ message: 'Stock updated', stockQuantity: newQty });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
