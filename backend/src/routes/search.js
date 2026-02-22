const router = require('express').Router();
const { globalSearch } = require('../controllers/searchController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('super_admin', 'admin', 'receptionist', 'doctor'), globalSearch);

module.exports = router;
