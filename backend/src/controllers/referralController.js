const { Referral, Patient, Doctor, Hospital } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');

exports.getAll = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { status, receivingDoctorId, referringDoctorId, patientId } = req.query;
    const where = {};
    if (!isSuperAdmin(req.user)) where.hospitalId = scope.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;

    if (status) where.status = status;
    if (receivingDoctorId) where.receivingDoctorId = receivingDoctorId;
    if (referringDoctorId) where.referringDoctorId = referringDoctorId;
    if (patientId) where.patientId = patientId;

    const pagination = getPaginationParams(req.query, { defaultPerPage: 25, forcePaginate: req.query.paginate !== 'false' });
    const baseOptions = {
      where,
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'phone', 'gender', 'dateOfBirth'] },
        { model: Doctor, as: 'receivingDoctor', attributes: ['id', 'name', 'specialization'] },
        { model: Doctor, as: 'referringDoctor', attributes: ['id', 'name', 'specialization'], required: false },
        { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
      ],
      order: [['referralDate', 'DESC'], ['createdAt', 'DESC']],
    };

    if (pagination) {
      const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
      const referrals = await Referral.findAndCountAll(queryOptions);
      return res.json({
        data: referrals.rows,
        meta: buildPaginationMeta(pagination, referrals.count),
      });
    }

    const referrals = await Referral.findAll(baseOptions);
    res.json(referrals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const referral = await Referral.findByPk(req.params.id, {
      include: [
        { model: Patient, as: 'patient' },
        { model: Doctor, as: 'receivingDoctor', attributes: ['id', 'name', 'specialization', 'phone', 'email'] },
        { model: Doctor, as: 'referringDoctor', attributes: ['id', 'name', 'specialization', 'phone', 'email'], required: false },
        { model: Hospital, as: 'hospital', attributes: ['id', 'name'] },
      ],
    });

    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    if (!isSuperAdmin(req.user) && referral.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital referral' });
    }

    res.json(referral);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user) ? (req.body.hospitalId || scope.hospitalId) : scope.hospitalId;
    const {
      patientId,
      receivingDoctorId,
      referringDoctorId,
      referringDoctorName,
      referringDoctorClinic,
      referringDoctorPhone,
      referralDate,
      reason,
      status = 'pending',
      notes,
    } = req.body;

    if (!patientId || !receivingDoctorId) {
      return res.status(400).json({ message: 'patientId and receivingDoctorId are required' });
    }

    // Verify patient belongs to hospital
    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(400).json({ message: 'Patient not found' });
    if (!isSuperAdmin(req.user) && patient.hospitalId !== hospitalId) {
      return res.status(400).json({ message: 'Patient belongs to another hospital' });
    }

    // Verify receiving doctor exists
    const receivingDoctor = await Doctor.findByPk(receivingDoctorId);
    if (!receivingDoctor) return res.status(400).json({ message: 'Receiving doctor not found' });

    const referral = await Referral.create({
      hospitalId,
      patientId,
      receivingDoctorId,
      referringDoctorId: referringDoctorId || null,
      referringDoctorName: referringDoctorName ? String(referringDoctorName).trim() : null,
      referringDoctorClinic: referringDoctorClinic ? String(referringDoctorClinic).trim() : null,
      referringDoctorPhone: referringDoctorPhone ? String(referringDoctorPhone).trim() : null,
      referralDate: referralDate || new Date().toISOString().slice(0, 10),
      reason: reason || null,
      status,
      notes: notes || null,
    });

    const created = await Referral.findByPk(referral.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'phone'] },
        { model: Doctor, as: 'receivingDoctor', attributes: ['id', 'name', 'specialization'] },
        { model: Doctor, as: 'referringDoctor', attributes: ['id', 'name', 'specialization'], required: false },
      ],
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const referral = await Referral.findByPk(req.params.id);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    if (!isSuperAdmin(req.user) && referral.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital referral' });
    }

    const { status, reason, notes, receivingDoctorId, referralDate } = req.body;
    const patch = {};
    if (status && ['pending', 'scheduled', 'completed', 'declined'].includes(status)) {
      patch.status = status;
    }
    if (reason !== undefined) patch.reason = reason;
    if (notes !== undefined) patch.notes = notes;
    if (receivingDoctorId !== undefined) patch.receivingDoctorId = receivingDoctorId;
    if (referralDate !== undefined) patch.referralDate = referralDate;

    await referral.update(patch);

    const updated = await Referral.findByPk(referral.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'phone'] },
        { model: Doctor, as: 'receivingDoctor', attributes: ['id', 'name', 'specialization'] },
        { model: Doctor, as: 'referringDoctor', attributes: ['id', 'name', 'specialization'], required: false },
      ],
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const referral = await Referral.findByPk(req.params.id);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    if (!isSuperAdmin(req.user) && referral.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied for this hospital referral' });
    }

    await referral.destroy();
    res.json({ message: 'Referral deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
