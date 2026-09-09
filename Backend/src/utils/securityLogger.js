const fs = require('node:fs');
const path = require('node:path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'security.log');

if (!fs.existsSync(LOG_DIR)) {
   fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logSecurityEvent = ({
   event,
   ip,
   method,
   route,
   details = {},
}) => {
   const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ip,
      method,
      route,
      details,
   };

   /*
    * CS-15-T3:
    * Write structured security events to stdout so Google Cloud Run
    * can capture them in Cloud Logging.
    */
   console.warn(
      '[SECURITY]',
      JSON.stringify(logEntry)
   );

   /*
    * Keep a local security.log file for development/testing.
    * Cloud Run file storage is temporary, so Cloud Logging is the
    * primary log destination in production.
    */
   if (process.env.NODE_ENV !== 'production') {
      fs.appendFile(
         LOG_FILE,
         JSON.stringify(logEntry) + '\n',
         (err) => {
            if (err) {
               console.error(
                  '[SECURITY LOGGER] Failed to write log:',
                  err.message
               );
            }
         }
      );
   }
};

const monitorSecurityEvent = ({ event, ip }) => {
    if (!ip) return;

    const monitoredEvents = [
        'INVALID_TOKEN_USAGE',
        'AUTHENTICATION_FAILURE',
    ];

    if (!monitoredEvents.includes(event)) {
        return;
    }

    const now = Date.now();

    if (!eventHistory.has(ip)) {
        eventHistory.set(ip, []);
    }

    const events = eventHistory.get(ip);

    const recentEvents = events.filter(
        timestamp => now - timestamp < WINDOW_MS
    );

    recentEvents.push(now);
    eventHistory.set(ip, recentEvents);

    if (recentEvents.length >= THRESHOLD) {
        writeSecurityLog({
            event: 'SUSPICIOUS_ACTIVITY',
            ip,
            details: [
                `${recentEvents.length} ${event} events within 5 minutes`,
            ],
        });

        eventHistory.set(ip, []);
    }
};

const logSecurityEvent = ({
    event,
    ip,
    method,
    route,
    details = [],
}) => {
    // Write the original event
    writeSecurityLog({
        event,
        ip,
        method,
        route,
        details,
    });

    // Monitor it for suspicious repeated activity
    monitorSecurityEvent({
        event,
        ip,
    });
};

module.exports = { logSecurityEvent }; // export function
