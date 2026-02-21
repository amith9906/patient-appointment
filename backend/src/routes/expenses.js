const router = require('express').Router();
const c = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/analytics', authorize('super_admin', 'admin'), c.getAnalytics);
router.get('/',          authorize('super_admin', 'admin'), c.getAll);
router.post('/',         authorize('super_admin', 'admin'), c.create);
router.put('/:id',       authorize('super_admin', 'admin'), c.update);
router.delete('/:id',    authorize('super_admin', 'admin'), c.delete);

module.exports = router;
