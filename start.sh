#!/bin/bash
# ANAMAC Bid Intelligence Platform — Startup Script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  ANAMAC Bid Intelligence Platform"
echo "=========================================="

# Kill any existing instances
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start Backend
echo "Starting Backend (FastAPI)..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2

# Verify backend
if curl -s http://localhost:8000/health | grep -q '"ok"'; then
    echo "Backend running on http://localhost:8000"
else
    echo "Backend failed to start!"
    exit 1
fi

# Start Frontend
echo "Starting Frontend (Vite)..."
cd "$SCRIPT_DIR/frontend"
npx vite --port 5173 &
FRONTEND_PID=$!
sleep 3

echo ""
echo "=========================================="
echo "  Platform Ready!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
