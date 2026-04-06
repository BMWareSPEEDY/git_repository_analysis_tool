#!/usr/bin/env bash

# Exit if any command fails
set -e

echo "🚀 Starting AI Codebase Explainer..."

# ==========================================
# Resolve REAL script location (works with symlinks)
# ==========================================
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
PROJECT_ROOT="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

echo "📁 Project root: $PROJECT_ROOT"

# ==========================================
# Cleanup function
# ==========================================
cleanup() {
    echo -e "\n🛑 Stopping servers..."

    if [ -n "${BACKEND_PID}" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi

    if [ -n "${FRONTEND_PID}" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    echo "✅ Shutdown complete."
    exit 0
}

trap cleanup SIGINT SIGTERM

# ==========================================
# 1. Start Backend (FastAPI)
# ==========================================
echo "📦 Starting Python backend (Port 8000)..."

cd "$PROJECT_ROOT/backend"

# Activate virtual environment if it exists
if [ -d "$PROJECT_ROOT/.venv" ]; then
    echo "🐍 Activating virtual environment..."
    source "$PROJECT_ROOT/.venv/bin/activate"
fi

# Start backend
python3 main.py > "$PROJECT_ROOT/backend.log" 2>&1 &
BACKEND_PID=$!

# ==========================================
# 2. Start Frontend (Vite)
# ==========================================
echo "🎨 Starting Vite frontend (Port 5173)..."

cd "$PROJECT_ROOT/frontend"

npm run dev > "$PROJECT_ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!

# ==========================================
# 3. Wait and Open Browser
# ==========================================
echo "⏳ Waiting for servers to initialize..."
sleep 3

echo "🌐 Opening http://localhost:5173 ..."
open "http://localhost:5173"

echo "----------------------------------------"
echo "✅ All systems go!"
echo "Backend log: $PROJECT_ROOT/backend.log"
echo "Frontend log: $PROJECT_ROOT/frontend.log"
echo "Press Ctrl+C to stop both servers."
echo "----------------------------------------"

# Keep script alive to handle Ctrl+C
wait