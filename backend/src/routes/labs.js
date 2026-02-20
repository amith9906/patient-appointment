const router = require('express').Router();
const c = require('../controllers/labController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Labs
router.get('/', c.getAllLabs);
router.post('/', c.createLab);
router.put('/:id', c.updateLab);
router.delete('/:id', c.deleteLab);

// Lab Tests
router.get('/tests', c.getAllTests);
router.get('/tests/:id', c.getOneTest);
router.post('/tests', c.createTest);
router.put('/tests/:id', c.updateTest);
router.delete('/tests/:id', c.deleteTest);

module.exports = router;
