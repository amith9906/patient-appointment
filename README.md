# MediSchedule - Patient Appointment Scheduling System

A full-stack hospital management system built with Node.js, React, PostgreSQL, and Sequelize.

## Features
- **Hospitals** - Register and manage hospitals
- **Departments** - Manage hospital departments
- **Doctors** - Doctor profiles, availability, schedules
- **Patients** - Patient registration with full medical history
- **Appointments** - Schedule, track, and manage appointments
- **Medications/Tablets** - Inventory management with stock tracking
- **Labs** - Lab management and test ordering/results
- **Reports** - Upload and download medical reports (PDF, images, docs)
- **Authentication** - JWT-based auth with role-based access (admin, doctor, receptionist, lab_technician)

## Tech Stack
- **Backend**: Node.js + Express + Sequelize ORM + PostgreSQL
- **Frontend**: React 18 + React Router v6 + Axios
- **Auth**: JWT + bcryptjs
- **File Upload**: Multer

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database
Create a PostgreSQL database:
```sql
CREATE DATABASE patient_scheduling;
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env with your DB credentials
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm start
```

### 4. First Login
Register an admin account at http://localhost:3000/register

## API Endpoints

| Module | Base URL |
|--------|----------|
| Auth | `/api/auth` |
| Hospitals | `/api/hospitals` |
| Departments | `/api/departments` |
| Doctors | `/api/doctors` |
| Patients | `/api/patients` |
| Appointments | `/api/appointments` |
| Medications | `/api/medications` |
| Labs | `/api/labs` |
| Reports | `/api/reports` |
