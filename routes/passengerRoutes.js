const express = require('express');
const router = express.Router();
const passengerController = require('../controllers/passengerController');

router.post('/', passengerController.createOrGetPassenger);
router.get('/', passengerController.getAllPassengers);
router.get('/:id', passengerController.getPassengerById);

module.exports = router;
