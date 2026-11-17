/**
 * Query Performance Analysis Module
 * 
 * Demonstrates:
 * - Real query execution statistics via MongoDB explain("executionStats")
 * - Comparison of COLLSCAN (Collection Scan) vs IXSCAN (Index Scan)
 * - Measurement of totalDocsExamined, totalKeysExamined, and executionTimeMillis
 * - Clear academic explanation of B-Tree indexing benefits for database query optimization
 * 
 * Usage:
 *   node database/query_performance.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'airline_reservation_db';

/**
 * Execute real explain("executionStats") before and after the compound B-tree index
 */
async function analyzePerformance() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const flightsColl = db.collection('flights');

    const totalDocsInCollection = await flightsColl.countDocuments();
    if (totalDocsInCollection === 0) {
      console.log('[Performance] Flights collection is empty. Run: npm run seed first.');
      return null;
    }

    const testQuery = { departure_city: 'Karachi', destination_city: 'Lahore' };
    const indexName = 'idx_flights_route_benchmark';
    const indexKey = { departure_city: 1, destination_city: 1 };

    console.log('========================================================================');
    console.log('           MONGODB QUERY PERFORMANCE ANALYSIS & EXPLAIN PLAN            ');
    console.log('========================================================================');
    console.log(`Target Collection:   flights (${totalDocsInCollection} documents)`);
    console.log(`Target Query:        db.flights.find(${JSON.stringify(testQuery)})`);
    console.log(`Benchmark Index:     ${JSON.stringify(indexKey)}`);
    console.log('------------------------------------------------------------------------\n');

    // 1. STEP ONE: RUN QUERY BEFORE INDEX (Ensure index does NOT exist)
    // Drop test index or existing route index if present
    try {
      await flightsColl.dropIndex(indexName);
    } catch (e) {
      // Ignore if not present
    }
    try {
      await flightsColl.dropIndex('idx_flights_route');
    } catch (e) {
      // Ignore if not present
    }

    console.log('[Phase 1] Executing query WITHOUT index (COLLSCAN)...');
    const beforeExplain = await flightsColl
      .find(testQuery)
      .explain('executionStats');

    const beforeStats = beforeExplain.executionStats;
    const beforeStage = beforeStats.executionStages.stage || 'COLLSCAN';

    console.log(`[Phase 1 Result] Finished in ${beforeStats.executionTimeMillis} ms`);
    console.log(`                 Total Documents Examined: ${beforeStats.totalDocsExamined}`);
    console.log(`                 Total Keys Examined:      ${beforeStats.totalKeysExamined}`);
    console.log(`                 Execution Stage:          ${beforeStage}`);
    console.log(`                 Returned Documents:       ${beforeStats.nReturned}\n`);

    // 2. STEP TWO: CREATE COMPOUND B-TREE INDEX
    console.log(`[Phase 2] Creating compound B-tree index: ${JSON.stringify(indexKey)}...`);
    await flightsColl.createIndex(indexKey, { name: indexName });
    console.log('[Phase 2] Index created successfully.\n');

    // 3. STEP THREE: RUN SAME QUERY AFTER INDEX
    console.log('[Phase 3] Executing identical query WITH compound B-tree index (IXSCAN)...');
    const afterExplain = await flightsColl
      .find(testQuery)
      .explain('executionStats');

    const afterStats = afterExplain.executionStats;
    // Extract scan stage (might be FETCH over IXSCAN)
    const scanStage = afterStats.executionStages.inputStage
      ? afterStats.executionStages.inputStage.stage
      : afterStats.executionStages.stage;

    console.log(`[Phase 3 Result] Finished in ${afterStats.executionTimeMillis} ms`);
    console.log(`                 Total Documents Examined: ${afterStats.totalDocsExamined}`);
    console.log(`                 Total Keys Examined:      ${afterStats.totalKeysExamined}`);
    console.log(`                 Execution Stage:          ${scanStage} -> ${afterStats.executionStages.stage}`);
    console.log(`                 Returned Documents:       ${afterStats.nReturned}\n`);

    // 4. PREPARE STRUCTURED SUMMARY COMPARISON
    const docsExaminedReduction = beforeStats.totalDocsExamined > 0
      ? (((beforeStats.totalDocsExamined - afterStats.totalDocsExamined) / beforeStats.totalDocsExamined) * 100).toFixed(1)
      : '0.0';

    const results = {
      query: testQuery,
      totalCollectionSize: totalDocsInCollection,
      beforeIndex: {
        stage: beforeStage,
        executionTimeMillis: beforeStats.executionTimeMillis,
        totalDocsExamined: beforeStats.totalDocsExamined,
        totalKeysExamined: beforeStats.totalKeysExamined,
        nReturned: beforeStats.nReturned
      },
      afterIndex: {
        stage: `${scanStage} + ${afterStats.executionStages.stage}`,
        executionTimeMillis: afterStats.executionTimeMillis,
        totalDocsExamined: afterStats.totalDocsExamined,
        totalKeysExamined: afterStats.totalKeysExamined,
        nReturned: afterStats.nReturned
      },
      reductionPercentage: `${docsExaminedReduction}%`,
      academicNotes: [
        'Before Index: The database performed a COLLSCAN (Collection Scan), inspecting every single document in the collection O(N).',
        'After Index: The database traversed the B-tree ordered structure via IXSCAN (Index Scan) in O(log N) time, only fetching the matching documents.',
        'In smaller local datasets (<1,000 documents), executionTimeMillis is often 0-2 ms in both cases due to RAM caching. However, the drastic drop in totalDocsExamined proves the computational efficiency.'
      ]
    };

    console.log('========================================================================');
    console.log('                     PERFORMANCE COMPARISON REPORT                      ');
    console.log('========================================================================');
    console.log(`Query: Find flights from Karachi to Lahore\n`);
    console.log(`Metric                     | BEFORE INDEX (COLLSCAN) | AFTER INDEX (IXSCAN)`);
    console.log(`---------------------------+-------------------------+----------------------`);
    console.log(`Execution Stage            | ${beforeStage.padEnd(23)} | ${(scanStage + '+' + afterStats.executionStages.stage).padEnd(20)}`);
    console.log(`Total Documents Examined   | ${String(beforeStats.totalDocsExamined).padEnd(23)} | ${String(afterStats.totalDocsExamined).padEnd(20)}`);
    console.log(`Total Keys Examined        | ${String(beforeStats.totalKeysExamined).padEnd(23)} | ${String(afterStats.totalKeysExamined).padEnd(20)}`);
    console.log(`Execution Time (ms)        | ${String(beforeStats.executionTimeMillis + ' ms').padEnd(23)} | ${String(afterStats.executionTimeMillis + ' ms').padEnd(20)}`);
    console.log(`Documents Returned         | ${String(beforeStats.nReturned).padEnd(23)} | ${String(afterStats.nReturned).padEnd(20)}`);
    console.log(`Document Scan Reduction    | -                       | ${docsExaminedReduction}% fewer doc scans`);
    console.log('========================================================================');
    console.log('\nAcademic Conclusion:');
    results.academicNotes.forEach(note => console.log(`• ${note}`));
    console.log('\n');

    return results;
  } catch (error) {
    console.error('[Performance] Error executing analysis:', error);
    throw error;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  analyzePerformance();
}

module.exports = { analyzePerformance };
