/**
 * Passenger Controller
 * 
 * Demonstrates:
 * - CRUD operations for passengers collection
 * - Email validation and uniqueness check
 * - Document retrieval by unique email and ObjectId
 */

const { ObjectId } = require('mongodb');
const { getPassengersCollection } = require('../config/db');

// Basic RFC 5322 compatible email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/passengers
 * Create a new passenger or return existing one by email
 */
async function createOrGetPassenger(req, res) {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone number are all required.'
      });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.'
      });
    }

    const passengersColl = getPassengersCollection();
    const cleanEmail = email.trim().toLowerCase();

    // Check if passenger already exists
    let passenger = await passengersColl.findOne({ email: cleanEmail });

    if (!passenger) {
      const newPassenger = {
        _id: new ObjectId(),
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        created_at: new Date()
      };
      await passengersColl.insertOne(newPassenger);
      passenger = newPassenger;
    }

    return res.status(200).json({
      success: true,
      message: 'Passenger registered/found successfully.',
      data: passenger
    });
  } catch (error) {
    console.error('Error handling passenger:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process passenger.',
      error: error.message
    });
  }
}

/**
 * GET /api/passengers/:id
 */
async function getPassengerById(req, res) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid passenger ID format.'
      });
    }

    const passengersColl = getPassengersCollection();
    const passenger = await passengersColl.findOne({ _id: new ObjectId(id) });

    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Passenger not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: passenger
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve passenger.',
      error: error.message
    });
  }
}

/**
 * GET /api/passengers
 */
async function getAllPassengers(req, res) {
  try {
    const passengersColl = getPassengersCollection();
    const limit = Number(req.query.limit) || 100;
    const passengers = await passengersColl.find().sort({ created_at: -1 }).limit(limit).toArray();

    return res.status(200).json({
      success: true,
      count: passengers.length,
      data: passengers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve passengers.',
      error: error.message
    });
  }
}

module.exports = {
  createOrGetPassenger,
  getPassengerById,
  getAllPassengers
};
