/**
 * Airline Reservation Management System - Backend Server
 * 
 * University Advanced Database Systems Project
 * Tech Stack: Node.js, Express.js, MongoDB Driver
 * Architecture: Clean separation of Passenger and Administrator tiers
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');
const { requireAdminAuth } = require('./middleware/auth');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const flightRoutes = require('./routes/flightRoutes');
const passengerRoutes = require('./routes/passengerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { reportPerformance } = require('./controllers/reportController');

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------------------------------
// PROTECTED ADMINISTRATIVE PAGES (Guarded Before Static Serving)
// --------------------------------------------------------------------------
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/reports', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

app.get('/reports.html', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

// Serve Static Frontend Assets (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// --------------------------------------------------------------------------
// API ROUTES
// --------------------------------------------------------------------------
// 1. Authentication API
app.use('/api/auth', authRoutes);

// 2. Passenger Accessible APIs
app.use('/api/flights', flightRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/bookings', bookingRoutes);

// 3. Restricted Administrative & Database Analytics APIs (Protected)
app.use('/api/admin', requireAdminAuth, adminRoutes);
app.use('/api/reports', requireAdminAuth, reportRoutes);
app.get('/api/performance', requireAdminAuth, reportPerformance);

// Health Check API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    project: 'Airline Reservation Management System',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: err.message
  });
});

// Start Server Function
let server = null;

async function startServer() {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log('===============================================================');
      console.log(`✈️  AIRLINE RESERVATION SYSTEM IS LIVE`);
      console.log(`🌐  Passenger Site: http://localhost:${PORT}`);
      console.log(`🔒  Admin Portal Login: http://localhost:${PORT}/admin-login`);
      console.log('===============================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Only start the server directly if executed as main file (not during tests)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
