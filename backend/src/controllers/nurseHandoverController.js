const { NurseHandover, Nurse, IPDAdmission, Patient } = require('../models');

exports.createHandover = async (req, res) => {
  try {
    const { admissionId, toNurseId, situation, background, assessment, recommendation, handoverDate, handoverTime } = req.body;

    // Identify from nurse
    let fromNurseId = null;
    if (req.user.role === 'nurse') {
      const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
      if (nurse) fromNurseId = nurse.id;
    }

    if (!fromNurseId) {
      return res.status(403).json({ message: 'Only nursing staff can initiate a handover' });
    }

    const handover = await NurseHandover.create({
      admissionId,
      fromNurseId,
      toNurseId: toNurseId || null,
      situation,
      background,
      assessment,
      recommendation,
      handoverDate: handoverDate || new Date().toISOString().split('T')[0],
      handoverTime: handoverTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
      status: 'pending'
    });

    const full = await NurseHandover.findByPk(handover.id, {
      include: [
        { model: Nurse, as: 'fromNurse', attributes: ['id', 'name'] },
        { model: Nurse, as: 'toNurse', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHandovers = async (req, res) => {
  try {
    const { admissionId, nurseId, status } = req.query;
    const where = {};
    if (admissionId) where.admissionId = admissionId;
    if (nurseId) {
      // Show handovers where the nurse is either from or to
      where[Op.or] = [
        { fromNurseId: nurseId },
        { toNurseId: nurseId }
      ];
    }
    if (status) where.status = status;

    const handovers = await NurseHandover.findAll({
      where,
      include: [
        { model: Nurse, as: 'fromNurse', attributes: ['id', 'name'] },
        { model: Nurse, as: 'toNurse', attributes: ['id', 'name'] },
        { 
          model: IPDAdmission, as: 'admission', 
          include: [{ model: Patient, as: 'patient', attributes: ['id', 'name'] }] 
        }
      ],
      order: [['handoverDate', 'DESC'], ['handoverTime', 'DESC']]
    });

    res.json(handovers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.signOff = async (req, res) => {
  try {
    const handover = await NurseHandover.findByPk(req.params.id);
    if (!handover) return res.status(404).json({ message: 'Handover not found' });

    // Validate if current user is the "toNurse"
    let userNurseId = null;
    const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
    if (nurse) userNurseId = nurse.id;

    if (handover.toNurseId && handover.toNurseId !== userNurseId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the receiving nurse can sign off this handover' });
    }

    await handover.update({ status: 'signed_off' });
    res.json({ success: true, message: 'Handover signed off' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
