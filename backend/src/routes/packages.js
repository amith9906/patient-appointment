const router = require('express').Router();
const c = require('../controllers/packageController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/plans', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getPlans);
router.post('/plans', authorize('super_admin', 'admin', 'receptionist'), c.createPlan);
router.put('/plans/:id', authorize('super_admin', 'admin', 'receptionist'), c.updatePlan);

router.get('/analytics', authorize('super_admin', 'admin', 'receptionist'), c.getAnalytics);
router.get('/usage-log', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getUsageLog);
router.get('/recommendation', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getRecommendation);
router.post('/assignments', authorize('super_admin', 'admin', 'receptionist'), c.assignToPatient);
router.patch('/assignments/:id/consume', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.consumeVisit);
router.patch('/assignments/:id/status', authorize('super_admin', 'admin', 'receptionist'), c.updateAssignmentStatus);
router.get('/patients/:patientId/assignments', authorize('super_admin', 'admin', 'receptionist', 'doctor'), c.getPatientAssignments);

module.exports = router;
