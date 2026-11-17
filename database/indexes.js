/**
 * MongoDB Index Management Script
 * 
 * Demonstrates Core Database Concepts for Advanced Database Systems:
 * 1. Single-Field B-Tree Indexes (e.g. ticket_price, departure_time)
 * 2. Compound B-Tree Indexes (e.g. departure_city + destination_city)
 * 3. Unique Constraint Indexes (e.g. flight_number, booking_reference, passenger email)
 * 4. Referential / Foreign Key Indexes (e.g. passenger_id, flight_id on bookings)
 * 5. Hashed Indexes (e.g. flight_number: "hashed") for O(1) equality distribution
 * 
 * Key Differences:
 * - B-Tree Indexes:
 *   Ordered data structures. Support equality queries ($eq), range queries ($gt, $lt, $gte, $lte),
 *   prefix matching, and sort operations without in-memory sorting.
 * - Hashed Indexes:
 *   Hashes field values to evenly distribute keys across partitions/shards.
 *   ONLY supports equality matching. Does NOT support range queries or sorting.
 * 
 * Usage:
 *   node database/indexes.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'airline_reservation_db';

async function createIndexes() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`[Indexes] Connected to "${dbName}"`);
    console.log('===============================================================');
    console.log('CREATING AND CONFIGURING DATABASE INDEXES');
    console.log('===============================================================\n');

    const flightsColl = db.collection('flights');
    const passengersColl = db.collection('passengers');
    const bookingsColl = db.collection('bookings');

    // -------------------------------------------------------------------------
    // 1. FLIGHTS COLLECTION INDEXES
    // -------------------------------------------------------------------------
    console.log('--- 1. FLIGHTS COLLECTION ---');

    /**
     * COMPOUND B-TREE INDEX: departure_city (1) + destination_city (1)
     * Purpose:
     * Optimizes the primary flight search use case:
     * db.flights.find({ departure_city: "Karachi", destination_city: "Lahore" })
     * Eliminates full collection scans (COLLSCAN) and allows index prefix scans.
     */
    const routeIndex = await flightsColl.createIndex(
      { departure_city: 1, destination_city: 1 },
      { name: 'idx_flights_route' }
    );
    console.log(`[Created] Compound B-tree Index: ${routeIndex}`);
    console.log('          Purpose: Optimizes route search (departure_city + destination_city)');

    /**
     * SINGLE-FIELD B-TREE INDEX: ticket_price (1)
     * Purpose:
     * Supports price filtering (e.g. { ticket_price: { $lte: 50000 } })
     * and index-assisted sorting (.sort({ ticket_price: 1 })) without in-memory sort.
     */
    const priceIndex = await flightsColl.createIndex(
      { ticket_price: 1 },
      { name: 'idx_flights_ticket_price' }
    );
    console.log(`[Created] Single-Field B-tree Index: ${priceIndex}`);
    console.log('          Purpose: Supports price filtering and indexed sorting by price');

    /**
     * SINGLE-FIELD B-TREE INDEX: departure_time (1)
     * Purpose:
     * Supports chronological sorting of flights (.sort({ departure_time: 1 }))
     */
    const depTimeIndex = await flightsColl.createIndex(
      { departure_time: 1 },
      { name: 'idx_flights_departure_time' }
    );
    console.log(`[Created] Single-Field B-tree Index: ${depTimeIndex}`);
    console.log('          Purpose: Supports sorting and filtering by departure schedule');

    /**
     * UNIQUE B-TREE INDEX: flight_number (1)
     * Purpose:
     * Enforces business rule: each flight number must be unique in the system.
     * Prevents duplicate flight insertions.
     */
    const flightNumUniqueIndex = await flightsColl.createIndex(
      { flight_number: 1 },
      { unique: true, name: 'idx_flights_flight_number_unique' }
    );
    console.log(`[Created] Unique B-tree Index: ${flightNumUniqueIndex}`);
    console.log('          Purpose: Enforces uniqueness constraint on flight_number');

    /**
     * HASHED INDEX: Demonstration on a separate hashed field / lookup
     * In MongoDB, hashed indexes compute a hash of the field value.
     * Ideal for hash-based sharding and exact equality lookups:
     * db.flights.find({ flight_number: "PK301" })
     * Note: Hashed indexes CANNOT be used for range queries ($gt, $lt) or sorting.
     */
    const hashedCollection = db.collection('flights_hashed_demo');
    // Ensure demo documents exist for hashed demonstration
    const sampleFlight = await flightsColl.findOne();
    if (sampleFlight) {
      await hashedCollection.deleteMany({});
      const flightsSample = await flightsColl.find().limit(20).toArray();
      await hashedCollection.insertMany(flightsSample);
      const hashedIndex = await hashedCollection.createIndex(
        { flight_number: 'hashed' },
        { name: 'idx_flights_flight_number_hashed' }
      );
      console.log(`[Created] Hashed Index (on flights_hashed_demo): ${hashedIndex}`);
      console.log('          Purpose: Demonstrates hash-based O(1) equality lookup vs ordered B-Tree');
    }

    // -------------------------------------------------------------------------
    // 2. PASSENGERS COLLECTION INDEXES
    // -------------------------------------------------------------------------
    console.log('\n--- 2. PASSENGERS COLLECTION ---');

    /**
     * UNIQUE B-TREE INDEX: email (1)
     * Purpose:
     * Enforces passenger email uniqueness and speeds up passenger lookup by email.
     */
    const passengerEmailIndex = await passengersColl.createIndex(
      { email: 1 },
      { unique: true, name: 'idx_passengers_email_unique' }
    );
    console.log(`[Created] Unique B-tree Index: ${passengerEmailIndex}`);
    console.log('          Purpose: Speeds up passenger lookup and prevents duplicate accounts');

    // -------------------------------------------------------------------------
    // 3. BOOKINGS COLLECTION INDEXES
    // -------------------------------------------------------------------------
    console.log('\n--- 3. BOOKINGS COLLECTION ---');

    /**
     * UNIQUE B-TREE INDEX: booking_reference (1)
     * Purpose:
     * Fast O(log N) lookup when passenger searches their booking reference (e.g. AR-2026-00001).
     * Enforces reference code uniqueness.
     */
    const bookingRefIndex = await bookingsColl.createIndex(
      { booking_reference: 1 },
      { unique: true, name: 'idx_bookings_reference_unique' }
    );
    console.log(`[Created] Unique B-tree Index: ${bookingRefIndex}`);
    console.log('          Purpose: Fast booking lookup by reference and uniqueness constraint');

    /**
     * SINGLE-FIELD B-TREE INDEX: passenger_id (1)
     * Purpose:
     * Referential index to quickly find all bookings belonging to a passenger.
     * Prevents COLLSCAN when loading user booking history.
     */
    const passengerIdIndex = await bookingsColl.createIndex(
      { passenger_id: 1 },
      { name: 'idx_bookings_passenger_id' }
    );
    console.log(`[Created] Foreign-Key B-tree Index: ${passengerIdIndex}`);
    console.log('          Purpose: Speeds up retrieval of all bookings for a specific passenger');

    /**
     * SINGLE-FIELD B-TREE INDEX: flight_id (1)
     * Purpose:
     * Referential index to quickly retrieve all bookings attached to a specific flight.
     * Critical for aggregation pipelines (e.g. Bookings per Flight, Revenue by Flight).
     */
    const flightIdIndex = await bookingsColl.createIndex(
      { flight_id: 1 },
      { name: 'idx_bookings_flight_id' }
    );
    console.log(`[Created] Foreign-Key B-tree Index: ${flightIdIndex}`);
    console.log('          Purpose: Optimizes flight-to-booking aggregation joins ($lookup)');

    /**
     * COMPOUND B-TREE INDEX: status (1) + booking_date (-1)
     * Purpose:
     * Speeds up admin dashboard queries filtering by status and sorting by recent date.
     */
    const statusDateIndex = await bookingsColl.createIndex(
      { status: 1, booking_date: -1 },
      { name: 'idx_bookings_status_date' }
    );
    console.log(`[Created] Compound B-tree Index: ${statusDateIndex}`);
    console.log('          Purpose: Optimizes admin queries filtering by status and sorting by date');

    // -------------------------------------------------------------------------
    // DISPLAY ALL EXISTING INDEXES ACROSS COLLECTIONS
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('SUMMARY OF ALL CURRENT INDEXES IN DATABASE');
    console.log('===============================================================');

    const collections = [
      { name: 'flights', coll: flightsColl },
      { name: 'passengers', coll: passengersColl },
      { name: 'bookings', coll: bookingsColl },
      { name: 'flights_hashed_demo', coll: hashedCollection }
    ];

    for (const item of collections) {
      console.log(`\nIndexes for collection "${item.name}":`);
      const indexes = await item.coll.indexes();
      indexes.forEach((idx, i) => {
        console.log(`  ${i + 1}. Name: "${idx.name}"`);
        console.log(`     Key Pattern: ${JSON.stringify(idx.key)}`);
        if (idx.unique) console.log(`     Type: UNIQUE constraint`);
        if (Object.values(idx.key).includes('hashed')) console.log(`     Type: HASHED index`);
      });
    }

    console.log('\n[Indexes] All indexes initialized successfully!');
  } catch (error) {
    console.error('[Indexes] Error creating indexes:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  createIndexes();
}

module.exports = { createIndexes };
