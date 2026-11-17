# MongoDB Database Backup and Recovery Guide

This document explains how to perform physical/logical backups and restorations of the **Airline Reservation Management System** (`airline_reservation_db`) database using standard MongoDB database tools on Windows: `mongodump` and `mongorestore`.

---

## 1. Prerequisites: MongoDB Database Tools

MongoDB Community Server separates the server binaries from the database CLI tools (`mongodump`, `mongorestore`, `mongoexport`, `mongoimport`).

1. Verify whether `mongodump` is available in your PowerShell or Command Prompt:
   ```powershell
   mongodump --version
   mongorestore --version
   ```
2. If the command is not recognized, download the free **MongoDB Database Tools** MSI for Windows from:
   [https://www.mongodb.com/try/download/database-tools](https://www.mongodb.com/try/download/database-tools)
3. Extract or install to `C:\Program Files\MongoDB\Tools\bin` and add this path to your Windows System `PATH` environment variable.

---

## 2. Creating a Database Backup (`mongodump`)

`mongodump` generates a BSON and metadata dump of the database collections.

### Command (Windows PowerShell / Command Prompt)

To back up only the `airline_reservation_db` database to a dedicated `backups/` directory:

```powershell
mongodump --uri="mongodb://localhost:27017" --db=airline_reservation_db --out="./backups/backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
```

Or using the standard path:

```powershell
mongodump --db=airline_reservation_db --out="C:\Users\marya\.gemini\antigravity\scratch\airline-reservation-system\backups\manual_backup"
```

### What Happens:
- MongoDB connects to `mongodb://localhost:27017`.
- It reads collections: `flights`, `passengers`, `bookings`, `flights_hashed_demo`.
- It saves `.bson` files containing documents and `.metadata.json` files containing index definitions.

### Where the Backup is Saved:
```text
airline-reservation-system/
└── backups/
    └── manual_backup/
        └── airline_reservation_db/
            ├── flights.bson
            ├── flights.metadata.json
            ├── passengers.bson
            ├── passengers.metadata.json
            ├── bookings.bson
            ├── bookings.metadata.json
            └── flights_hashed_demo.metadata.json
```

---

## 3. Restoring the Database (`mongorestore`)

`mongorestore` reads the BSON files and recreates the collections along with all defined indexes.

### Command with `--drop` Flag:
The `--drop` flag instructs MongoDB to safely drop existing collections before restoring them, preventing duplicate key errors on unique indexes.

```powershell
mongorestore --db=airline_reservation_db --drop "C:\Users\marya\.gemini\antigravity\scratch\airline-reservation-system\backups\manual_backup\airline_reservation_db"
```

If restoring directly from the root output folder:
```powershell
mongorestore --uri="mongodb://localhost:27017" --drop "./backups/manual_backup"
```

---

## 4. Verifying Successful Database Restoration

To verify that all documents and indexes have been properly restored:

### Step 1: Check document counts using `mongosh`
Open `mongosh` in terminal:
```powershell
mongosh
```
Switch to the database and check counts:
```javascript
use airline_reservation_db;

// Verify document counts
db.flights.countDocuments();
db.passengers.countDocuments();
db.bookings.countDocuments();
```

### Step 2: Verify that indexes were restored
```javascript
db.flights.getIndexes();
db.bookings.getIndexes();
```

You should see:
- `idx_flights_route` (`departure_city_1_destination_city_1`)
- `idx_flights_ticket_price` (`ticket_price_1`)
- `idx_flights_flight_number_unique`
- `idx_bookings_reference_unique`

### Step 3: Run the project verify script
From the project folder:
```powershell
npm run performance
```
If query performance executes successfully and index scan (`IXSCAN`) is detected, the database structure and data are verified!

---

## 5. Summary Table for University Exam / Viva

| Operation | Tool | Key Flags | Functionality |
| :--- | :--- | :--- | :--- |
| **Backup** | `mongodump` | `--db`, `--out` | Exports collections as BSON and index definitions as JSON |
| **Restore** | `mongorestore` | `--db`, `--drop` | Re-imports BSON and rebuilds indexes |
| **Verification** | `mongosh` | `countDocuments()`, `getIndexes()` | Confirms record count and B-tree index health |
