const express = require('express');
const router = express.Router();
const nurseController = require('../controllers/nurseController');
const { authenticate: protect } = require('../middleware/auth');

router.use(protect);

router.get('/me', nurseController.getMe);
router.get('/dashboard', nurseController.getDashboard);
router.get('/', nurseController.getAll);
router.get('/:id', nurseController.getOne);
router.post('/', nurseController.create);
router.put('/:id', nurseController.update);
router.delete('/:id', nurseController.delete);

module.exports = router;
