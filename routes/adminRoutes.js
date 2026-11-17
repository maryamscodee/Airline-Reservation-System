const express = require('express');
const router = express.Router();
const { getDB, isReplicaSet } = require('../config/db');

/**
 * GET /api/admin/stats
 * Overview dashboard metrics for the administrator
 */
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    const flightsCount = await db.collection('flights').countDocuments();
    const passengersCount = await db.collection('passengers').countDocuments();
    const bookingsCount = await db.collection('bookings').countDocuments();
    const confirmedCount = await db.collection('bookings').countDocuments({ status: 'Confirmed' });
    const cancelledCount = await db.collection('bookings').countDocuments({ status: 'Cancelled' });

    // Calculate total revenue from confirmed bookings
    const revenueAgg = await db.collection('bookings').aggregate([
      { $match: { status: 'Confirmed' } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]).toArray();

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    return res.status(200).json({
      success: true,
      data: {
        flightsCount,
        passengersCount,
        bookingsCount,
        confirmedCount,
        cancelledCount,
        totalRevenue,
        replicaSetEnabled: isReplicaSet(),
        databaseName: db.databaseName
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin statistics.',
      error: error.message
    });
  }
});

module.exports = router;
