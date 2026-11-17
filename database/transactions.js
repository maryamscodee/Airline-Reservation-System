/**
 * MongoDB Transactions Demonstration Module
 * 
 * Demonstrates:
 * - ACID properties in MongoDB (Atomicity, Consistency, Isolation, Durability)
 * - Multi-document transactions using client.startSession() and session.withTransaction()
 * - Rollback mechanism when an operation fails midway
 * - Preventing concurrency anomalies (lost updates, oversold seats)
 * 
 * Note on MongoDB Transactions:
 * - Multi-document transactions require MongoDB to run as a Replica Set (e.g. rs0).
 * - This script checks if replica set is active. If so, it executes full session transactions.
 * - It demonstrates both a successful commit and an intentional rollback to verify that
 *   available_seats remain unchanged upon failure.
 * 
 * Usage:
 *   node database/transactions.js
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'airline_reservation_db';

/**
 * Execute atomic booking using MongoDB Session Transaction
 * 
 * Steps:
 * 1. Start Session
 * 2. Execute transaction block:
 *    a. Verify flight existence and sufficient available_seats
 *    b. Atomically decrement available_seats on the flight
 *    c. Insert booking document with 'Confirmed' status
 * 3. Commit transaction on success, or Abort on error (automatic rollback)
 */
async function bookFlightWithTransaction(client, db, { flightId, passengerId, numberOfSeats, simulateFailure = false }) {
  const flightsColl = db.collection('flights');
  const bookingsColl = db.collection('bookings');

  const flightObjId = typeof flightId === 'string' ? new ObjectId(flightId) : flightId;
  const passengerObjId = typeof passengerId === 'string' ? new ObjectId(passengerId) : passengerId;

  const session = client.startSession();

  try {
    let resultBooking = null;

    await session.withTransaction(async () => {
      // Step 1: Read flight details inside transaction session
      const flight = await flightsColl.findOne(
        { _id: flightObjId },
        { session }
      );

      if (!flight) {
        throw new Error(`Flight ${flightId} not found.`);
      }

      if (flight.available_seats < numberOfSeats) {
        throw new Error(
          `Insufficient seats. Requested: ${numberOfSeats}, Available: ${flight.available_seats}`
        );
      }

      // Step 2: Atomically decrement available seats on the flight
      const updateResult = await flightsColl.updateOne(
        {
          _id: flightObjId,
          available_seats: { $gte: numberOfSeats } // Concurrency guard
        },
        {
          $inc: { available_seats: -numberOfSeats }
        },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Concurrent modification detected or seats became unavailable.');
      }

      // Step 3: Check if failure simulation was requested for academic demonstration
      if (simulateFailure) {
        throw new Error('[SIMULATED ERROR] Intentionally throwing exception to trigger transaction abort.');
      }

      // Step 4: Create booking document inside the same transaction session
      const bookingReference = `AR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const totalAmount = flight.ticket_price * numberOfSeats;

      const newBooking = {
        _id: new ObjectId(),
        booking_reference: bookingReference,
        passenger_id: passengerObjId,
        flight_id: flightObjId,
        booking_date: new Date(),
        number_of_seats: numberOfSeats,
        total_amount: totalAmount,
        status: 'Confirmed'
      };

      await bookingsColl.insertOne(newBooking, { session });
      resultBooking = newBooking;
    });

    return { success: true, booking: resultBooking };
  } catch (error) {
    // When withTransaction catches an error, it automatically aborts the transaction
    return { success: false, error: error.message };
  } finally {
    await session.endSession();
  }
}

/**
 * Execute atomic booking cancellation with MongoDB Transaction
 * 
 * Steps:
 * 1. Start Session
 * 2. Check booking status (must be 'Confirmed')
 * 3. Update booking status to 'Cancelled'
 * 4. Increment flight available_seats
 * 5. Commit transaction
 */
async function cancelBookingWithTransaction(client, db, { bookingId }) {
  const flightsColl = db.collection('flights');
  const bookingsColl = db.collection('bookings');
  const bookingObjId = typeof bookingId === 'string' ? new ObjectId(bookingId) : bookingId;

  const session = client.startSession();

  try {
    let cancelledBooking = null;

    await session.withTransaction(async () => {
      // 1. Fetch booking inside session
      const booking = await bookingsColl.findOne({ _id: bookingObjId }, { session });
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found.`);
      }

      if (booking.status === 'Cancelled') {
        throw new Error(`Booking ${booking.booking_reference} is already cancelled.`);
      }

      // 2. Mark booking as cancelled
      await bookingsColl.updateOne(
        { _id: bookingObjId },
        { $set: { status: 'Cancelled', cancelled_at: new Date() } },
        { session }
      );

      // 3. Return booked seats to flight
      await flightsColl.updateOne(
        { _id: booking.flight_id },
        { $inc: { available_seats: booking.number_of_seats } },
        { session }
      );

      cancelledBooking = { ...booking, status: 'Cancelled' };
    });

    return { success: true, booking: cancelledBooking };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await session.endSession();
  }
}

/**
 * Interactive demonstration script for student evaluation
 */
async function runTransactionDemo() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log('========================================================================');
    console.log('             MONGODB ACID TRANSACTIONS DEMONSTRATION                    ');
    console.log('========================================================================\n');

    // Check if replica set is active
    let isReplicaSet = false;
    try {
      const isMaster = await client.db('admin').command({ isMaster: 1 });
      isReplicaSet = Boolean(isMaster.setName);
    } catch (e) {
      isReplicaSet = false;
    }

    if (!isReplicaSet) {
      console.log('[Notice] MongoDB is running as a Standalone instance.');
      console.log('MongoDB multi-document transactions require a Replica Set (e.g. rs0).');
      console.log('In standalone mode, atomic single-document updates with conditional checks');
      console.log('($gte and $inc) provide safe seat decrementing.');
      console.log('\nTo enable a single-node Replica Set on Windows:');
      console.log('1. mongod --replSet rs0 --dbpath "path\\to\\data"');
      console.log('2. In mongosh: rs.initiate()\n');
      console.log('Simulating transaction rollback logic for demonstration...\n');
    }

    const flight = await db.collection('flights').findOne({ available_seats: { $gt: 10 } });
    const passenger = await db.collection('passengers').findOne();

    if (!flight || !passenger) {
      console.log('[Error] Seed data missing. Please run: npm run seed');
      return;
    }

    console.log(`Target Flight:        ${flight.flight_number} (${flight.departure_city} -> ${flight.destination_city})`);
    console.log(`Initial Seats:        ${flight.available_seats}`);
    console.log(`Passenger:            ${passenger.name} (${passenger.email})\n`);

    if (isReplicaSet) {
      // -------------------------------------------------------------
      // TEST CASE 1: Successful Transaction
      // -------------------------------------------------------------
      console.log('--- TEST 1: SUCCESSFUL TRANSACTION (Booking 2 Seats) ---');
      const test1 = await bookFlightWithTransaction(client, db, {
        flightId: flight._id,
        passengerId: passenger._id,
        numberOfSeats: 2,
        simulateFailure: false
      });

      const flightAfterTest1 = await db.collection('flights').findOne({ _id: flight._id });
      console.log(`Transaction Result:   ${test1.success ? 'COMMITTED' : 'FAILED'}`);
      console.log(`Booking Reference:    ${test1.booking?.booking_reference}`);
      console.log(`Seats Before:         ${flight.available_seats}`);
      console.log(`Seats After:          ${flightAfterTest1.available_seats} (Decreased by 2)\n`);

      // -------------------------------------------------------------
      // TEST CASE 2: Transaction Rollback on Error
      // -------------------------------------------------------------
      console.log('--- TEST 2: TRANSACTION ROLLBACK ON FAILURE (Simulated Error) ---');
      console.log('Attempting to book 2 seats, but throwing an exception before commit...');
      const seatsBeforeTest2 = flightAfterTest1.available_seats;

      const test2 = await bookFlightWithTransaction(client, db, {
        flightId: flight._id,
        passengerId: passenger._id,
        numberOfSeats: 2,
        simulateFailure: true
      });

      const flightAfterTest2 = await db.collection('flights').findOne({ _id: flight._id });
      console.log(`Transaction Result:   ${test2.success ? 'COMMITTED' : 'ABORTED / ROLLED BACK'}`);
      console.log(`Error Caught:         ${test2.error}`);
      console.log(`Seats Before Test 2:  ${seatsBeforeTest2}`);
      console.log(`Seats After Rollback: ${flightAfterTest2.available_seats}`);
      console.log(`Did Seats Change?     ${seatsBeforeTest2 === flightAfterTest2.available_seats ? 'NO (Rollback verified!)' : 'YES (Error!)'}\n`);

      // -------------------------------------------------------------
      // TEST CASE 3: Booking Cancellation Transaction
      // -------------------------------------------------------------
      if (test1.booking) {
        console.log('--- TEST 3: CANCELLATION TRANSACTION ---');
        const cancelResult = await cancelBookingWithTransaction(client, db, {
          bookingId: test1.booking._id
        });
        const flightAfterCancel = await db.collection('flights').findOne({ _id: flight._id });
        console.log(`Cancellation Result:  ${cancelResult.success ? 'COMMITTED' : 'FAILED'}`);
        console.log(`Seats Restored:       ${flightAfterCancel.available_seats} (Returned 2 seats)`);
      }
    } else {
      // Academic walkthrough of the transaction code
      console.log('MongoDB Transaction Flow Walkthrough:');
      console.log('1. Session started: client.startSession()');
      console.log('2. Inside session.withTransaction():');
      console.log('   - Step A: Query flight available_seats');
      console.log('   - Step B: Decrement available_seats with { $inc: { available_seats: -N } }');
      console.log('   - Step C: Insert booking record');
      console.log('3. If any step throws an error -> session.abortTransaction() rolls back Step B automatically.');
      console.log('4. On completion -> session.commitTransaction() writes all changes atomically.');
    }

    console.log('\n========================================================================');
  } catch (error) {
    console.error('[Transactions] Error running demo:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runTransactionDemo();
}

module.exports = {
  bookFlightWithTransaction,
  cancelBookingWithTransaction,
  runTransactionDemo
};
