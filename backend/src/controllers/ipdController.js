const { Op } = require('sequelize');
const {
  sequelize, IPDAdmission, IPDNote, IPDBillItem, IPDPayment, Room, Patient, Doctor,
  Hospital, PatientPackage, User, Nurse, Shift, NurseShiftAssignment, NursePatientAssignment,
  Prescription, Medication, MedicationAdministration
} = require('../models');
const { ensureScopedHospital, isSuperAdmin, getHODDepartmentId } = require('../utils/accessScope');
const { getPaginationParams, buildPaginationMeta, applyPaginationOptions } = require('../utils/pagination');

// ─── Billing helper ────────────────────────────────────────────────────────────
async function recalculateBilling(admissionId) {
  const admission = await IPDAdmission.findByPk(admissionId);
  if (!admission) return null;

  const [billItems, payments] = await Promise.all([
    IPDBillItem.findAll({ where: { admissionId } }),
    IPDPayment.findAll({ where: { admissionId } }),
  ]);

  const billedAmount = billItems.reduce((s, i) => s + parseFloat(i.totalWithGst || 0), 0);
  const paidAmount = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const discountAmount = parseFloat(admission.discountAmount || 0);

  const netBilled = Math.max(0, billedAmount - discountAmount);
  const paymentStatus = billedAmount > 0 && paidAmount >= netBilled ? 'paid'
                      : paidAmount > 0 ? 'partial' : 'pending';

  await admission.update({ billedAmount, paidAmount, paymentStatus });
  return { billedAmount, paidAmount, paymentStatus };
}

// Resolve the effective hospital scope for WHERE clauses.
// Super admin can optionally pass ?hospitalId= to filter; others are always scoped.
function buildHospitalFilter(req, scope, queryHospitalId) {
  if (isSuperAdmin(req.user)) {
    return queryHospitalId ? { hospitalId: queryHospitalId } : {};
  }
  return { hospitalId: scope.hospitalId };
}

const HOSPITAL_INCLUDE = { model: Hospital, as: 'hospital', attributes: ['id', 'name'] };

// ─── Rooms ────────────────────────────────────────────────────────────────────

exports.getRooms = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const where = { isActive: true, ...buildHospitalFilter(req, scope, req.query.hospitalId) };
    const rooms = await Room.findAll({
      where,
      include: [HOSPITAL_INCLUDE],
      order: [['roomNumber', 'ASC']],
    });
    const ids = rooms.map(r => r.id);
    const occupancyCounts = await IPDAdmission.findAll({
      where: { roomId: ids, status: 'admitted' },
      attributes: ['roomId'],
    });
    const occMap = {};
    occupancyCounts.forEach(a => { occMap[a.roomId] = (occMap[a.roomId] || 0) + 1; });
    const result = rooms.map(r => ({ ...r.toJSON(), occupancy: occMap[r.id] || 0 }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user) ? (req.body.hospitalId || null) : scope.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });
    const { roomNumber, roomType, floor, totalBeds, pricePerDay, description } = req.body;
    if (!roomNumber) return res.status(400).json({ message: 'Room number is required' });
    const room = await Room.create({ hospitalId, roomNumber, roomType, floor, totalBeds, pricePerDay, description });
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!isSuperAdmin(req.user) && room.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await room.update(req.body);
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!isSuperAdmin(req.user) && room.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await room.update({ isActive: false });
    res.json({ message: 'Room deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────────

exports.getStats = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const last7Date = new Date();
    last7Date.setDate(last7Date.getDate() - 7);
    const last7Str = last7Date.toISOString().split('T')[0];
    const last30Date = new Date();
    last30Date.setDate(last30Date.getDate() - 30);
    const last30Str = last30Date.toISOString().split('T')[0];
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 3);
    const upcomingStr = upcomingDate.toISOString().split('T')[0];

    const hf = buildHospitalFilter(req, scope, req.query.hospitalId);
    const hospitalId = hf.hospitalId || null;

    const [totalAdmitted, dischargedToday, totalRooms, occupiedRooms, revenueThisMonth, gstCollected] = await Promise.all([
      IPDAdmission.count({ where: { ...hf, status: 'admitted' } }),
      IPDAdmission.count({ where: { ...hf, status: 'discharged', dischargeDate: todayStr } }),
      Room.count({ where: { ...hf, isActive: true } }),
      IPDAdmission.count({ where: { ...hf, status: 'admitted', roomId: { [Op.ne]: null } } }),
      IPDPayment.sum('amount', { where: { ...hf, paymentDate: { [Op.gte]: monthStart } } }),
      IPDBillItem.sum('gstAmount', { where: { ...hf, date: { [Op.gte]: monthStart } } }),
    ]);

    const pendingResult = await sequelize.query(
      `SELECT COALESCE(SUM("billedAmount" - "discountAmount" - "paidAmount"), 0) AS pending FROM "IPDAdmissions" WHERE status = 'admitted'${hospitalId ? ` AND "hospitalId" = '${hospitalId}'` : ''}`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const pendingDues = parseFloat(pendingResult[0]?.pending || 0);

    const [dischargesLast7, dischargesLast30, roomsWithAdmissions, recentDischarges, upcomingDischarges] = await Promise.all([
      IPDAdmission.count({
        where: {
          ...hf,
          status: 'discharged',
          dischargeDate: { [Op.between]: [last7Str, todayStr] },
        },
      }),
      IPDAdmission.count({
        where: {
          ...hf,
          status: 'discharged',
          dischargeDate: { [Op.gte]: last30Str },
        },
      }),
      Room.findAll({
        where: { ...hf, isActive: true },
        attributes: ['id', 'roomType', 'totalBeds'],
        include: [{
          model: IPDAdmission,
          as: 'admissions',
          attributes: ['id'],
          required: false,
          where: { status: 'admitted' },
        }],
      }),
      IPDAdmission.findAll({
        where: {
          ...hf,
          status: 'discharged',
          dischargeDate: { [Op.gte]: last30Str },
        },
        attributes: ['admissionDate', 'dischargeDate'],
        order: [['dischargeDate', 'DESC']],
        limit: 500,
      }),
      IPDAdmission.count({
        where: {
          ...hf,
          status: 'admitted',
          dischargeDate: { [Op.between]: [todayStr, upcomingStr] },
        },
      }),
    ]);

    let totalBeds = 0;
    const roomTypeMap = new Map();
    roomsWithAdmissions.forEach((room) => {
      const type = room.roomType || 'general';
      const beds = Number(room.totalBeds || 0);
      const occupied = (room.admissions || []).length;
      totalBeds += beds;
      if (!roomTypeMap.has(type)) {
        roomTypeMap.set(type, { roomType: type, rooms: 0, beds: 0, occupied: 0 });
      }
      const entry = roomTypeMap.get(type);
      entry.rooms += 1;
      entry.beds += beds;
      entry.occupied += occupied;
    });

    const roomTypeBreakdown = Array.from(roomTypeMap.values())
      .map((entry) => ({
        ...entry,
        utilizationPct: entry.beds ? Number(((entry.occupied / entry.beds) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.utilizationPct - a.utilizationPct);

    const availableBeds = Math.max(totalBeds - occupiedRooms, 0);
    const occupancyRate = totalBeds ? Number(((occupiedRooms / totalBeds) * 100).toFixed(1)) : 0;

    const stayDays = recentDischarges
      .map((row) => {
        if (!row.admissionDate || !row.dischargeDate) return null;
        const diff = new Date(row.dischargeDate) - new Date(row.admissionDate);
        return diff >= 0 ? diff / (1000 * 60 * 60 * 24) : null;
      })
      .filter((value) => typeof value === 'number' && !Number.isNaN(value));
    const averageStayDays = stayDays.length
      ? Number((stayDays.reduce((sum, value) => sum + value, 0) / stayDays.length).toFixed(1))
      : 0;

    const dischargesPerDay = Number((dischargesLast7 / 7).toFixed(1));

    res.json({
      totalAdmitted,
      dischargedToday,
      totalRooms,
      occupiedRooms,
      revenueThisMonth: parseFloat(revenueThisMonth || 0),
      pendingDues,
      gstCollected: parseFloat(gstCollected || 0),
      occupancyRate,
      totalBeds,
      availableBeds,
      dischargesLast7,
      dischargesLast30,
      dischargesPerDay,
      averageStayDays,
      upcomingDischarges,
      roomTypeBreakdown,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Admissions ───────────────────────────────────────────────────────────────

exports.getAdmissions = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { status, doctorId, patientId, from, to, hospitalId: qHospitalId } = req.query;
    const where = { ...buildHospitalFilter(req, scope, qHospitalId) };
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (from || to) {
      where.admissionDate = {};
      if (from) where.admissionDate[Op.gte] = from;
      if (to) where.admissionDate[Op.lte] = to;
    }

    // HOD logic: if not super_admin but HOD, filter by department
    if (!isSuperAdmin(req.user)) {
      const hodDeptId = await getHODDepartmentId(req.user);
      if (hodDeptId) {
        where['$doctor.departmentId$'] = hodDeptId;
      } else if (req.user.role === 'doctor') {
        // Regular doctor only sees their own
        if (!doctorId) where.doctorId = req.user.id;
      }
    }
      const pagination = getPaginationParams(req, { defaultPerPage: 20, forcePaginate: req.query.paginate !== 'false' });
      const baseOptions = {
        where,
        include: [
          { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone'] },
          { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization'] },
          { model: Room, as: 'room', attributes: ['id', 'roomNumber', 'roomType', 'floor'] },
          ...(isSuperAdmin(req.user) ? [HOSPITAL_INCLUDE] : []),
        ],
        order: [['admissionDate', 'DESC'], ['createdAt', 'DESC']],
      };
      if (pagination) {
        const queryOptions = applyPaginationOptions(baseOptions, pagination, { forceDistinct: true });
        const admissions = await IPDAdmission.findAndCountAll(queryOptions);
        return res.json({
          data: admissions.rows,
          meta: buildPaginationMeta(pagination, admissions.count),
        });
      }
      const admissions = await IPDAdmission.findAll(baseOptions);
      res.json(admissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAdmission = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'name', 'patientId', 'phone', 'dateOfBirth', 'gender', 'bloodGroup', 'allergies', 'address'] },
        { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'specialization', 'phone'] },
        { model: Room, as: 'room', attributes: ['id', 'roomNumber', 'roomType', 'floor', 'pricePerDay'] },
        HOSPITAL_INCLUDE,
        {
          model: IPDNote, as: 'ipdNotes',
          include: [
            { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
            { model: Nurse, as: 'nurse', attributes: ['id', 'name'] },
          ],
          order: [['noteDate', 'DESC']],
        },
        {
          model: NursePatientAssignment, as: 'nurseAssignments',
          include: [
            { model: Nurse, as: 'nurse', attributes: ['id', 'name'] },
            { model: Shift, as: 'shift', attributes: ['id', 'name'] },
          ],
          order: [['assignedAt', 'DESC']],
        },
        {
          model: Prescription, as: 'ipdPrescriptions',
          include: [
            { model: Medication, as: 'medication', attributes: ['id', 'name'] },
            { model: MedicationAdministration, as: 'administrations', include: [{ model: Nurse, as: 'nurse', attributes: ['id', 'name'] }] }
          ]
        },
      ],
    });
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(admission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.admitPatient = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user) ? (req.body.hospitalId || null) : scope.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

    const { patientId, doctorId, roomId, admissionDate, admissionType, admissionDiagnosis, notes, totalAmount } = req.body;
    if (!patientId || !doctorId || !admissionDate) {
      return res.status(400).json({ message: 'patientId, doctorId, and admissionDate are required' });
    }
    const [patient, doctor] = await Promise.all([
      Patient.findOne({ where: { id: patientId, hospitalId } }),
      Doctor.findOne({ where: { id: doctorId, hospitalId } }),
    ]);
    if (!patient) return res.status(404).json({ message: 'Patient not found in this hospital' });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found in this hospital' });
    if (roomId) {
      const room = await Room.findOne({ where: { id: roomId, hospitalId, isActive: true } });
      if (!room) return res.status(404).json({ message: 'Room not found or inactive' });
      const occupancy = await IPDAdmission.count({ where: { roomId, status: 'admitted' } });
      if (occupancy >= Number(room.totalBeds || 0)) {
        return res.status(400).json({ message: `Room is full (${occupancy}/${room.totalBeds} beds occupied)` });
      }
    }
    const admission = await IPDAdmission.create({
      patientId, doctorId, hospitalId, roomId: roomId || null,
      admissionDate, admissionType, admissionDiagnosis, notes,
      totalAmount: totalAmount || 0,
    });
    res.status(201).json(admission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAdmission = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await admission.update(req.body);
    res.json(admission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.dischargePatient = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (admission.status === 'discharged') return res.status(400).json({ message: 'Patient already discharged' });
    const { dischargeDate, finalDiagnosis, conditionAtDischarge, dischargeNotes, totalAmount, paidAmount, isPaid } = req.body;
    await admission.update({
      status: 'discharged',
      dischargeDate: dischargeDate || new Date().toISOString().slice(0, 10),
      finalDiagnosis, conditionAtDischarge, dischargeNotes,
      totalAmount: totalAmount !== undefined ? totalAmount : admission.totalAmount,
      paidAmount: paidAmount !== undefined ? paidAmount : admission.paidAmount,
      isPaid: isPaid !== undefined ? isPaid : admission.isPaid,
    });
    res.json(admission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addNote = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { noteType, content, noteDate } = req.body;
    if (!content) return res.status(400).json({ message: 'Note content is required' });
    
    let doctorId = req.body.doctorId;
    let nurseId = req.body.nurseId;

    if (!doctorId && !nurseId) {
      if (req.user.role === 'doctor') {
        const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
        if (doctor) doctorId = doctor.id;
      } else if (req.user.role === 'nurse') {
        const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
        if (nurse) nurseId = nurse.id;
      }
    }

    if (!doctorId && !nurseId) return res.status(400).json({ message: 'doctorId or nurseId is required' });

    const note = await IPDNote.create({
      admissionId: admission.id, doctorId, nurseId, noteType, content,
      noteDate: noteDate || new Date(),
    });
    const withDetails = await IPDNote.findByPk(note.id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
        { model: Nurse, as: 'nurse', attributes: ['id', 'name'] },
      ],
    });
    res.status(201).json(withDetails);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Billing ───────────────────────────────────────────────────────────────────

exports.getBill = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [billItems, payments] = await Promise.all([
      IPDBillItem.findAll({
        where: { admissionId: admission.id },
        include: [{ model: PatientPackage, as: 'package', attributes: ['id', 'purchaseAmount', 'status'] }],
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
      }),
      IPDPayment.findAll({
        where: { admissionId: admission.id },
        include: [{ model: User, as: 'recordedBy', attributes: ['id', 'name'] }],
        order: [['paymentDate', 'ASC'], ['createdAt', 'ASC']],
      }),
    ]);

    const subtotal = billItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const gstTotal = billItems.reduce((s, i) => s + parseFloat(i.gstAmount || 0), 0);
    const billedAmount = subtotal + gstTotal;
    const paidAmount = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const discountAmount = parseFloat(admission.discountAmount || 0);
    const balance = billedAmount - discountAmount - paidAmount;
    const paymentStatus = billedAmount > 0 && paidAmount >= (billedAmount - discountAmount) ? 'paid'
                        : paidAmount > 0 ? 'partial' : 'pending';

    res.json({
      billItems,
      payments,
      summary: { subtotal, gstTotal, billedAmount, discountAmount, paidAmount, balance, paymentStatus },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addBillItem = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { itemType, description, quantity, unitPrice, gstRate, isPackageCovered, packageId, date, notes } = req.body;
    if (!description) return res.status(400).json({ message: 'Description is required' });

    const qty = parseFloat(quantity) || 1;
    const price = parseFloat(unitPrice) || 0;
    const rate = parseFloat(gstRate) || 0;
    const amount = parseFloat((qty * price).toFixed(2));
    const gstAmount = parseFloat((amount * rate / 100).toFixed(2));
    const totalWithGst = parseFloat((amount + gstAmount).toFixed(2));

    const item = await IPDBillItem.create({
      admissionId: admission.id,
      hospitalId: admission.hospitalId,
      itemType: itemType || 'other',
      description, quantity: qty, unitPrice: price, amount,
      gstRate: rate, gstAmount, totalWithGst,
      isPackageCovered: !!isPackageCovered,
      packageId: packageId || null,
      date: date || new Date().toISOString().slice(0, 10),
      notes,
    });

    // If linked to a package, record usage in usageHistory
    if (packageId) {
      const pkg = await PatientPackage.findByPk(packageId);
      if (pkg) {
        const history = Array.isArray(pkg.usageHistory) ? pkg.usageHistory : [];
        history.push({ date: item.date, description, admissionId: admission.id, billItemId: item.id });
        await pkg.update({ usageHistory: history, usedVisits: pkg.usedVisits + 1 });
      }
    }

    await recalculateBilling(admission.id);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBillItem = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const item = await IPDBillItem.findOne({ where: { id: req.params.itemId, admissionId: admission.id } });
    if (!item) return res.status(404).json({ message: 'Bill item not found' });

    const qty = parseFloat(req.body.quantity ?? item.quantity);
    const price = parseFloat(req.body.unitPrice ?? item.unitPrice);
    const rate = parseFloat(req.body.gstRate ?? item.gstRate);
    const amount = parseFloat((qty * price).toFixed(2));
    const gstAmount = parseFloat((amount * rate / 100).toFixed(2));
    const totalWithGst = parseFloat((amount + gstAmount).toFixed(2));

    await item.update({ ...req.body, quantity: qty, unitPrice: price, gstRate: rate, amount, gstAmount, totalWithGst });
    await recalculateBilling(admission.id);
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBillItem = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const item = await IPDBillItem.findOne({ where: { id: req.params.itemId, admissionId: admission.id } });
    if (!item) return res.status(404).json({ message: 'Bill item not found' });
    await item.destroy();
    await recalculateBilling(admission.id);
    res.json({ message: 'Bill item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { amount, paymentMethod, referenceNumber, paymentDate, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: 'Valid amount is required' });

    const payment = await IPDPayment.create({
      admissionId: admission.id,
      hospitalId: admission.hospitalId,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'cash',
      referenceNumber: referenceNumber || null,
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      notes,
      createdByUserId: req.user.id,
    });

    await recalculateBilling(admission.id);
    const withUser = await IPDPayment.findByPk(payment.id, {
      include: [{ model: User, as: 'recordedBy', attributes: ['id', 'name'] }],
    });
    res.status(201).json(withUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const payment = await IPDPayment.findOne({ where: { id: req.params.paymentId, admissionId: admission.id } });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    await payment.destroy();
    await recalculateBilling(admission.id);
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateDiscount = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { discountAmount } = req.body;
    const parsed = parseFloat(discountAmount) || 0;
    if (parsed < 0) return res.status(400).json({ message: 'Discount cannot be negative' });

    await admission.update({ discountAmount: parsed });
    const billing = await recalculateBilling(admission.id);
    res.json({ message: 'Discount updated', ...billing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- Nurse Assignments ---

exports.assignNurse = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { nurseId, shiftId, doctorId } = req.body;
    if (!nurseId) return res.status(400).json({ message: 'nurseId is required' });

    const nurse = await Nurse.findByPk(nurseId);
    if (!nurse || nurse.hospitalId !== admission.hospitalId) {
      return res.status(400).json({ message: 'Invalid nurse for this hospital' });
    }

    const assignment = await NursePatientAssignment.create({
      nurseId,
      admissionId: admission.id,
      shiftId: shiftId || null,
      doctorId: doctorId || null,
      assignedAt: new Date(),
    });

    const withDetails = await NursePatientAssignment.findByPk(assignment.id, {
      include: [
        { model: Nurse, as: 'nurse', attributes: ['id', 'name'] },
        { model: Shift, as: 'shift', attributes: ['id', 'name'] },
      ],
    });

    res.status(201).json(withDetails);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeNurseAssignment = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const assignment = await NursePatientAssignment.findByPk(req.params.assignmentId, {
      include: [{ model: IPDAdmission, as: 'admission' }]
    });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (!isSuperAdmin(req.user) && assignment.admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await assignment.update({ removedAt: new Date() });
    res.json({ message: 'Nurse unassigned' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getNursingHistory = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const admission = await IPDAdmission.findByPk(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!isSuperAdmin(req.user) && admission.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const assignments = await NursePatientAssignment.findAll({
      where: { admissionId: admission.id },
      include: [
        { model: Nurse, as: 'nurse', attributes: ['id', 'name', 'specialization'] },
        { model: Shift, as: 'shift', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
      ],
      order: [['assignedAt', 'DESC']],
    });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
