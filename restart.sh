#!/bin/bash

echo "🛑 Stopping running servers..."
# Kill processes on ports 3010 and 3011
lsof -ti:3010 | xargs kill -9 2>/dev/null
lsof -ti:3011 | xargs kill -9 2>/dev/null
sleep 1
echo "✅ Servers stopped."
echo ""

# Update IP and Configs
npm run update-ip

echo ""
echo "🚀 Starting Servers..."
echo "---------------------------------------------------"
# Use concurrently to run both
npx concurrently -k -n "BACKEND,FRONTEND" -c "blue,magenta" \
    "cd backend && PORT=3011 npm run start:dev" \
    "cd frontend && npm run dev -- -p 3010"
