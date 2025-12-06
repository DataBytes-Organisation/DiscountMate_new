#!/bin/bash

# Service management script for ML Service

SERVICE_NAME="ML Service"
PORT=5001
PID_FILE="ml-service.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

start_service() {
    if check_port; then
        echo -e "${RED}Error: Port $PORT is already in use${NC}"
        echo "Use './manage.sh stop' to stop the existing service"
        echo "Or use './manage.sh status' to see what's running"
        exit 1
    fi

    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python3 -m venv venv
    fi

    echo -e "${GREEN}Starting $SERVICE_NAME on port $PORT...${NC}"
    source venv/bin/activate
    nohup python app.py > ml-service.log 2>&1 &
    echo $! > $PID_FILE
    sleep 2

    if check_port; then
        echo -e "${GREEN}✓ Service started successfully on port $PORT${NC}"
        echo "Logs: tail -f ml-service.log"
        echo "Health check: curl http://localhost:$PORT/health"
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        echo "Check ml-service.log for errors"
        exit 1
    fi
}

stop_service() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat $PID_FILE)
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $SERVICE_NAME (PID: $PID)...${NC}"
            kill $PID
            rm $PID_FILE
            sleep 1
        else
            echo -e "${YELLOW}PID file exists but process not found. Cleaning up...${NC}"
            rm $PID_FILE
        fi
    fi

    # Also kill any processes using the port
    PIDS=$(lsof -ti :$PORT 2>/dev/null)
    if [ ! -z "$PIDS" ]; then
        echo -e "${YELLOW}Stopping processes on port $PORT...${NC}"
        echo $PIDS | xargs kill 2>/dev/null
        sleep 1
    fi

    if check_port; then
        echo -e "${RED}✗ Failed to stop service${NC}"
        echo "You may need to manually kill the process: kill \$(lsof -ti :$PORT)"
    else
        echo -e "${GREEN}✓ Service stopped${NC}"
    fi
}

status_service() {
    if check_port; then
        echo -e "${GREEN}✓ $SERVICE_NAME is running on port $PORT${NC}"
        echo ""
        echo "Processes using port $PORT:"
        lsof -i :$PORT
        echo ""
        if [ -f "$PID_FILE" ]; then
            PID=$(cat $PID_FILE)
            echo "PID file: $PID_FILE (PID: $PID)"
        fi
    else
        echo -e "${RED}✗ $SERVICE_NAME is not running${NC}"
    fi
}

restart_service() {
    echo "Restarting $SERVICE_NAME..."
    stop_service
    sleep 2
    start_service
}

case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        status_service
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the ML service"
        echo "  stop    - Stop the ML service"
        echo "  restart - Restart the ML service"
        echo "  status  - Check if service is running"
        exit 1
        ;;
esac

