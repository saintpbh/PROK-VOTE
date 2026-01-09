#!/bin/bash

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo "✅ Dependencies installed successfully!"
echo ""
echo "🚀 Next steps:"
echo "  1. Review and update environment variables:"
echo "     - backend/.env"
echo "     - frontend/.env.local"
echo "  2. Start development:"
echo "     - With Docker: ./start.sh"
echo "     - Manual: cd backend && npm run start:dev"
