const { PatientPackage } = require('../models');

const ensurePackageAssignable = async (assignmentId, patientId, hospitalId) => {
  if (!assignmentId) return null;
  const assignment = await PatientPackage.findByPk(assignmentId);
  if (!assignment) throw new Error('Package assignment not found');
  if (assignment.patientId !== patientId) {
    throw new Error('Package assignment does not belong to the patient');
  }
  if (hospitalId && assignment.hospitalId !== hospitalId) {
    throw new Error('Package assignment belongs to a different hospital');
  }
  if (assignment.status !== 'active') {
    throw new Error('Package assignment is not active');
  }
  if (assignment.expiryDate && new Date(assignment.expiryDate) < new Date()) {
    throw new Error('Package has expired');
  }
  const remaining = Number(assignment.totalVisits || 0) - Number(assignment.usedVisits || 0);
  if (remaining <= 0) {
    throw new Error('Package assignment has no remaining visits');
  }
  return assignment;
};

module.exports = { ensurePackageAssignable };
