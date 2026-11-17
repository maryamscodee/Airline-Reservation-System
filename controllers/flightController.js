/**
 * Flight Controller
 * 
 * Demonstrates:
 * - CRUD operations on MongoDB "flights" collection
 * - Query filtering ($eq, $gte, $lte)
 * - Index-assisted sorting (.sort())
 * - Input validation & proper HTTP status codes
 */

const { ObjectId } = require('mongodb');
const { getFlightsCollection, getBookingsCollection } = require('../config/db');

/**
 * GET /api/flights
 * Search, filter, and sort flights
 * Query parameters:
 *  - departure_city
 *  - destination_city
 *  - status
 *  - min_price
 *  - max_price
 *  - sort_by (ticket_price | departure_time)
 *  - order (asc | desc)
 */
async function getFlights(req, res) {
  try {
    const flightsColl = getFlightsCollection();
    const {
      departure_city,
      destination_city,
      status,
      min_price,
      max_price,
      sort_by = 'departure_time',
      order = 'asc'
    } = req.query;

    const filter = {};

    // Search by departure and destination cities (uses compound B-tree index idx_flights_route)
    if (departure_city && departure_city.trim()) {
      filter.departure_city = { $regex: new RegExp(`^${departure_city.trim()}$`, 'i') };
    }
    if (destination_city && destination_city.trim()) {
      filter.destination_city = { $regex: new RegExp(`^${destination_city.trim()}$`, 'i') };
    }

    // Filter by flight status
    if (status && status.trim() && status !== 'All') {
      filter.status = status.trim();
    }

    // Filter by price range
    if (min_price || max_price) {
      filter.ticket_price = {};
      if (min_price && !isNaN(Number(min_price))) {
        filter.ticket_price.$gte = Number(min_price);
      }
      if (max_price && !isNaN(Number(max_price))) {
        filter.ticket_price.$lte = Number(max_price);
      }
    }

    // Sort order definition
    const sortField = ['ticket_price', 'departure_time'].includes(sort_by) ? sort_by : 'departure_time';
    const sortDirection = order.toLowerCase() === 'desc' ? -1 : 1;
    const sortOption = { [sortField]: sortDirection };

    const flights = await flightsColl
      .find(filter)
      .sort(sortOption)
      .toArray();

    return res.status(200).json({
      success: true,
      count: flights.length,
      data: flights
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve flights.',
      error: error.message
    });
  }
}

/**
 * GET /api/flights/:id
 * Retrieve single flight by ObjectId
 */
async function getFlightById(req, res) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid flight ID format. Must be a 24-character hexadecimal ObjectId.'
      });
    }

    const flightsColl = getFlightsCollection();
    const flight = await flightsColl.findOne({ _id: new ObjectId(id) });

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: `Flight with ID ${id} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: flight
    });
  } catch (error) {
    console.error('Error fetching flight by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve flight details.',
      error: error.message
    });
  }
}

/**
 * POST /api/flights
 * Create a new flight record
 */
async function createFlight(req, res) {
  try {
    const {
      flight_number,
      airline,
      departure_city,
      destination_city,
      departure_time,
      arrival_time,
      ticket_price,
      total_seats,
      status = 'Scheduled'
    } = req.body;

    // Field Validations
    if (!flight_number || !airline || !departure_city || !destination_city || !departure_time || !arrival_time) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: flight_number, airline, departure_city, destination_city, departure_time, arrival_time.'
      });
    }

    const price = Number(ticket_price);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Ticket price must be a non-negative number.'
      });
    }

    const seats = Number(total_seats);
    if (isNaN(seats) || seats <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total seats must be a positive integer.'
      });
    }

    if (departure_city.trim().toLowerCase() === destination_city.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Departure city and destination city cannot be identical.'
      });
    }

    const flightsColl = getFlightsCollection();

    // Enforce unique flight_number
    const existing = await flightsColl.findOne({ flight_number: flight_number.trim().toUpperCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Flight number "${flight_number.trim().toUpperCase()}" already exists. Must be unique.`
      });
    }

    const newFlight = {
      _id: new ObjectId(),
      flight_number: flight_number.trim().toUpperCase(),
      airline: airline.trim(),
      departure_city: departure_city.trim(),
      destination_city: destination_city.trim(),
      departure_time: departure_time.trim(),
      arrival_time: arrival_time.trim(),
      ticket_price: price,
      total_seats: seats,
      available_seats: seats,
      status: status || 'Scheduled'
    };

    const result = await flightsColl.insertOne(newFlight);

    return res.status(201).json({
      success: true,
      message: 'Flight created successfully.',
      data: newFlight
    });
  } catch (error) {
    console.error('Error creating flight:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create flight record.',
      error: error.message
    });
  }
}

/**
 * PUT /api/flights/:id
 * Update flight details
 */
async function updateFlight(req, res) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid flight ID format.'
      });
    }

    const flightsColl = getFlightsCollection();
    const flight = await flightsColl.findOne({ _id: new ObjectId(id) });
    if (!flight) {
      return res.status(404).json({
        success: false,
        message: `Flight with ID ${id} not found.`
      });
    }

    const updateFields = {};
    const {
      airline,
      departure_city,
      destination_city,
      departure_time,
      arrival_time,
      ticket_price,
      total_seats,
      status
    } = req.body;

    if (airline) updateFields.airline = airline.trim();
    if (departure_city) updateFields.departure_city = departure_city.trim();
    if (destination_city) updateFields.destination_city = destination_city.trim();
    if (departure_time) updateFields.departure_time = departure_time.trim();
    if (arrival_time) updateFields.arrival_time = arrival_time.trim();
    if (status) updateFields.status = status;

    if (ticket_price !== undefined) {
      const price = Number(ticket_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Ticket price must be non-negative.'
        });
      }
      updateFields.ticket_price = price;
    }

    if (total_seats !== undefined) {
      const seats = Number(total_seats);
      if (isNaN(seats) || seats <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Total seats must be a positive integer.'
        });
      }
      const bookedSeats = flight.total_seats - flight.available_seats;
      if (seats < bookedSeats) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce total seats below current booked count (${bookedSeats}).`
        });
      }
      updateFields.total_seats = seats;
      updateFields.available_seats = seats - bookedSeats;
    }

    await flightsColl.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
    const updated = await flightsColl.findOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: 'Flight updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error updating flight:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update flight.',
      error: error.message
    });
  }
}

/**
 * DELETE /api/flights/:id
 * Delete flight with referential integrity check
 */
async function deleteFlight(req, res) {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid flight ID format.'
      });
    }

    const flightsColl = getFlightsCollection();
    const bookingsColl = getBookingsCollection();

    const flight = await flightsColl.findOne({ _id: new ObjectId(id) });
    if (!flight) {
      return res.status(404).json({
        success: false,
        message: `Flight with ID ${id} not found.`
      });
    }

    // Referential Integrity Check: Don't allow deletion if confirmed bookings exist
    const activeBookings = await bookingsColl.countDocuments({
      flight_id: new ObjectId(id),
      status: 'Confirmed'
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete flight ${flight.flight_number}. It has ${activeBookings} active confirmed booking(s). Please cancel bookings first or change flight status to 'Cancelled'.`
      });
    }

    await flightsColl.deleteOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: `Flight ${flight.flight_number} successfully deleted.`
    });
  } catch (error) {
    console.error('Error deleting flight:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete flight.',
      error: error.message
    });
  }
}

/**
 * GET /api/flights/meta/cities
 * Helper to fetch distinct cities for search form auto-population
 */
async function getDistinctCities(req, res) {
  try {
    const flightsColl = getFlightsCollection();
    const departureCities = await flightsColl.distinct('departure_city');
    const destinationCities = await flightsColl.distinct('destination_city');

    const allCities = Array.from(new Set([...departureCities, ...destinationCities])).sort();

    return res.status(200).json({
      success: true,
      data: {
        allCities,
        departureCities: departureCities.sort(),
        destinationCities: destinationCities.sort()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch distinct cities.',
      error: error.message
    });
  }
}

module.exports = {
  getFlights,
  getFlightById,
  createFlight,
  updateFlight,
  deleteFlight,
  getDistinctCities
};
