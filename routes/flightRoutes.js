const express = require('express');
const router = express.Router();
const flightController = require('../controllers/flightController');
const { requireAdminAuth } = require('../middleware/auth');

// Distinct cities for search autocomplete/dropdowns (Passenger accessible)
router.get('/meta/cities', flightController.getDistinctCities);

// Public Flight Search & Detail Retrieval (Passenger accessible)
router.get('/', flightController.getFlights);
router.get('/:id', flightController.getFlightById);

// Restricted Administrative Flight Modifications (Admin Only)
router.post('/', requireAdminAuth, flightController.createFlight);
router.put('/:id', requireAdminAuth, flightController.updateFlight);
router.delete('/:id', requireAdminAuth, flightController.deleteFlight);

module.exports = router;
