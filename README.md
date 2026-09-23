# DSA Media Crew — Production Backend & API Architecture

A high-performance backend, database, and REST API suite powering the **DSA Media Crew** platform. Built with Next.js/Express, Prisma ORM, JWT Authentication with Role-Based Access Control (RBAC), Zod Validation, Multer/Cloudinary media pipelines, and a Jest + Supertest test suite.

---

## 🚀 Key Features

* **Database Engine & ORM**: Prisma ORM with SQLite (local development) and PostgreSQL support (`DATABASE_URL`).
* **Role-Based Access Control (RBAC)**: Secure JWT authentication supporting 9 hierarchy roles:
  * `SUPER_ADMIN` — Unrestricted master access
  * `ADMIN` — Management of members, events, equipment, media, attendance
  * `TECHNICAL_HEAD` — Event management, crew assignments, gear allocation
  * `PHOTOGRAPHER`, `VIDEOGRAPHER`, `EDITOR`, `DESIGNER`, `SOCIAL_MEDIA_MANAGER` — Upload assets, track assigned tasks
  * `VOLUNTEER` — View events, self attendance check-in
* **Single Aggregated KPI Endpoint**: `/api/dashboard` delivers all member counts, live events, attendance metrics, equipment utilization, and weekly/monthly telemetry in one query.
* **Media Upload Pipeline**: Multi-part upload handler supporting JPG, PNG, WEBP, MP4, MOV up to 100MB, unique filename generation, thumbnail metadata extraction, and Cloudinary fallback.
* **Kanban Event Engine**: Full event lifecycle tracking (`planning`, `live`, `completed`), date ranges, priority levels, and dynamic crew assignments.
* **Equipment Inventory & Borrow System**: Gear check-out/check-in tracking with active borrower records and condition monitoring.
* **Attendance Tracking**: Real-time check-in, check-out, duration calculation, and monthly attendance statistics.
* **Zod Validation**: Every endpoint is validated with Zod schemas with uniform 200/201/400/401/403/404/500 error responses.
* **Production Automated Testing**: 100% passing Jest + Supertest suites covering Auth, Users, Events, Attendance, Equipment, Media, and Dashboard.

---

## 🛠 Tech Stack

* **Runtime**: Node.js v22+
* **Framework**: Express 5 / Next.js compatible
* **Database & ORM**: Prisma ORM (`@prisma/client` v6.4)
* **Authentication**: JWT (`jsonwebtoken`) + `bcryptjs`
* **Validation**: Zod v3.24
* **Storage**: Multer + Cloudinary SDK
* **Testing**: Jest + Supertest

---

## 📋 Database Schema

```prisma
datasource db {
  provider = "sqlite" // or "postgresql"
  url      = env("DATABASE_URL")
}

model Department       // 5 Departments (Photography, Videography, Editing, Design, Social Media)
model Role             // 9 System Roles with JSON permissions
model User             // Members with skills, attendance, category, avatar, credentials
model Event            // Title, venue, date, time, status, tasks, cover, assignments
model EventAssignment  // Relation between User and Event with responsibility
model Attendance       // Check-in, check-out, duty event, duration, status
model Equipment        // Name, category, serial number, condition, availability
model BorrowRecord     // Borrower, issue date, return date, status
model MediaAsset       // 8 Categories, resolution, type, EXIF, tags, event relation
model Notification     // User/system notifications with read status
model ActivityLog      // Audit trail of actions with user and timestamp
```

---

## 📡 REST API Documentation

### 1. Authentication
* `POST /api/auth/login` — Log in with email & password, returns JWT token & user payload
* `POST /api/auth/register` — Register a new member
* `GET /api/auth/session` — Get authenticated user profile (Bearer token required)
* `POST /api/auth/logout` — Clear auth session

### 2. Dashboard & Telemetry
* `GET /api/dashboard` — Single aggregated endpoint returning:
  * `kpis`: `{ totalMembers, activeEvents, totalEvents, uploadedPhotos, attendanceRate, gearStatusString }`
  * `upcomingEvents`: Scheduled events with crew assignments
  * `recentActivities`: Last 10 system audit entries
  * `analytics`: Weekly production hours, monthly upload trajectory, department distribution

### 3. Users & Team
* `GET /api/users` — List members with filters (`department`, `role`, `search`, `page`, `limit`)
* `GET /api/users/:id` — Full member dossier, assignments, and portfolio
* `POST /api/users` — Create new member (Admin / Tech Head)
* `PATCH /api/users/:id` — Update member details
* `DELETE /api/users/:id` — Remove member
* `GET /api/team` — Formatted roster array for client-side team cards

### 4. Events & Assignments
* `GET /api/events` — List events with status (`planning`, `live`, `completed`), search, priority
* `GET /api/events/:id` — Event details with assignments and media assets
* `POST /api/events` — Schedule new event (Admin / Tech Head)
* `PATCH /api/events/:id` — Update event status, date, venue, banner, or tasks
* `DELETE /api/events/:id` — Delete event
* `POST /api/events/:id/assign` — Assign member to event
* `DELETE /api/events/assignments/:id` — Remove assignment

### 5. Equipment Inventory
* `GET /api/equipment` — Equipment catalog with category filter, search, and active borrower
* `GET /api/equipment/:id` — Equipment details with borrow history
* `POST /api/equipment` — Register new gear
* `PATCH /api/equipment/:id` — Update gear condition or details
* `DELETE /api/equipment/:id` — Remove gear
* `POST /api/equipment/:id/borrow` — Check-out gear to team member
* `POST /api/equipment/:id/return` — Check-in gear and return to inventory

### 6. Media Assets & Gallery
* `GET /api/media` & `GET /api/photos` — Gallery assets with filters (`category`, `type`, `eventId`, `search`)
* `GET /api/media/:id` — Single media item details
* `POST /api/media/upload` — Multi-part image/video upload pipeline
* `DELETE /api/media/:id` — Delete media asset

### 7. Attendance
* `GET /api/attendance` — Attendance records with date, creator, event filters
* `POST /api/attendance/check-in` — Check-in creator on duty
* `POST /api/attendance/check-out` — Check-out creator and calculate production hours
* `GET /api/attendance/monthly` — Monthly statistics and weekly rates

### 8. Notifications & Activity Logs
* `GET /api/notifications` — Recent notifications
* `PATCH /api/notifications/:id/read` — Mark notification as read
* `POST /api/notifications/read-all` — Mark all as read
* `GET /api/activity-logs` — Audit logs

---

## ⚡ Quick Start & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file (refer to `.env.example`):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="supersecretkey"
PORT=5000
```

### 3. Generate Database & Push Schema
```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Database
Populate 65 members, 25 events, 40 gear items, 320 media assets, 50 attendance records:
```bash
npm run seed
```

### 5. Run Test Suite
```bash
npm test
```

### 6. Start Server
```bash
npm run dev
# or production start
npm start
```
The application will be live at `http://localhost:5000`.

* **Admin Portal**: `http://localhost:5000/admin/portal`
* **Admin Login**: `http://localhost:5000/admin/login` (Default credentials: `admin@dsa.com` / `admin123`)
* **Public Gallery**: `http://localhost:5000/gallery`
* **Public Team Roster**: `http://localhost:5000/team`

