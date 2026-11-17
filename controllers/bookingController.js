/**
 * Booking Controller
 * 
 * Demonstrates:
 * - MongoDB ACID multi-document Transactions (Requirement 8 & 9)
 * - Session handling (client.startSession()) and automatic rollback on error
 * - Referential document relationships (passenger_id, flight_id)
 * - $lookup joins for booking retrieval
 * - Seat inventory consistency and concurrency protection
 */

const { ObjectId } = require('mongodb');
const {
  getClient,
  getDB,
  isReplicaSet,
  getFlightsCollection,
  getPassengersCollection,
  getBookingsCollection
} = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper to generate a unique human-friendly booking reference
 * Format: AR-2026-XXXXX (e.g. AR-2026-00125)
 */
function generateBookingReference() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `AR-${year}-${randomNum}`;
}

/**
 * POST /api/bookings
 * Create a new flight booking with transaction safety
 */
async function createBooking(req, res) {
  const {
    flight_id,
    name,
    email,
    phone,
    number_of_seats
  } = req.body;

  // 1. Validation
  if (!flight_id || !name || !email || !phone || !number_of_seats) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required: flight_id, name, email, phone, number_of_seats.'
    });
  }

  if (!ObjectId.isValid(flight_id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid flight ID format.'
    });
  }

  const seatsToBook = parseInt(number_of_seats, 10);
  if (isNaN(seatsToBook) || seatsToBook <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Number of seats must be a positive integer (at least 1).'
    });
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address format.'
    });
  }

  const client = getClient();
  const db = getDB();
  const flightsColl = getFlightsCollection();
  const passengersColl = getPassengersCollection();
  const bookingsColl = getBookingsCollection();

  const flightObjId = new ObjectId(flight_id);
  const cleanEmail = email.trim().toLowerCase();

  // 2. Execution with MongoDB Transaction (Replica Set mode)
  if (isReplicaSet()) {
    const session = client.startSession();
    try {
      let createdBooking = null;

      await session.withTransaction(async () => {
        // Step A: Check flight availability within transaction
        const flight = await flightsColl.findOne({ _id: flightObjId }, { session });
        if (!flight) {
          throw new Error('Flight not found.');
        }

        if (flight.status === 'Cancelled' || flight.status === 'Departed') {
          throw new Error(`Cannot book seats. Flight status is '${flight.status}'.`);
        }

        if (flight.available_seats < seatsToBook) {
          throw new Error(`Insufficient seats available. Requested: ${seatsToBook}, Available: ${flight.available_seats}`);
        }

        // Step B: Atomically decrement available seats with conditional guard
        const updateFlightResult = await flightsColl.updateOne(
          {
            _id: flightObjId,
            available_seats: { $gte: seatsToBook }
          },
          {
            $inc: { available_seats: -seatsToBook }
          },
          { session }
        );

        if (updateFlightResult.modifiedCount === 0) {
          throw new Error('Could not reserve seats due to concurrent booking. Please try again.');
        }

        // Step C: Find or insert passenger record
        let passenger = await passengersColl.findOne({ email: cleanEmail }, { session });
        let passengerId;

        if (!passenger) {
          const newPassenger = {
            _id: new ObjectId(),
            name: name.trim(),
            email: cleanEmail,
            phone: phone.trim(),
            created_at: new Date()
          };
          await passengersColl.insertOne(newPassenger, { session });
          passengerId = newPassenger._id;
        } else {
          passengerId = passenger._id;
        }

        // Step D: Insert booking record
        const bookingReference = generateBookingReference();
        const totalAmount = flight.ticket_price * seatsToBook;

        createdBooking = {
          _id: new ObjectId(),
          booking_reference: bookingReference,
          passenger_id: passengerId,
          flight_id: flightObjId,
          booking_date: new Date(),
          number_of_seats: seatsToBook,
          total_amount: totalAmount,
          status: 'Confirmed'
        };

        await bookingsColl.insertOne(createdBooking, { session });
      });

      return res.status(201).json({
        success: true,
        message: 'Booking confirmed successfully (committed via MongoDB transaction).',
        transactionMode: 'ReplicaSet_ACID_Transaction',
        data: createdBooking
      });
    } catch (txError) {
      console.error('Transaction aborted during booking:', txError.message);
      return res.status(400).json({
        success: false,
        message: txError.message || 'Failed to complete booking transaction.'
      });
    } finally {
      await session.endSession();
    }
  }

  // 3. Standalone MongoDB Fallback (Atomic conditional decrement + compensation rollback)
  // Ensures university students running standalone mongod can test without replica set errors
  try {
    const flight = await flightsColl.findOne({ _id: flightObjId });
    if (!flight) {
      return res.status(404).json({ success: false, message: 'Flight not found.' });
    }

    if (flight.status === 'Cancelled' || flight.status === 'Departed') {
      return res.status(400).json({ success: false, message: `Cannot book seats. Flight is '${flight.status}'.` });
    }

    if (flight.available_seats < seatsToBook) {
      return res.status(400).json({
        success: false,
        message: `Insufficient seats available. Requested: ${seatsToBook}, Available: ${flight.available_seats}`
      });
    }

    // Atomic conditional decrement ($gte ensures no overselling)
    const updateResult = await flightsColl.updateOne(
      { _id: flightObjId, available_seats: { $gte: seatsToBook } },
      { $inc: { available_seats: -seatsToBook } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not reserve seats due to concurrent booking. Please try again.'
      });
    }

    // Handle passenger and booking creation with catch-block rollback
    try {
      let passenger = await passengersColl.findOne({ email: cleanEmail });
      let passengerId;

      if (!passenger) {
        const newPassenger = {
          _id: new ObjectId(),
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          created_at: new Date()
        };
        await passengersColl.insertOne(newPassenger);
        passengerId = newPassenger._id;
      } else {
        passengerId = passenger._id;
      }

      const bookingReference = generateBookingReference();
      const totalAmount = flight.ticket_price * seatsToBook;

      const createdBooking = {
        _id: new ObjectId(),
        booking_reference: bookingReference,
        passenger_id: passengerId,
        flight_id: flightObjId,
        booking_date: new Date(),
        number_of_seats: seatsToBook,
        total_amount: totalAmount,
        status: 'Confirmed'
      };

      await bookingsColl.insertOne(createdBooking);

      return res.status(201).json({
        success: true,
        message: 'Booking confirmed successfully.',
        transactionMode: 'Standalone_Atomic_Compensation',
        data: createdBooking
      });
    } catch (insertError) {
      // Rollback compensation: return seats to flight
      await flightsColl.updateOne(
        { _id: flightObjId },
        { $inc: { available_seats: seatsToBook } }
      );
      throw insertError;
    }
  } catch (error) {
    console.error('Error in booking operation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process booking.',
      error: error.message
    });
  }
}

/**
 * POST /api/bookings/:id/cancel
 * Cancel a booking and restore flight seats atomically
 */
async function cancelBooking(req, res) {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID format.'
    });
  }

  const client = getClient();
  const db = getDB();
  const flightsColl = getFlightsCollection();
  const bookingsColl = getBookingsCollection();
  const bookingObjId = new ObjectId(id);

  // 1. Replica Set Transaction Mode
  if (isReplicaSet()) {
    const session = client.startSession();
    try {
      let updatedBooking = null;

      await session.withTransaction(async () => {
        const booking = await bookingsColl.findOne({ _id: bookingObjId }, { session });
        if (!booking) {
          throw new Error('Booking not found.');
        }

        if (booking.status === 'Cancelled') {
          throw new Error(`Booking ${booking.booking_reference} is already cancelled. Cannot cancel again.`);
        }

        // Update booking status
        await bookingsColl.updateOne(
          { _id: bookingObjId },
          { $set: { status: 'Cancelled', cancelled_at: new Date() } },
          { session }
        );

        // Return seats to flight
        await flightsColl.updateOne(
          { _id: booking.flight_id },
          { $inc: { available_seats: booking.number_of_seats } },
          { session }
        );

        updatedBooking = { ...booking, status: 'Cancelled' };
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${updatedBooking.booking_reference} has been cancelled and ${updatedBooking.number_of_seats} seat(s) returned to flight inventory.`,
        transactionMode: 'ReplicaSet_ACID_Transaction',
        data: updatedBooking
      });
    } catch (txError) {
      return res.status(400).json({
        success: false,
        message: txError.message
      });
    } finally {
      await session.endSession();
    }
  }

  // 2. Standalone Fallback with Status Lock
  try {
    const booking = await bookingsColl.findOne({ _id: bookingObjId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: `Booking ${booking.booking_reference} is already cancelled. Cannot cancel again.`
      });
    }

    // Atomic status update with guard to prevent duplicate cancellation
    const updateResult = await bookingsColl.updateOne(
      { _id: bookingObjId, status: 'Confirmed' },
      { $set: { status: 'Cancelled', cancelled_at: new Date() } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Booking has already been cancelled or modified.'
      });
    }

    // Return seats to flight
    await flightsColl.updateOne(
      { _id: booking.flight_id },
      { $inc: { available_seats: booking.number_of_seats } }
    );

    return res.status(200).json({
      success: true,
      message: `Booking ${booking.booking_reference} cancelled successfully. ${booking.number_of_seats} seat(s) restored.`,
      transactionMode: 'Standalone_Atomic_Guarded'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking.',
      error: error.message
    });
  }
}

/**
 * GET /api/bookings
 * Retrieve all bookings with passenger and flight metadata via $lookup
 */
async function getBookings(req, res) {
  try {
    const { status, reference, email } = req.query;
    const bookingsColl = getBookingsCollection();

    const matchConditions = {};

    if (status && status !== 'All') {
      matchConditions.status = status;
    }

    if (reference && reference.trim()) {
      matchConditions.booking_reference = { $regex: new RegExp(reference.trim(), 'i') };
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'flights',
          localField: 'flight_id',
          foreignField: '_id',
          as: 'flight'
        }
      },
      {
        $unwind: { path: '$flight', preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: 'passengers',
          localField: 'passenger_id',
          foreignField: '_id',
          as: 'passenger'
        }
      },
      {
        $unwind: { path: '$passenger', preserveNullAndEmptyArrays: true }
      }
    ];

    // Optional filter by passenger email
    if (email && email.trim()) {
      pipeline.push({
        $match: { 'passenger.email': { $regex: new RegExp(email.trim(), 'i') } }
      });
    }

    pipeline.push({ $sort: { booking_date: -1 } });

    const bookings = await bookingsColl.aggregate(pipeline).toArray();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error retrieving bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings.',
      error: error.message
    });
  }
}

/**
 * GET /api/bookings/:id
 * Retrieve single booking by ObjectId or reference
 */
async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const bookingsColl = getBookingsCollection();

    let matchStage;
    if (ObjectId.isValid(id)) {
      matchStage = { $match: { _id: new ObjectId(id) } };
    } else {
      matchStage = { $match: { booking_reference: id.trim().toUpperCase() } };
    }

    const pipeline = [
      matchStage,
      {
        $lookup: {
          from: 'flights',
          localField: 'flight_id',
          foreignField: '_id',
          as: 'flight'
        }
      },
      { $unwind: { path: '$flight', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'passengers',
          localField: 'passenger_id',
          foreignField: '_id',
          as: 'passenger'
        }
      },
      { $unwind: { path: '$passenger', preserveNullAndEmptyArrays: true } }
    ];

    const results = await bookingsColl.aggregate(pipeline).toArray();

    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking.',
      error: error.message
    });
  }
}

module.exports = {
  createBooking,
  cancelBooking,
  getBookings,
  getBookingById
};
