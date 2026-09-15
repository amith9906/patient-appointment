const router = require('express').Router();
const c = require('../controllers/publicDoctorController');

// Public Doctor Booking Routes (No Authentication Required)
router.get('/doctors/:slug', c.getDoctorBySlug);
router.post('/doctors/:slug/book', c.submitPublicBooking);

module.exports = router;
