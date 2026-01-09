# 🚀 Quick Start Guide - PROK Vote

## Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/))

---

## ⚡ Fast Track (Recommended)

### 1. Install Dependencies

```bash
./install.sh
```

This will install all npm packages for both backend and frontend.

### 2. Configure Environment

```bash
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env if needed (default values work for local development)

# Frontend configuration
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local if needed
```

### 3. Start Everything with Docker

```bash
./start.sh
```

This single command will:
- ✅ Start PostgreSQL database
- ✅ Start Redis cache
- ✅ Initialize database schema
- ✅ Start NestJS backend on port 3001
- ✅ Start Next.js frontend on port 3000

### 4. Access the Application

- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:3001/api (if Swagger is added)

---

## 🛠️ Manual Setup (Without Docker)

### 1. Start PostgreSQL

```bash
# Install PostgreSQL 15+
# macOS: brew install postgresql@15
# Ubuntu: sudo apt install postgresql-15

# Create database
psql -U postgres -c "CREATE DATABASE prok_vote;"

# Run schema
psql -U postgres -d prok_vote -f database/schema.sql
```

### 2. Start Redis

```bash
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
```

### 3. Start Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run start:dev
```

Backend will start on http://localhost:3001

### 4. Start Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend will start on http://localhost:3000

---

## 📋 Testing the Backend

### 1. Create a Session

```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Voting Session",
    "description": "Testing the voting system",
    "gpsLat": 37.5665,
    "gpsLng": 126.9780,
    "gpsRadius": 100,
    "gpsEnabled": true
  }'
```

### 2. Generate QR Tokens

```bash
# Replace SESSION_ID with the ID from previous response
curl -X POST http://localhost:3001/auth/generate-tokens \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "count": 20
  }'
```

### 3. Create an Agenda

```bash
curl -X POST http://localhost:3001/sessions/agendas \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "title": "제1호 안건: 회의록 승인",
    "description": "지난 회의록을 승인합니다.",
    "displayOrder": 1
  }'
```

### 4. Test WebSocket Connection

Create a test file `test-socket.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');
  
  // Join session
  socket.emit('join:session', {
    sessionId: 'SESSION_ID',
    role: 'admin'
  });
});

socket.on('stage:changed', (data) => {
  console.log('📢 Stage changed:', data);
});

socket.on('stats:updated', (data) => {
  console.log('📊 Stats updated:', data);
});
```

Run: `node test-socket.js`

---

## 🐛 Troubleshooting

### Docker containers won't start

```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: deletes database data)
docker-compose down -v

# Rebuild and start
docker-compose up -d --build
```

### PostgreSQL connection error

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Connect to database
docker exec -it prok-vote-db psql -U postgres -d prok_vote
```

### Backend compilation errors

```bash
cd backend
rm -rf node_modules dist
npm install
npm run build
```

### Port already in use

```bash
# Find process using port 3001
lsof -ti:3001

# Kill process
kill -9 $(lsof -ti:3001)
```

---

## 📊 View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

---

## 🛑 Stop Services

```bash
# Stop all containers (preserves data)
docker-compose down

# Stop and remove volumes (deletes database)
docker-compose down -v
```

---

## ✅ Next Steps

1. **Frontend Development**: Build the admin dashboard, voter interface, and stadium display
2. **QR PDF Generator**: Implement the PDF generation with 20 QR codes per page
3. **Testing**: Load test with 500+ concurrent users
4. **Deployment**: Configure production environment variables and deploy to cloud

---

## 🆘 Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review the [implementation plan](implementation_plan.md)
- Contact the development team

---

**Happy Coding! 🗳️**
