/**
 * Database Seeding Script
 * 
 * Demonstrates:
 * - Realistic synthetic dataset creation for Advanced Database Systems
 * - Relational document references (Passenger ObjectId & Flight ObjectId in Bookings)
 * - Safe reset and reseed mechanism with data integrity
 * - Accurate seat calculation based on confirmed bookings
 * 
 * Usage:
 *   node database/seed_data.js
 *   node database/seed_data.js --force  (drops existing collections and reseeds)
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'airline_reservation_db';

const CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Peshawar',
  'Quetta',
  'Multan',
  'Faisalabad',
  'Dubai',
  'Doha',
  'Abu Dhabi',
  'Jeddah',
  'Riyadh',
  'Muscat'
];

const AIRLINES = [
  { name: 'PIA', prefix: 'PK' },
  { name: 'Airblue', prefix: 'PA' },
  { name: 'SereneAir', prefix: 'ER' },
  { name: 'Fly Jinnah', prefix: '9P' },
  { name: 'Emirates', prefix: 'EK' },
  { name: 'Qatar Airways', prefix: 'QR' },
  { name: 'Saudia', prefix: 'SV' }
];

const FIRST_NAMES = [
  'Ahmed', 'Fatima', 'Muhammad', 'Ayesha', 'Ali', 'Zainab', 'Bilal', 'Maryam',
  'Hamza', 'Hina', 'Usman', 'Sara', 'Tariq', 'Khadija', 'Omer', 'Noreen',
  'Zubair', 'Rabia', 'Kamran', 'Sadia', 'Farhan', 'Bushra', 'Waqas', 'Anam',
  'Haris', 'Iqra', 'Shoaib', 'Maha', 'Asim', 'Sana', 'Shahid', 'Zoya',
  'Imran', 'Huma', 'Kashif', 'Mehwish', 'Nasir', 'Farida', 'Adeel', 'Nadia'
];

const LAST_NAMES = [
  'Khan', 'Ahmed', 'Malik', 'Chaudhry', 'Sheikh', 'Bhatti', 'Qureshi', 'Siddiqui',
  'Raza', 'Shah', 'Mirza', 'Jutt', 'Abbasi', 'Farooq', 'Rehman', 'Ansari',
  'Hashmi', 'Ghafoor', 'Iqbal', 'Akram', 'Nawaz', 'Sharif', 'Butt', 'Dar'
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

async function seed() {
  const client = new MongoClient(uri);
  const isForce = process.argv.includes('--force');

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`[Seed] Connected to "${dbName}".`);

    const flightsColl = db.collection('flights');
    const passengersColl = db.collection('passengers');
    const bookingsColl = db.collection('bookings');

    const existingFlights = await flightsColl.countDocuments();
    if (existingFlights > 0 && !isForce) {
      console.log(`[Seed] Database already contains ${existingFlights} flights.`);
      console.log('[Seed] To reseed completely, run: node database/seed_data.js --force');
      return;
    }

    if (isForce) {
      console.log('[Seed] Dropping existing collections...');
      await flightsColl.drop().catch(() => {});
      await passengersColl.drop().catch(() => {});
      await bookingsColl.drop().catch(() => {});
      console.log('[Seed] Collections dropped successfully.');
    }

    console.log('[Seed] Generating synthetic flight data...');
    const flightDocs = [];
    let flightCounter = 100;

    // Generate ~75 flights covering major domestic and international routes
    for (let i = 0; i < CITIES.length; i++) {
      for (let j = 0; j < CITIES.length; j++) {
        if (i === j) continue;

        // Pair cities with 1-2 flights
        const depCity = CITIES[i];
        const destCity = CITIES[j];

        // Higher frequency for major hub pairs
        const isMajorRoute = (
          (depCity === 'Karachi' && (destCity === 'Lahore' || destCity === 'Islamabad' || destCity === 'Dubai')) ||
          (depCity === 'Lahore' && (destCity === 'Karachi' || destCity === 'Islamabad' || destCity === 'Doha')) ||
          (depCity === 'Islamabad' && (destCity === 'Karachi' || destCity === 'Dubai' || destCity === 'Jeddah'))
        );

        const flightsCount = isMajorRoute ? 2 : (Math.random() < 0.35 ? 1 : 0);

        for (let k = 0; k < flightsCount; k++) {
          flightCounter++;
          const airlineObj = getRandomElement(AIRLINES);
          const flightNumber = `${airlineObj.prefix}${flightCounter}`;

          // Schedule dates between Dec 2026 and Jan 2027
          const dayOffset = getRandomInt(1, 45);
          const hour = getRandomInt(6, 22);
          const minute = getRandomElement([0, 15, 30, 45]);
          const depDate = new Date(2026, 11, dayOffset, hour, minute); // Month is 0-indexed: 11 = Dec

          const flightDurationHours = (depCity.includes('Dubai') || destCity.includes('Dubai') ||
                                       depCity.includes('Doha') || destCity.includes('Doha') ||
                                       depCity.includes('Jeddah') || destCity.includes('Jeddah')) ? getRandomInt(3, 5) : getRandomInt(1, 2);
          const arrDate = new Date(depDate.getTime() + flightDurationHours * 3600 * 1000);

          // Pricing logic: International vs Domestic
          const isInternational = ['Dubai', 'Doha', 'Abu Dhabi', 'Jeddah', 'Riyadh', 'Muscat'].includes(depCity) ||
                                  ['Dubai', 'Doha', 'Abu Dhabi', 'Jeddah', 'Riyadh', 'Muscat'].includes(destCity);
          const ticketPrice = isInternational ? getRandomInt(65000, 185000) : getRandomInt(18000, 42000);

          const totalSeats = getRandomElement([150, 180, 220, 280]);

          flightDocs.push({
            _id: new ObjectId(),
            flight_number: flightNumber,
            airline: airlineObj.name,
            departure_city: depCity,
            destination_city: destCity,
            departure_time: formatDate(depDate),
            arrival_time: formatDate(arrDate),
            ticket_price: ticketPrice,
            total_seats: totalSeats,
            available_seats: totalSeats, // Will adjust after bookings created
            status: getRandomElement(['Scheduled', 'Scheduled', 'Scheduled', 'Delayed', 'Scheduled'])
          });
        }
      }
    }

    const insertedFlights = await flightsColl.insertMany(flightDocs);
    console.log(`[Seed] Inserted ${insertedFlights.insertedCount} flight records.`);

    // Generate 150 synthetic passengers
    console.log('[Seed] Generating synthetic passenger data...');
    const passengerDocs = [];
    const usedEmails = new Set();

    for (let p = 1; p <= 150; p++) {
      const fName = getRandomElement(FIRST_NAMES);
      const lName = getRandomElement(LAST_NAMES);
      let email = `${fName.toLowerCase()}.${lName.toLowerCase()}${p}@example.com`;
      while (usedEmails.has(email)) {
        email = `${fName.toLowerCase()}.${lName.toLowerCase()}${getRandomInt(100, 999)}@example.com`;
      }
      usedEmails.add(email);

      const phone = `+92-3${getRandomInt(0, 4)}${getRandomInt(0, 9)}-${getRandomInt(1000000, 9999999)}`;

      passengerDocs.push({
        _id: new ObjectId(),
        name: `${fName} ${lName}`,
        email: email,
        phone: phone,
        created_at: new Date(2026, 10, getRandomInt(1, 28))
      });
    }

    const insertedPassengers = await passengersColl.insertMany(passengerDocs);
    console.log(`[Seed] Inserted ${insertedPassengers.insertedCount} passenger records.`);

    // Generate ~300 synthetic bookings
    console.log('[Seed] Generating synthetic booking records...');
    const bookingDocs = [];
    const flightSeatMap = new Map(); // track booked seats per flight
    flightDocs.forEach(f => flightSeatMap.set(f._id.toString(), 0));

    let bookingRefCounter = 10001;

    for (let b = 1; b <= 300; b++) {
      const flight = getRandomElement(flightDocs);
      const passenger = getRandomElement(passengerDocs);
      const numSeats = getRandomInt(1, 3);

      const currentBooked = flightSeatMap.get(flight._id.toString()) || 0;
      if (currentBooked + numSeats > flight.total_seats - 10) {
        // Skip if close to full so flights keep available seats
        continue;
      }

      const isCancelled = Math.random() < 0.12; // ~12% cancellation rate
      const status = isCancelled ? 'Cancelled' : 'Confirmed';

      if (!isCancelled) {
        flightSeatMap.set(flight._id.toString(), currentBooked + numSeats);
      }

      bookingDocs.push({
        _id: new ObjectId(),
        booking_reference: `AR-2026-${String(bookingRefCounter++).padStart(5, '0')}`,
        passenger_id: passenger._id,
        flight_id: flight._id,
        booking_date: new Date(2026, 11, getRandomInt(1, 15), getRandomInt(8, 20), getRandomInt(0, 59)),
        number_of_seats: numSeats,
        total_amount: flight.ticket_price * numSeats,
        status: status
      });
    }

    const insertedBookings = await bookingsColl.insertMany(bookingDocs);
    console.log(`[Seed] Inserted ${insertedBookings.insertedCount} booking records.`);

    // Update available_seats on all flights based on confirmed bookings
    console.log('[Seed] Syncing flight available_seats...');
    for (const flight of flightDocs) {
      const bookedSeats = flightSeatMap.get(flight._id.toString()) || 0;
      const availableSeats = Math.max(0, flight.total_seats - bookedSeats);
      await flightsColl.updateOne(
        { _id: flight._id },
        { $set: { available_seats: availableSeats } }
      );
    }

    console.log('[Seed] Database seeding completed successfully!');
    console.log(`[Seed] Summary:`);
    console.log(`   - Flights: ${flightDocs.length}`);
    console.log(`   - Passengers: ${passengerDocs.length}`);
    console.log(`   - Bookings: ${bookingDocs.length}`);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
