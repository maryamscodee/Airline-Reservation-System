/**
 * Report Controller
 * 
 * Exposes MongoDB Aggregation Pipeline reports and Performance Analysis as REST APIs
 */

const { getDB } = require('../config/db');
const {
  getBookingsPerFlight,
  getMostPopularRoutes,
  getBookingStatusSummary,
  getRevenueByFlight
} = require('../database/aggregation');
const { analyzePerformance } = require('../database/query_performance');

/**
 * GET /api/reports/bookings-per-flight
 */
async function reportBookingsPerFlight(req, res) {
  try {
    const db = getDB();
    const data = await getBookingsPerFlight(db);
    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error running bookings per flight report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report.',
      error: error.message
    });
  }
}

/**
 * GET /api/reports/popular-routes
 */
async function reportPopularRoutes(req, res) {
  try {
    const db = getDB();
    const data = await getMostPopularRoutes(db);
    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error running popular routes report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report.',
      error: error.message
    });
  }
}

/**
 * GET /api/reports/booking-status
 */
async function reportBookingStatus(req, res) {
  try {
    const db = getDB();
    const data = await getBookingStatusSummary(db);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error running booking status report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report.',
      error: error.message
    });
  }
}

/**
 * GET /api/reports/revenue
 */
async function reportRevenue(req, res) {
  try {
    const db = getDB();
    const data = await getRevenueByFlight(db);
    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error running revenue report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report.',
      error: error.message
    });
  }
}

/**
 * GET /api/performance
 * Run live explain("executionStats") benchmark
 */
async function reportPerformance(req, res) {
  try {
    const results = await analyzePerformance();
    if (!results) {
      return res.status(400).json({
        success: false,
        message: 'No flight data available to benchmark. Please seed the database first.'
      });
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error running query performance analysis:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute query performance benchmark.',
      error: error.message
    });
  }
}

module.exports = {
  reportBookingsPerFlight,
  reportPopularRoutes,
  reportBookingStatus,
  reportRevenue,
  reportPerformance
};
