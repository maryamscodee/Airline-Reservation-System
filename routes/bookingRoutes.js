const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Booking operations
router.post('/', bookingController.createBooking);
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
