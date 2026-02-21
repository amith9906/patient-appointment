const { BillItem, Appointment, Doctor } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');

// Verify caller has access to this appointment
async function checkAccess(req, res, apptId) {
  const scope = await ensureScopedHospital(req, res);
  if (!scope.allowed) return null;

  const appt = await Appointment.findByPk(apptId);
  if (!appt) { res.status(404).json({ message: 'Appointment not found' }); return null; }

  if (!isSuperAdmin(req.user)) {
    const doctor = await Doctor.findByPk(appt.doctorId, { attributes: ['hospitalId'] });
    if (doctor?.hospitalId !== scope.hospitalId) {
      res.status(403).json({ message: 'Access denied for this appointment' }); return null;
    }
  }
  return appt;
}

// GET /appointments/:id/bill-items
exports.getByAppointment = async (req, res) => {
  try {
    const items = await BillItem.findAll({
      where: { appointmentId: req.params.id },
      order: [['createdAt', 'ASC']],
    });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /appointments/:id/bill-items
// Body: { items: [{ description, category, quantity, unitPrice }] }
exports.saveItems = async (req, res) => {
  try {
    const appt = await checkAccess(req, res, req.params.id);
    if (!appt) return;

    const { items = [] } = req.body;

    // Build records and validate
    const records = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      return {
        appointmentId: req.params.id,
        description: String(item.description || '').trim(),
        category: item.category || 'other',
        quantity: qty,
        unitPrice: price,
        amount: parseFloat((qty * price).toFixed(2)),
      };
    }).filter(r => r.description && r.unitPrice > 0);

    // Replace all items atomically
    await BillItem.destroy({ where: { appointmentId: req.params.id } });
    const created = records.length ? await BillItem.bulkCreate(records) : [];

    // Update appointment.treatmentBill = sum of all item amounts
    const total = created.reduce((s, r) => s + Number(r.amount), 0);
    await appt.update({ treatmentBill: parseFloat(total.toFixed(2)) });

    res.json(created);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// PATCH /appointments/:id/mark-paid
exports.markPaid = async (req, res) => {
  try {
    const appt = await checkAccess(req, res, req.params.id);
    if (!appt) return;

    await appt.update({ isPaid: !appt.isPaid });
    res.json({ isPaid: appt.isPaid });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
