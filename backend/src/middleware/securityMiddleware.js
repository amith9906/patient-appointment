'use strict';

const { DataAccessLog, AccessViolation } = require('../models');

/**
 * HIPAA & ABDM Compliant Security Middleware
 * Logs patient record accesses and catches unauthenticated / unauthorized access attempts.
 */
async function auditPatientAccess(req, res, next) {
  res.on('finish', async () => {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.params.patientId) {
      try {
        await DataAccessLog.create({
          hospitalId: req.user?.hospitalId || 1,
          userId: req.user?.id || 0,
          patientId: Number(req.params.patientId),
          accessedFields: ['demographics', 'vitals', 'prescriptions'],
          purpose: 'CLINICAL_TREATMENT'
        });
      } catch (err) {
        console.error('Failed to write DataAccessLog:', err);
      }
    }
  });
  next();
}

function enforceRBAC(allowedRoles = []) {
  return async (req, res, next) => {
    const userRole = req.user?.role;
    if (!allowedRoles.includes(userRole)) {
      try {
        await AccessViolation.create({
          hospitalId: req.user?.hospitalId || 1,
          userId: req.user?.id || 0,
          attemptedPath: req.originalUrl,
          requiredRole: allowedRoles.join(','),
          actualRole: userRole || 'GUEST',
          ipAddress: req.ip
        });
      } catch (err) {
        console.error('Failed to record AccessViolation:', err);
      }

      return res.status(403).json({ message: 'Access Denied: Insufficient Role Privileges.' });
    }
    next();
  };
}

module.exports = {
  auditPatientAccess,
  enforceRBAC
};
