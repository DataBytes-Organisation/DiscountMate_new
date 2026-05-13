#!/bin/bash

# Analytics Service Management Script
# Usage: ./manage.sh [start|stop|status|restart]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ANALYTICS_PORT=${ANALYTICS_SERVICE_PORT:-5002}
PID_FILE="analytics-service.pid"
LOG_FILE="analytics-service.log"

# Function to find process by port
find_process_by_port() {
    lsof -ti:$ANALYTICS_PORT 2>/dev/null || echo ""
}

# Function to start the service
start_service() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            echo "⚠️  Service is already running (PID: $OLD_PID)"
            return 1
        else
            rm -f "$PID_FILE"
        fi
    fi

    # Check if port is in use
    EXISTING_PID=$(find_process_by_port)
    if [ -n "$EXISTING_PID" ]; then
        echo "⚠️  Port $ANALYTICS_PORT is already in use by process $EXISTING_PID"
        echo "   Run './manage.sh stop' first, or use a different port"
        return 1
    fi

    echo "🚀 Starting Analytics Service..."

    # Activate venv and start service in background
    if [ ! -d "venv" ]; then
        echo "❌ Virtual environment not found. Run ./start.sh first"
        return 1
    fi

    source venv/bin/activate
    nohup python app.py > "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    echo $NEW_PID > "$PID_FILE"

    # Wait a moment to check if it started successfully
    sleep 2
    if ps -p "$NEW_PID" > /dev/null 2>&1; then
        echo "✅ Analytics Service started successfully (PID: $NEW_PID)"
        echo "   Port: $ANALYTICS_PORT"
        echo "   Logs: $LOG_FILE"
        echo "   Health check: http://localhost:$ANALYTICS_PORT/health"
    else
        echo "❌ Failed to start service. Check $LOG_FILE for errors"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Function to stop the service
stop_service() {
    PID=$(find_process_by_port)

    if [ -f "$PID_FILE" ]; then
        FILE_PID=$(cat "$PID_FILE")
        if ps -p "$FILE_PID" > /dev/null 2>&1; then
            PID="$FILE_PID"
        fi
    fi

    if [ -z "$PID" ]; then
        echo "ℹ️  No Analytics Service process found on port $ANALYTICS_PORT"
        rm -f "$PID_FILE"
        return 0
    fi

    echo "🛑 Stopping Analytics Service (PID: $PID)..."
    kill "$PID" 2>/dev/null || true

    # Wait for process to stop
    sleep 2

    if ps -p "$PID" > /dev/null 2>&1; then
        echo "⚠️  Process still running, forcing stop..."
        kill -9 "$PID" 2>/dev/null || true
        sleep 1
    fi

    rm -f "$PID_FILE"

    if ps -p "$PID" > /dev/null 2>&1; then
        echo "❌ Failed to stop service"
        return 1
    else
        echo "✅ Analytics Service stopped"
        return 0
    fi
}

# Function to check service status
check_status() {
    PID=$(find_process_by_port)

    if [ -z "$PID" ]; then
        if [ -f "$PID_FILE" ]; then
            FILE_PID=$(cat "$PID_FILE")
            if ps -p "$FILE_PID" > /dev/null 2>&1; then
                PID="$FILE_PID"
            fi
        fi
    fi

    if [ -z "$PID" ]; then
        echo "ℹ️  Analytics Service is not running"
        echo "   Port: $ANALYTICS_PORT"
        return 1
    else
        echo "✅ Analytics Service is running"
        echo "   PID: $PID"
        echo "   Port: $ANALYTICS_PORT"
        echo "   Health: http://localhost:$ANALYTICS_PORT/health"

        # Try to get process info
        if command -v ps &> /dev/null; then
            echo ""
            echo "Process info:"
            ps -p "$PID" -o pid,ppid,cmd,etime 2>/dev/null || true
        fi
        return 0
    fi
}

# Main command handling
case "${1:-}" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    status)
        check_status
        ;;
    restart)
        stop_service
        sleep 1
        start_service
        ;;
    *)
        echo "Analytics Service Management"
        echo ""
        echo "Usage: $0 [start|stop|status|restart]"
        echo ""
        echo "Commands:"
        echo "  start   - Start the analytics service"
        echo "  stop    - Stop the analytics service"
        echo "  status  - Check service status"
        echo "  restart - Restart the analytics service"
        echo ""
        echo "Environment variables:"
        echo "  ANALYTICS_SERVICE_PORT - Port to run on (default: 5002)"
        exit 1
        ;;
esac

