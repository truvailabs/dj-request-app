#!/usr/bin/env bash
# Runs both the backend (Railway target) and frontend (Vercel target) locally
# for manual testing. Ctrl+C stops both.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "Stopping..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://localhost:4000 ..."
(cd "$DIR/backend" && npm run dev) &
BACKEND_PID=$!

sleep 1

echo "Starting frontend on http://localhost:5173 ..."
(cd "$DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "Attendee page:   http://localhost:5173/"
echo "DJ dashboard:    http://localhost:5173/dj"
echo "Backend health:  http://localhost:4000/health"
echo ""
echo "Press Ctrl+C to stop both."

wait
