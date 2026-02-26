const { Shift, NurseShiftAssignment, Nurse, Hospital, sequelize } = require('../models');
const { ensureScopedHospital, isSuperAdmin } = require('../utils/accessScope');
const { Op } = require('sequelize');
const { getHODDepartmentId } = require('../utils/accessScope');
const XLSX = require('xlsx');

// --- Shifts ---

exports.getAllShifts = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const where = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };
    const shifts = await Shift.findAll({ where, order: [['startTime', 'ASC']] });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createShift = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const hospitalId = isSuperAdmin(req.user) ? (req.body.hospitalId || scope.hospitalId) : scope.hospitalId;
    const shift = await Shift.create({ ...req.body, hospitalId });
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateShift = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const shift = await Shift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (!isSuperAdmin(req.user) && shift.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await shift.update(req.body);
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteShift = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const shift = await Shift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (!isSuperAdmin(req.user) && shift.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await shift.destroy();
    res.json({ message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- Shift Assignments ---

exports.getAssignments = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { date, nurseId, workArea } = req.query;
    const where = {};
    const nurseWhere = isSuperAdmin(req.user) ? {} : { hospitalId: scope.hospitalId };

    if (date) where.date = date;
    if (nurseId) where.nurseId = nurseId;
    if (workArea) where.workArea = workArea;

    const assignments = await NurseShiftAssignment.findAll({
      where,
      include: [
        { model: Nurse, as: 'nurse', where: nurseWhere, attributes: ['id', 'name'] },
        { model: Shift, as: 'shift', attributes: ['id', 'name', 'startTime', 'endTime'] },
      ],
      order: [['date', 'DESC'], [{ model: Shift, as: 'shift' }, 'startTime', 'ASC']],
    });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.assignShift = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { nurseId, shiftId, date, workArea, notes } = req.body;
    if (!nurseId || !shiftId || !date) {
      return res.status(400).json({ message: 'nurseId, shiftId, and date are required' });
    }

    // Verify nurse belongs to hospital
    const nurse = await Nurse.findByPk(nurseId);
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });
    if (!isSuperAdmin(req.user) && nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check for existing assignment
    const existing = await NurseShiftAssignment.findOne({ where: { nurseId, date, shiftId } });
    if (existing) return res.status(400).json({ message: 'Nurse already assigned to this shift on this date' });

    const assignment = await NurseShiftAssignment.create({ nurseId, shiftId, date, workArea, notes });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Bulk assign: nurseIds (array) or single nurseId, fromDate, toDate
exports.bulkAssign = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { nurseIds, nurseId, shiftId, fromDate, toDate, workArea, notes } = req.body;
    const ids = Array.isArray(nurseIds) && nurseIds.length ? nurseIds : (nurseId ? [nurseId] : []);
    if (!ids.length || !shiftId || !fromDate || !toDate) {
      return res.status(400).json({ message: 'nurseIds, shiftId, fromDate and toDate are required' });
    }

    // Verify nurses
    const nurses = await Nurse.findAll({ where: { id: ids } });
    if (nurses.length !== ids.length) return res.status(404).json({ message: 'One or more nurses not found' });

    // HOD check: allow HOD to assign only within their department (if applicable)
    const hodDeptId = await getHODDepartmentId(req.user);
    if (!isSuperAdmin(req.user) && hodDeptId) {
      const invalid = nurses.find(n => String(n.departmentId) !== String(hodDeptId));
      if (invalid) return res.status(403).json({ message: 'HOD can only assign nurses from their department' });
    } else if (!isSuperAdmin(req.user)) {
      const invalid = nurses.find(n => n.hospitalId !== scope.hospitalId);
      if (invalid) return res.status(403).json({ message: 'Access denied for one or more nurses' });
    }

    // iterate dates
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start) || isNaN(end) || start > end) return res.status(400).json({ message: 'Invalid date range' });

    const created = [];
    await sequelize.transaction(async (t) => {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        for (const nid of ids) {
          const exists = await NurseShiftAssignment.findOne({ where: { nurseId: nid, date: dateStr, shiftId } , transaction: t});
          if (exists) continue;
          const a = await NurseShiftAssignment.create({ nurseId: nid, shiftId, date: dateStr, workArea, notes }, { transaction: t });
          created.push(a);
        }
      }
    });

    res.status(201).json({ createdCount: created.length, created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Clone last week's assignments into target range (targetFrom -> targetTo)
exports.cloneLastWeek = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const { targetFrom, targetTo, nurseIds } = req.body;
    if (!targetFrom || !targetTo) return res.status(400).json({ message: 'targetFrom and targetTo are required' });

    const tFrom = new Date(targetFrom);
    const tTo = new Date(targetTo);
    if (isNaN(tFrom) || isNaN(tTo) || tFrom > tTo) return res.status(400).json({ message: 'Invalid target range' });

    // source = target - 7 days
    const sFrom = new Date(tFrom); sFrom.setDate(sFrom.getDate() - 7);
    const sTo = new Date(tTo); sTo.setDate(sTo.getDate() - 7);
    const sFromStr = sFrom.toISOString().split('T')[0];
    const sToStr = sTo.toISOString().split('T')[0];

    const nurseFilter = Array.isArray(nurseIds) && nurseIds.length ? { nurseId: nurseIds } : {};

    const sourceAssignments = await NurseShiftAssignment.findAll({
      where: {
        date: { [Op.between]: [sFromStr, sToStr] },
        ...nurseFilter,
      },
      include: [{ model: Nurse, as: 'nurse' }]
    });

    if (!sourceAssignments.length) return res.status(404).json({ message: 'No assignments found in source week' });

    // Permission checks similar to bulkAssign
    const hodDeptId = await getHODDepartmentId(req.user);
    if (!isSuperAdmin(req.user) && hodDeptId) {
      const invalid = sourceAssignments.find(a => String(a.nurse.departmentId) !== String(hodDeptId));
      if (invalid) return res.status(403).json({ message: 'HOD can only clone assignments for their department' });
    }

    const created = [];
    await sequelize.transaction(async (t) => {
      for (const a of sourceAssignments) {
        const srcDate = new Date(a.date);
        const delta = (tFrom - sFrom); // difference between starts
        const targetDate = new Date(srcDate.getTime() + delta);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const exists = await NurseShiftAssignment.findOne({ where: { nurseId: a.nurseId, date: targetDateStr, shiftId: a.shiftId }, transaction: t });
        if (exists) continue;
        const copy = await NurseShiftAssignment.create({ nurseId: a.nurseId, shiftId: a.shiftId, date: targetDateStr, workArea: a.workArea, notes: a.notes }, { transaction: t });
        created.push(copy);
      }
    });

    res.status(201).json({ createdCount: created.length, created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Upload CSV/Excel with rows: nurseId|nurseEmail, shiftId|shiftName, fromDate, toDate, workArea, notes
exports.uploadAssignments = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    if (!req.file) return res.status(400).json({ message: 'File is required' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rows || !rows.length) return res.status(400).json({ message: 'No rows found in file' });

    const created = [];
    const errors = [];

    await sequelize.transaction(async (t) => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const nurseId = r.nurseId || r.nurseID || r.NurseId || null;
        const nurseEmail = r.email || r.nurseEmail || r.NurseEmail || null;
        const shiftId = r.shiftId || r.shiftID || r.shift || r.ShiftId || null;
        const shiftName = r.shiftName || r.shift_name || r.ShiftName || null;
        const fromDate = r.fromDate || r.from || r.From || r.startDate || null;
        const toDate = r.toDate || r.to || r.To || r.endDate || null;
        const workArea = r.workArea || r.work_area || r.work || r.WorkArea || null;
        const notes = r.notes || r.note || r.Notes || '';

        let resolvedNurseId = null;
        try {
          if (nurseId) {
            const n = await Nurse.findByPk(nurseId, { transaction: t });
            if (!n) throw new Error('Nurse not found by id');
            resolvedNurseId = n.id;
            if (!isSuperAdmin(req.user) && n.hospitalId !== scope.hospitalId) throw new Error('Access denied for nurse');
          } else if (nurseEmail) {
            const n = await Nurse.findOne({ where: { email: nurseEmail }, transaction: t });
            if (!n) throw new Error('Nurse not found by email');
            resolvedNurseId = n.id;
            if (!isSuperAdmin(req.user) && n.hospitalId !== scope.hospitalId) throw new Error('Access denied for nurse');
          } else {
            throw new Error('nurseId or nurseEmail required');
          }
        } catch (e) {
          errors.push({ row: i + 2, error: e.message });
          continue;
        }

        // resolve shift
        let resolvedShiftId = null;
        try {
          if (shiftId) {
            const s = await Shift.findByPk(shiftId, { transaction: t });
            if (!s) throw new Error('Shift not found by id');
            resolvedShiftId = s.id;
            if (!isSuperAdmin(req.user) && s.hospitalId !== scope.hospitalId) throw new Error('Access denied for shift');
          } else if (shiftName) {
            const s = await Shift.findOne({ where: { name: shiftName, hospitalId: scope.hospitalId }, transaction: t });
            if (!s) throw new Error('Shift not found by name');
            resolvedShiftId = s.id;
          } else {
            throw new Error('shiftId or shiftName required');
          }
        } catch (e) {
          errors.push({ row: i + 2, error: e.message });
          continue;
        }

        // date range
        const start = new Date(fromDate);
        const end = new Date(toDate);
        if (isNaN(start) || isNaN(end) || start > end) {
          errors.push({ row: i + 2, error: 'Invalid date range' });
          continue;
        }

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const exists = await NurseShiftAssignment.findOne({ where: { nurseId: resolvedNurseId, date: dateStr, shiftId: resolvedShiftId }, transaction: t });
          if (exists) continue;
          const a = await NurseShiftAssignment.create({ nurseId: resolvedNurseId, shiftId: resolvedShiftId, date: dateStr, workArea: workArea || null, notes }, { transaction: t });
          created.push(a);
        }
      }
    });

    res.status(201).json({ createdCount: created.length, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeAssignment = async (req, res) => {
  try {
    const scope = await ensureScopedHospital(req, res);
    if (!scope.allowed) return;

    const assignment = await NurseShiftAssignment.findByPk(req.params.id, {
      include: [{ model: Nurse, as: 'nurse' }]
    });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (!isSuperAdmin(req.user) && assignment.nurse.hospitalId !== scope.hospitalId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await assignment.destroy();
    res.json({ message: 'Assignment removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
