const router = require('express').Router();
const c = require('../controllers/hospitalController');
const sc = require('../controllers/hospitalSettingsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', c.getAll);
router.get('/:id/stats', c.getStats);
router.get('/:id/settings', sc.getSettings);
router.put('/:id/settings', authorize('super_admin', 'admin'), sc.updateSettings);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;
