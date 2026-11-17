/**
 * Database Connection Module
 * 
 * Demonstrates:
 * - Official MongoDB Node.js Driver connection pooling
 * - Environment variable configuration
 * - Replica set detection for ACID transaction capability
 * - Safe graceful connection teardown
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'airline_reservation_db';

let client = null;
let db = null;
let replicaSetSupported = false;

/**
 * Connect to MongoDB Community Server using the official driver
 */
async function connectDB() {
  if (db && client) {
    return { client, db };
  }

  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 20
    });

    await client.connect();
    db = client.db(dbName);

    console.log(`[MongoDB] Connected successfully to database: "${dbName}" at ${uri}`);

    // Check if connected instance is part of a replica set
    try {
      const adminDb = client.db('admin');
      const isMasterResult = await adminDb.command({ isMaster: 1 });
      replicaSetSupported = Boolean(isMasterResult.setName);
      if (replicaSetSupported) {
        console.log(`[MongoDB] Replica Set detected: "${isMasterResult.setName}" (Multi-document ACID transactions enabled)`);
      } else {
        console.log(`[MongoDB] Running in standalone mode. Note: MongoDB multi-document transactions require a replica set (e.g. rs0). Two-phase atomic updates will be used as a standalone fallback.`);
      }
    } catch (checkErr) {
      replicaSetSupported = false;
    }

    return { client, db };
  } catch (error) {
    console.error(`[MongoDB] Connection error:`, error.message);
    throw error;
  }
}

/**
 * Get active database instance
 */
function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}

/**
 * Get active MongoClient (used for startSession() in transactions)
 */
function getClient() {
  if (!client) {
    throw new Error('MongoClient not initialized. Call connectDB() first.');
  }
  return client;
}

/**
 * Check if replica set mode is enabled (required for multi-document ACID transactions)
 */
function isReplicaSet() {
  return replicaSetSupported;
}

/**
 * Close database connection gracefully
 */
async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed.');
  }
}

// Collection getters for convenience
function getFlightsCollection() {
  return getDB().collection('flights');
}

function getPassengersCollection() {
  return getDB().collection('passengers');
}

function getBookingsCollection() {
  return getDB().collection('bookings');
}

module.exports = {
  connectDB,
  getDB,
  getClient,
  isReplicaSet,
  closeDB,
  getFlightsCollection,
  getPassengersCollection,
  getBookingsCollection
};
