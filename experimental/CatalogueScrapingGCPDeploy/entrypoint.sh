#!/bin/sh
echo "Starting cron in foreground..."

# Ensure log file exists
touch /var/log/cron.log

# Start cron in the background
/usr/sbin/cron

# Simple heartbeat so you see container is alive
echo "Cron started. Tailing /var/log/cron.log..."
tail -f /var/log/cron.log
