const router = require('express').Router();
const c = require('../controllers/medicationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.patch('/:id/stock', c.updateStock);
router.delete('/:id', c.delete);

module.exports = router;
