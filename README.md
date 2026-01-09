# 🗳️ PROK Vote - Real-Time On-Site Electronic Voting System

Enterprise-grade web-based voting platform for offline meeting environments with dual-layer authentication and sub-second real-time synchronization.

## ✨ Key Features

- **🔒 Dual Authentication**: QR tokens + GPS geofencing + dynamic access codes
- **⚡ Real-time Sync**: <1s latency via Socket.io for all participants
- **📱 No App Required**: PWA-based, works via QR scan on any smartphone
- **👥 Multi-Role**: Admin, Moderator, and Voter interfaces
- **📊 Live Dashboard**: Real-time voting statistics and stadium display
- **🎨 Customizable**: 3 theme presets with hot-swap capability

## 🏗️ Architecture

```
Frontend (Next.js PWA)
    ↓ WebSocket
Backend (NestJS + Socket.io)
    ↓
PostgreSQL + Redis
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)

### Option 1: Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Local Development

#### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run start:dev
```

#### Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

#### Database Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE prok_vote;

# Run schema
psql -U postgres -d prok_vote -f database/schema.sql
```

## 📖 User Guides

### Admin Workflow

1. Create a new voting session
2. Generate QR codes (PDF with 20 codes per page)
3. Print and distribute QR codes to participants
4. Configure GPS location and access code
5. Create voting agendas
6. Control voting stages: Submit → Start → End → Announce

### Moderator Workflow

1. Monitor real-time voting rate
2. Announce results when ready
3. Use hotkey `R` to trigger re-vote if needed

### Voter Workflow

1. Scan QR code with smartphone
2. Verify GPS location (automatic)
3. Enter 4-digit access code displayed on screen
4. Wait for admin to start voting
5. Cast vote (찬성/반대/기권)
6. Confirm with large-font popup

## 🔐 Security Features

- **Browser Fingerprinting**: Each QR token binds to one device only
- **GPS Geofencing**: 50-100m radius verification (configurable)
- **Dynamic Access Codes**: 4-digit codes with TTL expiration
- **Token Revocation**: "Important vote" mode invalidates all existing tokens
- **Audit Logging**: All actions logged with IP and user agent

## 🧪 Testing

```bash
# Backend unit tests
cd backend
npm test

# E2E tests
npm run test:e2e

# Load testing (requires Artillery)
artillery run test/load/voting.scenario.yml
```

## 📦 Production Deployment

### Environment Variables

Update `.env` files with production values:
- Strong JWT secrets
- Production database credentials
- HTTPS URLs for CORS

### Build & Deploy

```bash
# Build backend
cd backend
npm run build
npm run start:prod

# Build frontend
cd frontend
npm run build
npm start
```

### Recommended Infrastructure

- **Hosting**: AWS EC2 / GCP Compute Engine / DigitalOcean
- **Database**: Managed PostgreSQL (AWS RDS / GCP Cloud SQL)
- **Redis**: Managed Redis (AWS ElastiCache / GCP Memorystore)
- **Load Balancer**: For horizontal scaling (500+ concurrent users)
- **CDN**: CloudFlare for static assets

## 🛠️ Tech Stack

### Backend
- NestJS - Progressive Node.js framework
- Socket.io - Real-time bidirectional communication
- TypeORM - ORM for PostgreSQL
- Redis - Session store and token cache
- JWT - Authentication tokens

### Frontend
- Next.js 14 - React framework with App Router
- Socket.io Client - WebSocket communication
- jsPDF + qrcode - QR code PDF generation
- Recharts - Data visualization
- React Spring - Animations
- Tailwind CSS - Styling

### Database
- PostgreSQL 15 - Primary database
- Redis 7 - Cache and session store

## 📝 API Documentation

### Authentication Endpoints

- `POST /auth/generate-tokens` - Generate QR tokens
- `POST /auth/verify-qr` - Verify QR token and bind device
- `POST /auth/verify-code` - Verify access code
- `POST /auth/verify-gps` - Verify GPS location

### Voting Endpoints

- `GET /sessions` - List all sessions
- `POST /sessions` - Create new session
- `GET /sessions/:id/agendas` - Get session agendas
- `POST /votes` - Cast vote
- `GET /votes/stats/:agendaId` - Get voting statistics

### WebSocket Events

- `stage:update` - Stage change broadcast
- `vote:cast` - Vote submission
- `vote:ended` - Voting ended signal
- `result:publish` - Results announcement

## 🤝 Contributing

This is an enterprise internal project. For bug reports or feature requests, contact the development team.

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For technical support, contact: [Your Support Email]

---

**Built with ❤️ by Anti-gravity Development Team**
