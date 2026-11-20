# Airline Reservation Management System (AeroDB)
> Demonstrating Advanced MongoDB Concepts: Indexing (B-Tree & Hashed), Aggregation Pipelines, ACID Transactions, Query Performance Analysis (`explain`), and Backup & Recovery.

---

## 1. Project Overview & Problem Statement

Modern airlines operate flight networks handling thousands of simultaneous passenger queries, seat searches, bookings, and cancellations. Managing this scale requires a robust database tier that avoids:
1. **Inefficient Collection Scans (COLLSCAN):** Slow full-table scans when searching routes or sorting by price.
2. **Concurrency Anomalies & Overselling:** Multiple passengers attempting to book the final seat simultaneously, resulting in double-booking without transactional guarantees.
3. **Slow Analytical Reporting:** Bottlenecks when calculating route popularity and flight revenues manually in application memory.

### Objectives
This project solves these real-world challenges using **MongoDB Community Server** and the **official Node.js MongoDB driver**:
- **B-Tree Indexing:** Compound indexes `(departure_city, destination_city)` and ordered indexes `(ticket_price, departure_time)` eliminate full scans.
- **Hashed Indexing:** Distributes equality lookups for partitioned or exact-match queries.
- **Query Performance Analysis:** Direct measurement using `explain("executionStats")` comparing document scans and execution stages before and after index creation.
- **ACID Multi-Document Transactions:** Atomic seat decrements and booking document insertions with automatic rollback upon failure.
- **Multi-Stage Aggregation Pipelines:** Native database engine calculations using `$lookup`, `$group`, `$unwind`, `$match`, and `$sort`.

---

## 2. Technology Stack

- **Frontend:** Vanilla HTML5, CSS3 (Custom Responsive Design System), JavaScript .  
- **Backend:** Node.js, Express.js.
- **Database:** MongoDB Community Server (v6.0 / v7.0 / v8.0 / v9.0).
- **Database Driver:** Official MongoDB Node.js Driver (`mongodb`).  
  *(No Mongoose ODM used, so all native database queries, cursors, indexes, and sessions remain completely explicit).*
---

## 3. Database Design & Data Models

The system operates on the database named `airline_reservation_db` with three core collections:

### 1. `flights` Collection
Represents scheduled flights, seat capacity, pricing, and operational status.
```json
{
  "_id": "ObjectId('674c1001a1b2c3d4e5f60001')",
  "flight_number": "PK301",
  "airline": "PIA",
  "departure_city": "Karachi",
  "destination_city": "Lahore",
  "departure_time": "2026-12-01 09:00",
  "arrival_time": "2026-12-01 11:00",
  "ticket_price": 25000,
  "total_seats": 180,
  "available_seats": 120,
  "status": "Scheduled"
}
```

### 2. `passengers` Collection
Represents customer contact details.
```json
{
  "_id": "ObjectId('674c1002a1b2c3d4e5f60002')",
  "name": "Ahmed Malik",
  "email": "ahmed.malik@example.com",
  "phone": "+92-300-1234567",
  "created_at": "2026-11-20T10:00:00.000Z"
}
```

### 3. `bookings` Collection
Represents passenger reservations with relational references to `passengers` and `flights`.
```json
{
  "_id": "ObjectId('674c1003a1b2c3d4e5f60003')",
  "booking_reference": "AR-2026-00125",
  "passenger_id": "ObjectId('674c1002a1b2c3d4e5f60002')",
  "flight_id": "ObjectId('674c1001a1b2c3d4e5f60001')",
  "booking_date": "2026-12-01T08:30:00.000Z",
  "number_of_seats": 2,
  "total_amount": 50000,
  "status": "Confirmed"
}
```

---

## 4. Key MongoDB Concepts & File Mapping

| Database Concept | Implementation File | Key MongoDB Operators / Methods |
| :--- | :--- | :--- |
| **CRUD Operations** | `controllers/flightController.js`<br>`controllers/bookingController.js` | `insertOne()`, `find()`, `updateOne()`, `deleteOne()` |
| **B-Tree Indexing** | `database/indexes.js` | `createIndex({ departure_city: 1, destination_city: 1 })` |
| **Hashed Indexing** | `database/indexes.js` | `createIndex({ flight_number: "hashed" })` |
| **Query Performance** | `database/query_performance.js` | `find().explain("executionStats")` |
| **ACID Transactions** | `database/transactions.js`<br>`controllers/bookingController.js` | `client.startSession()`, `session.withTransaction()` |
| **Aggregation Pipelines** | `database/aggregation.js`<br>`controllers/reportController.js` | `$match`, `$group`, `$lookup`, `$unwind`, `$project`, `$sort` |
| **Backup & Recovery** | `database/backup_restore.md` | `mongodump`, `mongorestore` |

---
