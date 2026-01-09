#!/bin/bash

# PROK Vote - Quick Start Script

echo "🗳️  PROK Vote - Starting Development Environment"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

echo "✅ Docker is running"
echo ""

echo "🔄 Updating Network Configuration..."
node scripts/update-ip.js
echo ""

# Check if .env files exist
if [ ! -f backend/.env ]; then
  echo "📝 Creating backend/.env from template..."
  cp backend/.env.example backend/.env
  echo "⚠️  Please review backend/.env and update configuration if needed"
fi

if [ ! -f frontend/.env.local ]; then
  echo "📝 Creating frontend/.env.local from template..."
  cp frontend/.env.local.example frontend/.env.local
  echo "⚠️  Please review frontend/.env.local and update configuration if needed"
fi

echo ""
echo "🚀 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "✅ Services are starting!"
echo ""
echo "📍 Access points:"
echo "  - Backend API:  http://localhost:3001"
echo "  - Frontend:     http://localhost:3000"
echo "  - PostgreSQL:   localhost:5432"
echo "  - Redis:        localhost:6379"
echo ""
echo "📊 View logs:"
echo "  docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "  docker-compose down"
echo ""
echo "Happy voting! 🗳️"
