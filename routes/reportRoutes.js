const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Aggregation Pipeline Reports
router.get('/bookings-per-flight', reportController.reportBookingsPerFlight);
router.get('/popular-routes', reportController.reportPopularRoutes);
router.get('/booking-status', reportController.reportBookingStatus);
router.get('/revenue', reportController.reportRevenue);

module.exports = router;
