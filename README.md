# Metro System

A real-time metro management application with Node.js backend and vanilla JavaScript frontend.

## Features

- Station management with sorting
- Admin login with JWT authentication
- Real-time announcements via Socket.IO
- Train animation in waiting room
- Rate limiting and security headers
- Automated tests with Jest

## Quick Start

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

Backend runs on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npx http-server -p 8080
```

Frontend runs on `http://localhost:8080`

## API Endpoints

```
GET    /health                              - Health check
GET    /api/v1/stations                     - Get all stations
POST   /api/v1/auth/login                   - Admin login
GET    /api/v1/stations/:id/announcements   - Get announcements
POST   /api/v1/stations/:id/announcements   - Create announcement (admin only)
```

## Testing

```bash
cd backend
npm test
```

Expected: `Test Suites: 1 passed, Tests: 5 passed`

## Deployment

See `RENDER_DEPLOYMENT.md` for deployment instructions.

## Postman Collection

Import `Metro_API_Collection.postman_collection.json` in Postman to test all endpoints.

