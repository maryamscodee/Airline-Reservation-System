/**
 * Automated Test Suite for Airline Reservation Management System
 * 
 * Tests:
 * 1. Admin Authentication & Role-Based Access Control (RBAC) Security
 * 2. Passenger Flight Search & Flight Details (Public)
 * 3. Administrative Flight Modifications (Protected)
 * 4. Validation & Error Handling
 * 5. Passenger Bookings & Transactional Seat Inventory (Public Passenger Flow)
 * 6. Aggregation Pipelines & Database Analytics (Protected)
 */

const request = require('supertest');
const { app } = require('../server');
const { connectDB, closeDB, getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

let db;
let adminToken;
let testFlightId;
let testBookingId;

beforeAll(async () => {
  const conn = await connectDB();
  db = conn.db;

  // Insert a dedicated clean test flight
  const flightResult = await db.collection('flights').insertOne({
    flight_number: 'TEST999',
    airline: 'PIA Test Airways',
    departure_city: 'Karachi',
    destination_city: 'Lahore',
    departure_time: '2026-12-15 08:00',
    arrival_time: '2026-12-15 10:00',
    ticket_price: 22000,
    total_seats: 100,
    available_seats: 10,
    status: 'Scheduled'
  });
  testFlightId = flightResult.insertedId.toString();

  // Obtain admin authentication token for protected admin operations
  const loginRes = await request(app).post('/api/auth/login').send({
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  });
  adminToken = loginRes.body.token;
});

afterAll(async () => {
  try {
    if (testFlightId) {
      await db.collection('flights').deleteOne({ _id: new ObjectId(testFlightId) });
    }
    await db.collection('flights').deleteMany({ flight_number: /^TEST/ });
    await db.collection('passengers').deleteMany({ email: /test.*@example\.com/ });
    await db.collection('bookings').deleteMany({ booking_reference: /^TEST/ });
  } catch (e) {
    // ignore cleanup errors
  }
  await closeDB();
});

describe('1. AUTHENTICATION & ACCESS CONTROL SECURITY TESTS', () => {
  it('POST /api/auth/login - Should reject invalid admin credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'wronguser',
      password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/login - Should successfully authenticate with correct admin credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('GET /api/admin/stats - Should block unauthenticated access (401 Unauthorized)', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/reports/bookings-per-flight - Should block unauthenticated access (401 Unauthorized)', async () => {
    const res = await request(app).get('/api/reports/bookings-per-flight');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /admin - Should redirect unauthenticated browser requests to /admin-login.html', async () => {
    const res = await request(app).get('/admin').set('Accept', 'text/html');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('admin-login.html');
  });

  it('GET /api/admin/stats - Should allow access when authenticated as admin', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.flightsCount).toBeDefined();
  });
});

describe('2. PASSENGER FLIGHT SEARCH & DETAILS (PUBLIC)', () => {
  it('GET /api/flights - Should allow passenger to search flights without login', async () => {
    const res = await request(app).get('/api/flights');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/flights - Should filter flights by departure and destination', async () => {
    const res = await request(app).get('/api/flights?departure_city=Karachi&destination_city=Lahore');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    res.body.data.forEach(flight => {
      expect(flight.departure_city.toLowerCase()).toBe('karachi');
      expect(flight.destination_city.toLowerCase()).toBe('lahore');
    });
  });

  it('GET /api/flights/:id - Should allow passenger to retrieve flight details by ObjectId', async () => {
    const res = await request(app).get(`/api/flights/${testFlightId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.flight_number).toBe('TEST999');
  });

  it('GET /api/flights/meta/cities - Should retrieve city list for passenger dropdowns', async () => {
    const res = await request(app).get('/api/flights/meta/cities');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.allCities)).toBe(true);
  });
});

describe('3. ADMINISTRATIVE FLIGHT MODIFICATIONS (PROTECTED)', () => {
  it('POST /api/flights - Should block unauthenticated flight creation', async () => {
    const res = await request(app).post('/api/flights').send({
      flight_number: 'TEST_HACK',
      airline: 'HackAir',
      departure_city: 'Karachi',
      destination_city: 'Lahore',
      departure_time: '2026-12-20 10:00',
      arrival_time: '2026-12-20 12:00',
      ticket_price: 20000,
      total_seats: 100
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/flights - Should allow authenticated admin to create a flight', async () => {
    const newFlightData = {
      flight_number: 'TEST101',
      airline: 'Airblue Test',
      departure_city: 'Islamabad',
      destination_city: 'Dubai',
      departure_time: '2026-12-20 14:00',
      arrival_time: '2026-12-20 17:00',
      ticket_price: 65000,
      total_seats: 180,
      status: 'Scheduled'
    };

    const res = await request(app)
      .post('/api/flights')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newFlightData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.flight_number).toBe('TEST101');
    expect(res.body.data.available_seats).toBe(180);
  });

  it('POST /api/flights - Should reject duplicate flight_number (Unique Index)', async () => {
    const duplicateData = {
      flight_number: 'TEST999', // Already exists
      airline: 'Other',
      departure_city: 'Karachi',
      destination_city: 'Quetta',
      departure_time: '2026-12-22 10:00',
      arrival_time: '2026-12-22 11:30',
      ticket_price: 15000,
      total_seats: 120
    };

    const res = await request(app)
      .post('/api/flights')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(duplicateData);

    expect(res.status).toBe(409); // Conflict
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/flights/:id - Should allow authenticated admin to update flight ticket_price and status', async () => {
    const updateData = {
      ticket_price: 26000,
      status: 'Delayed'
    };

    const res = await request(app)
      .put(`/api/flights/${testFlightId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket_price).toBe(26000);
    expect(res.body.data.status).toBe('Delayed');
  });
});

describe('4. DATA VALIDATION & ERROR HANDLING', () => {
  it('POST /api/flights - Should reject flight creation with missing fields', async () => {
    const res = await request(app)
      .post('/api/flights')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        flight_number: 'TEST_ERR'
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/flights - Should reject negative ticket_price', async () => {
    const res = await request(app)
      .post('/api/flights')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        flight_number: 'TEST_NEG',
        airline: 'Test Air',
        departure_city: 'Multan',
        destination_city: 'Lahore',
        departure_time: '2026-12-25 10:00',
        arrival_time: '2026-12-25 11:00',
        ticket_price: -500,
        total_seats: 100
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/flights/:id - Should reject malformed ObjectId', async () => {
    const res = await request(app).get('/api/flights/invalid-object-id-123');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/bookings - Should reject invalid email format', async () => {
    const res = await request(app).post('/api/bookings').send({
      flight_id: testFlightId,
      name: 'Bad Email User',
      email: 'not-an-email',
      phone: '03001234567',
      number_of_seats: 1
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('5. PASSENGER BOOKING & TRANSACTION CONSISTENCY (PUBLIC FLOW)', () => {
  it('POST /api/bookings - Should reject booking if requested seats exceed available seats', async () => {
    const res = await request(app).post('/api/bookings').send({
      flight_id: testFlightId,
      name: 'Oversell Tester',
      email: 'oversell.tester@example.com',
      phone: '03009999999',
      number_of_seats: 50
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient seats');

    const flight = await db.collection('flights').findOne({ _id: new ObjectId(testFlightId) });
    expect(flight.available_seats).toBe(10);
  });

  it('POST /api/bookings - Should allow passenger to book seats and atomically decrement available_seats', async () => {
    const res = await request(app).post('/api/bookings').send({
      flight_id: testFlightId,
      name: 'Ahmed Malik Test',
      email: 'ahmed.malik.test@example.com',
      phone: '+92-300-8765432',
      number_of_seats: 3
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking_reference).toMatch(/^AR-2026-\d{5}$/);
    expect(res.body.data.status).toBe('Confirmed');

    testBookingId = res.body.data._id.toString();

    // Verify seats decremented from 10 to 7
    const flight = await db.collection('flights').findOne({ _id: new ObjectId(testFlightId) });
    expect(flight.available_seats).toBe(7);
  });

  it('GET /api/bookings - Should allow passenger to look up their booking by reference', async () => {
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(testBookingId) });
    const res = await request(app).get(`/api/bookings?reference=${booking.booking_reference}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/bookings/:id/cancel - Should allow passenger to cancel booking and restore seats', async () => {
    const res = await request(app).post(`/api/bookings/${testBookingId}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(testBookingId) });
    expect(booking.status).toBe('Cancelled');

    // Verify seats were restored from 7 back to 10
    const flight = await db.collection('flights').findOne({ _id: new ObjectId(testFlightId) });
    expect(flight.available_seats).toBe(10);
  });

  it('POST /api/bookings/:id/cancel - Should prevent already cancelled booking from being cancelled again', async () => {
    const res = await request(app).post(`/api/bookings/${testBookingId}/cancel`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already cancelled');

    const flight = await db.collection('flights').findOne({ _id: new ObjectId(testFlightId) });
    expect(flight.available_seats).toBe(10);
  });

  it('DELETE /api/flights/:id - Should allow authenticated admin to delete test flight with no active bookings', async () => {
    const res = await request(app)
      .delete(`/api/flights/${testFlightId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('6. AGGREGATION PIPELINE & DB ANALYTICS (PROTECTED)', () => {
  it('GET /api/reports/bookings-per-flight - Should run bookings-per-flight aggregation pipeline for admin', async () => {
    const res = await request(app)
      .get('/api/reports/bookings-per-flight')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/reports/popular-routes - Should run popular routes aggregation pipeline for admin', async () => {
    const res = await request(app)
      .get('/api/reports/popular-routes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/reports/booking-status - Should run booking status aggregation pipeline for admin', async () => {
    const res = await request(app)
      .get('/api/reports/booking-status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/reports/revenue - Should run confirmed revenue aggregation pipeline for admin', async () => {
    const res = await request(app)
      .get('/api/reports/revenue')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
