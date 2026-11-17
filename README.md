# Airline Reservation Management System (AeroDB)

> **University Advanced Database Systems Semester Project**  
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

- **Frontend:** Vanilla HTML5, Vanilla CSS3 (Custom Responsive Design System), Vanilla JavaScript (ES6+ `fetch()`).  
  *(No frameworks used: No React, Vue, Angular, Bootstrap, or Tailwind).*
- **Backend:** Node.js, Express.js.
- **Database:** MongoDB Community Server (v6.0 / v7.0 / v8.0 / v9.0).
- **Database Driver:** Official MongoDB Node.js Driver (`mongodb`).  
  *(No Mongoose ODM used, so all native database queries, cursors, indexes, and sessions remain completely explicit).*
- **Testing:** Jest, Supertest.

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

## 5. Step-by-Step Beginner Setup Guide (Windows)

Follow these exact steps on your Windows machine:

### Step 1: Install & Verify Node.js
1. Download the LTS version from [https://nodejs.org](https://nodejs.org).
2. Open PowerShell or Command Prompt and verify:
   ```cmd
   node -v
   npm -v
   ```

### Step 2: Install & Verify MongoDB Community Server
1. Download MongoDB Community Server from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community).
2. Install with default settings (Install as Windows Service).
3. Test that MongoDB is running by opening `mongosh`:
   ```cmd
   mongosh --eval "db.version()"
   ```
   If MongoDB is not running as a service, start it manually:
   ```cmd
   "C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

### Step 3: Open Project & Install Dependencies
1. Open PowerShell and navigate to the project directory:
   ```cmd
   cd C:\Users\marya\.gemini\antigravity\scratch\airline-reservation-system
   ```
2. Install npm dependencies:
   ```cmd
   npm install
   ```

### Step 4: Configure Environment Variables
1. A default `.env` file is already created. You can verify its content:
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017
   DB_NAME=airline_reservation_db
   PORT=3000
   NODE_ENV=development

   # Admin Authentication Credentials (Protected Portal)
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   SESSION_SECRET=aerodb-secret-auth-key-2026
   ```

### Step 5: Seed the Database
Generate 65+ realistic flights, 150 synthetic passengers, and 300 bookings:
```cmd
npm run seed
```
To force a clean reset and reseed at any time:
```cmd
npm run seed:force
```

### Step 6: Create Indexes
Build all compound, unique, B-tree, and hashed indexes:
```cmd
npm run indexes
```

### Step 7: Run Query Performance Analysis
Inspect the live MongoDB `explain("executionStats")` benchmark:
```cmd
npm run performance
```

### Step 8: Run Aggregation Pipeline Reports
View the 4 terminal aggregation reports:
```cmd
npm run aggregation
```

### Step 9: Run ACID Transaction Demonstration
Inspect transaction commit and rollback simulation:
```cmd
npm run transactions
```

### Step 10: Start the Web Application
```cmd
npm start
```
Open your browser:
- **Passenger Portal:** `http://localhost:3000`
- **Admin & Database Portal Login:** `http://localhost:3000/admin-login`

---

## 6. Application Architecture & User Flow

The application maintains strict architectural and security separation between the **Passenger Portal** and the **Administrative & Database Analytics Portal**:

### 1. Passenger Flow (Public)
The passenger interface has zero technical jargon or database administrative controls:
```text
Home (index.html)
   ↓
Search Flights (flights.html)
   ↓
View Flight Details (flight-details.html)
   ↓
Book Flight (booking.html)
   ↓
My Bookings (bookings.html)
   ↓
Cancel Booking (atomic seat restoration)
```

### 2. Administrator & Database Flow (Protected)
Access to administrative flight modifications, raw booking oversight, and database aggregation reports is protected by backend middleware session authentication:
```text
/admin-login
   ↓
[Login with admin / admin123]
   ↓
Admin Panel (/admin)
   ├── Manage Flights (Add, Edit, Delete)
   ├── Manage Bookings (Status Filter, Admin Cancellation)
   └── DB Reports & Analytics (/reports)
        ├── Aggregation 1: Bookings per Flight
        ├── Aggregation 2: Most Popular Routes
        ├── Aggregation 3: Booking Status Summary
        ├── Aggregation 4: Revenue by Flight
        └── Live Query Performance explain("executionStats")
```
*(Unauthenticated direct access to `/admin`, `/reports`, `/api/admin/*`, and `/api/reports/*` is rejected and redirected to `/admin-login`).*

---

## 7. Running Automated Tests

Run the full Jest test suite covering CRUD, validations, seat decrements, cancellations, and aggregation:
```cmd
npm test
```

---

## 8. Backup & Restore Demonstration

See [`database/backup_restore.md`](database/backup_restore.md) for full commands:
- Backup: `mongodump --db=airline_reservation_db --out=./backups`
- Restore: `mongorestore --db=airline_reservation_db --drop ./backups/airline_reservation_db`
