const router = require('express').Router();
const c = require('../controllers/labReportTemplateController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/',      authorize('super_admin', 'admin', 'doctor', 'lab_technician'), c.getAll);
router.get('/:id',   authorize('super_admin', 'admin', 'doctor', 'lab_technician'), c.getOne);
router.post('/',     authorize('super_admin', 'admin'), c.create);
router.put('/:id',   authorize('super_admin', 'admin'), c.update);
router.delete('/:id',authorize('super_admin', 'admin'), c.delete);

module.exports = router;
