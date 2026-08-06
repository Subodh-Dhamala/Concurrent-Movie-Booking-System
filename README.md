# Concurrent Cinema Booking System — Database Design

## Overview

The Concurrent Cinema Booking System uses a relational database design to manage users, shows, seats, and reservations.

The project focuses on demonstrating **concurrent seat booking** using transactions and row-level locking rather than building a complete cinema management system.

The design supports:

- Multiple users booking seats simultaneously
- Preventing double booking
- Temporary seat reservation
- Reservation expiration
- Maintaining booking history
- Reserving multiple seats in a single booking

---

# Entity Overview

The system contains **five** main entities:

- User
- Show
- Seat
- Reservation
- ReservationSeat

```
User
 |
Reservation
 |
ReservationSeat
 |
Seat
 |
Show
```

---

# Entity Details

## 1. User

### Purpose

Stores customer and administrator information.

Users can:

- Register
- Login
- Browse shows
- Reserve seats

Admins can:

- Create shows
- Create seats
- Manage reservations

| Column | Type | Constraints |
|---------|------|------------|
| id | UUID | PK |
| username | VARCHAR | |
| email | VARCHAR | UNIQUE |
| password | VARCHAR | |
| role | ENUM | USER / ADMIN |
| createdAt | TIMESTAMP | |

### Example

| id | username | email | role |
|----|----------|-------|------|
| U001 | subodh | subodh@gmail.com | USER |

### Relationships

### User → Reservation (One-to-Many)

One user can create multiple reservations.

Example:

```
Subodh

├── Reservation #1
└── Reservation #2
```

---

## 2. Show

### Purpose

Represents a single cinema show available for booking.

Since this project focuses on concurrency instead of movie management, the **Movie** entity is intentionally omitted.

Each show contains all information required for users to reserve seats.

### Example

```
Title: Avengers
Hall: Hall A
Time: 7:00 PM
```

| Column | Type | Constraints |
|---------|------|------------|
| id | UUID | PK |
| title | VARCHAR | |
| hall | VARCHAR | |
| showTime | TIMESTAMP | |
| createdAt | TIMESTAMP | |

### Relationships

### Show → Seat (One-to-Many)

Each show owns its own seat inventory.

Example

```
Show (7 PM)

A1
A2
A3

Show (10 PM)

A1
A2
A3
```

Although the seat numbers are identical, they belong to different shows.

---

## 3. Seat

### Purpose

Represents an individual bookable seat.

Seats are the main resource where concurrency happens.

### Example

```
A1
A2
A3
B1
B2
```

| Column | Type | Constraints |
|---------|------|------------|
| id | UUID | PK |
| showId | UUID | FK → Show.id |
| seatNumber | VARCHAR | |
| section | VARCHAR | |
| price | DECIMAL | |
| createdAt | TIMESTAMP | |

### Relationships

### Seat → Show (Many-to-One)

Many seats belong to one show.

```
Show

├── A1
├── A2
├── A3
└── B1
```

### Seat → ReservationSeat (One-to-Many)

One seat can appear in many ReservationSeat records over time.

Example

```
Seat A1

Reservation #1 (Expired)

Reservation #2 (Confirmed)

Reservation #3 (Cancelled)
```

---

## 4. Reservation

### Purpose

Represents a booking attempt made by a user.

A reservation starts as **HELD**.

It later becomes:

- CONFIRMED
- EXPIRED
- CANCELLED

| Column | Type | Constraints |
|---------|------|------------|
| id | UUID | PK |
| userId | UUID | FK → User.id |
| status | ENUM | HELD / CONFIRMED / EXPIRED / CANCELLED |
| expiresAt | TIMESTAMP | |
| createdAt | TIMESTAMP | |

### Reservation Status Flow

```
HELD
 │
 ├────────► CONFIRMED
 │
 ├────────► EXPIRED
 │
 └────────► CANCELLED
```

### Relationships

### Reservation → User (Many-to-One)

Many reservations belong to one user.

Example

```
User

Reservation #1

Reservation #2

Reservation #3
```

### Reservation → ReservationSeat (One-to-Many)

One reservation can contain multiple seats.

Example

```
Reservation

├── A1
├── A2
└── A3
```

---

## 5. ReservationSeat

### Purpose

ReservationSeat is the junction table between Reservation and Seat.

It converts the many-to-many relationship into two one-to-many relationships.

| Column | Type | Constraints |
|---------|------|------------|
| reservationId | UUID | PK, FK → Reservation.id |
| seatId | UUID | PK, FK → Seat.id |

### Composite Primary Key

```
(reservationId, seatId)
```

### Why is this table needed?

A reservation may contain multiple seats.

Example

```
Reservation #10

A1
A2
A3
```

Likewise, a seat can appear in multiple reservations over time.

Example

```
Seat A1

↓

Reservation #1 (Expired)

↓

Reservation #2 (Confirmed)
```

Instead of storing a seat directly inside Reservation, we create a junction table.

```
Reservation

↓

ReservationSeat

↓

Seat
```

---

# Complete Entity Relationship Diagram

```
               User
                 │
              1  │  N
                 │
          Reservation
                 │
              1  │  N
                 │
       ReservationSeat
                 │
              N  │  1
                 │
               Seat
                 │
              N  │  1
                 │
               Show
```

---

# Relationship Summary

| Relationship | Type | Purpose |
|--------------|------|---------|
| User → Reservation | One-to-Many | One user can make multiple reservations |
| Show → Seat | One-to-Many | Each show owns its own seats |
| Seat → ReservationSeat | One-to-Many | Tracks seat reservation history |
| Reservation → ReservationSeat | One-to-Many | One reservation can contain multiple seats |

---

# Booking Flow

```
1. User logs in
        │
2. User selects a Show
        │
3. System loads all seats
        │
4. User selects seats (A1, A2)
        │
5. Database transaction starts
        │
6. Selected seats are locked
        │
7. Reservation created (HELD)
        │
8. ReservationSeat records created
        │
9. Expiration job added to BullMQ
        │
10. User completes simulated payment
        │
11. Reservation becomes CONFIRMED
             OR
12. Reservation expires automatically
```

---

# Why This Design Supports Concurrency

The critical entity is **Seat**, because multiple users compete for the same resource.

Example:

```
Seat A1

↓

User A clicks Reserve

↓

User B clicks Reserve

↓

Both requests arrive simultaneously
```

The system prevents double booking by using:

- Database transactions
- Row-level locking (`SELECT ... FOR UPDATE`)
- Reservation status validation
- Automatic expiration of held reservations

This guarantees:

```
One seat

↓

One active reservation
```

at any given time.

---

# Why ReservationSeat Exists

Without ReservationSeat:

```
Reservation

seatId
```

A reservation could store only one seat.

With ReservationSeat:

```
Reservation

↓

ReservationSeat

↓

Seat
```

A reservation can contain:

```
A1

A2

A3

A4
```

while still preserving booking history for every seat.

---

# Final Entity List

- User
- Show
- Seat
- Reservation
- ReservationSeat

---

# Features Supported

This schema supports all planned features:

- User Authentication
- Role-based Authorization
- Show Management (Admin)
- Seat Management (Admin)
- Browse Shows
- Browse Seats
- Multi-seat Reservation
- Concurrent Seat Booking
- Row-level Locking
- Transactions
- Reservation Expiration (BullMQ)
- Simulated Payment Confirmation
- Redis Caching
- Socket.io Real-time Updates
- Rate Limiting
- Docker Deployment

The database is intentionally kept small while still demonstrating real-world backend concepts such as transactions, concurrency control, background jobs, caching, and scalable API design.
