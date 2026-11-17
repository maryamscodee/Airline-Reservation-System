/**
 * MongoDB Aggregation Pipelines Module
 * 
 * Demonstrates:
 * - Complex multi-stage Aggregation Framework ($match, $group, $lookup, $project, $sort)
 * - Joins between collections ($lookup with foreignField and localField)
 * - Grouping and analytical metric accumulation ($sum, $count)
 * - Filtering within aggregation pipelines
 * 
 * Reports Implemented:
 * 1. Bookings per Flight
 * 2. Most Popular Routes
 * 3. Booking Status Summary
 * 4. Revenue by Flight (Confirmed Bookings)
 * 
 * Usage:
 *   node database/aggregation.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'airline_reservation_db';

/**
 * Report 1: Bookings per Flight
 * 
 * Aggregation Pipeline Stages:
 * 1. $group: Group bookings by flight_id and calculate total bookings.
 * 2. $lookup: Join with flights collection to retrieve flight metadata (flight_number, airline, route).
 * 3. $unwind: Deconstruct the single-element flight array from $lookup.
 * 4. $project: Format final projection.
 * 5. $sort: Sort by total_bookings descending.
 */
async function getBookingsPerFlight(db) {
  const bookingsColl = db.collection('bookings');

  const pipeline = [
    {
      $group: {
        _id: '$flight_id',
        total_bookings: { $sum: 1 },
        total_seats_reserved: { $sum: '$number_of_seats' }
      }
    },
    {
      $lookup: {
        from: 'flights',
        localField: '_id',
        foreignField: '_id',
        as: 'flight_details'
      }
    },
    {
      $unwind: '$flight_details'
    },
    {
      $project: {
        _id: 0,
        flight_id: '$_id',
        flight_number: '$flight_details.flight_number',
        airline: '$flight_details.airline',
        route: {
          $concat: ['$flight_details.departure_city', ' → ', '$flight_details.destination_city']
        },
        departure_city: '$flight_details.departure_city',
        destination_city: '$flight_details.destination_city',
        total_bookings: 1,
        total_seats_reserved: 1
      }
    },
    {
      $sort: { total_bookings: -1 }
    }
  ];

  return await bookingsColl.aggregate(pipeline).toArray();
}

/**
 * Report 2: Most Popular Routes
 * 
 * Aggregation Pipeline Stages:
 * 1. $lookup: Join booking with flights collection.
 * 2. $unwind: Flatten flight details.
 * 3. $group: Group by composite route key (departure_city + destination_city).
 * 4. $project: Reshape output fields.
 * 5. $sort: Sort by number_of_bookings descending.
 */
async function getMostPopularRoutes(db) {
  const bookingsColl = db.collection('bookings');

  const pipeline = [
    {
      $lookup: {
        from: 'flights',
        localField: 'flight_id',
        foreignField: '_id',
        as: 'flight'
      }
    },
    {
      $unwind: '$flight'
    },
    {
      $group: {
        _id: {
          departure_city: '$flight.departure_city',
          destination_city: '$flight.destination_city'
        },
        number_of_bookings: { $sum: 1 },
        total_passengers: { $sum: '$number_of_seats' }
      }
    },
    {
      $project: {
        _id: 0,
        departure_city: '$_id.departure_city',
        destination_city: '$_id.destination_city',
        route: { $concat: ['$_id.departure_city', ' → ', '$_id.destination_city'] },
        number_of_bookings: 1,
        total_passengers: 1
      }
    },
    {
      $sort: { number_of_bookings: -1 }
    }
  ];

  return await bookingsColl.aggregate(pipeline).toArray();
}

/**
 * Report 3: Booking Status Summary
 * 
 * Aggregation Pipeline Stages:
 * 1. $group: Group bookings by status field ('Confirmed' vs 'Cancelled').
 * 2. $project: Format field names.
 * 3. $sort: Alphabetical order.
 */
async function getBookingStatusSummary(db) {
  const bookingsColl = db.collection('bookings');

  const pipeline = [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total_seats: { $sum: '$number_of_seats' },
        total_amount: { $sum: '$total_amount' }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1,
        total_seats: 1,
        total_amount: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];

  return await bookingsColl.aggregate(pipeline).toArray();
}

/**
 * Report 4: Revenue by Flight (Confirmed Bookings)
 * 
 * Aggregation Pipeline Stages:
 * 1. $match: Filter out 'Cancelled' bookings (only confirmed revenue).
 * 2. $group: Aggregate total_amount per flight_id.
 * 3. $lookup: Join with flights for flight_number and airline info.
 * 4. $unwind: Flatten flight details.
 * 5. $project: Format currency and metadata.
 * 6. $sort: Sort by revenue descending.
 */
async function getRevenueByFlight(db) {
  const bookingsColl = db.collection('bookings');

  const pipeline = [
    {
      $match: { status: 'Confirmed' }
    },
    {
      $group: {
        _id: '$flight_id',
        total_revenue: { $sum: '$total_amount' },
        confirmed_bookings: { $sum: 1 },
        confirmed_seats: { $sum: '$number_of_seats' }
      }
    },
    {
      $lookup: {
        from: 'flights',
        localField: '_id',
        foreignField: '_id',
        as: 'flight'
      }
    },
    {
      $unwind: '$flight'
    },
    {
      $project: {
        _id: 0,
        flight_id: '$_id',
        flight_number: '$flight.flight_number',
        airline: '$flight.airline',
        route: { $concat: ['$flight.departure_city', ' → ', '$flight.destination_city'] },
        total_revenue: 1,
        confirmed_bookings: 1,
        confirmed_seats: 1
      }
    },
    {
      $sort: { total_revenue: -1 }
    }
  ];

  return await bookingsColl.aggregate(pipeline).toArray();
}

/**
 * Standalone CLI runner to display all reports with beautiful formatting
 */
async function runAggregationReports() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log('========================================================================');
    console.log('             ADVANCED MONGODB AGGREGATION PIPELINES DEMO                ');
    console.log('========================================================================\n');

    // Report 1
    console.log('------------------------------------------------------------------------');
    console.log('REPORT 1: BOOKINGS PER FLIGHT (TOP 10)');
    console.log('Pipeline: $group -> $lookup -> $unwind -> $project -> $sort');
    console.log('------------------------------------------------------------------------');
    const bookingsPerFlight = await getBookingsPerFlight(db);
    console.table(
      bookingsPerFlight.slice(0, 10).map(r => ({
        Flight: r.flight_number,
        Airline: r.airline,
        Route: r.route,
        Bookings: r.total_bookings,
        Seats: r.total_seats_reserved
      }))
    );

    // Report 2
    console.log('\n------------------------------------------------------------------------');
    console.log('REPORT 2: MOST POPULAR ROUTES (TOP 10)');
    console.log('Pipeline: $lookup -> $unwind -> $group(route) -> $project -> $sort');
    console.log('------------------------------------------------------------------------');
    const popularRoutes = await getMostPopularRoutes(db);
    console.table(
      popularRoutes.slice(0, 10).map(r => ({
        Route: r.route,
        Bookings: r.number_of_bookings,
        Passengers: r.total_passengers
      }))
    );

    // Report 3
    console.log('\n------------------------------------------------------------------------');
    console.log('REPORT 3: BOOKING STATUS SUMMARY');
    console.log('Pipeline: $group(status) -> $project -> $sort');
    console.log('------------------------------------------------------------------------');
    const statusSummary = await getBookingStatusSummary(db);
    console.table(
      statusSummary.map(r => ({
        Status: r.status,
        Count: r.count,
        'Seats Reserved': r.total_seats,
        'Total Gross Amount (PKR)': `Rs. ${r.total_amount.toLocaleString()}`
      }))
    );

    // Report 4
    console.log('\n------------------------------------------------------------------------');
    console.log('REPORT 4: REVENUE BY FLIGHT (CONFIRMED ONLY - TOP 10)');
    console.log('Pipeline: $match(Confirmed) -> $group -> $lookup -> $project -> $sort');
    console.log('------------------------------------------------------------------------');
    const revenueByFlight = await getRevenueByFlight(db);
    console.table(
      revenueByFlight.slice(0, 10).map(r => ({
        Flight: r.flight_number,
        Airline: r.airline,
        Route: r.route,
        Revenue: `Rs. ${r.total_revenue.toLocaleString()}`,
        'Confirmed Bookings': r.confirmed_bookings
      }))
    );

    console.log('\n[Aggregation] All 4 aggregation pipelines executed successfully via MongoDB engine.');
  } catch (error) {
    console.error('[Aggregation] Error running reports:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runAggregationReports();
}

module.exports = {
  getBookingsPerFlight,
  getMostPopularRoutes,
  getBookingStatusSummary,
  getRevenueByFlight,
  runAggregationReports
};
