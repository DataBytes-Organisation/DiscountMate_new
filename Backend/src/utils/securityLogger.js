const fs = require('node:fs'); // file system tools
const path = require('node:path'); // path tools

const LOG_DIR = path.join(process.cwd(), 'logs'); // logs folder
const LOG_FILE = path.join(LOG_DIR, 'security.log'); // log file

if (!fs.existsSync(LOG_DIR)) { // if logs folder does not exist
  fs.mkdirSync(LOG_DIR, { recursive: true }); // create it
}

const logSecurityEvent = ({ event, ip, method, route, details = [] }) => { // log security event
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(), // time of event
    event, // event type
    ip, // user IP
    method, // request method
    route, // request route
    details, // extra details
  }) + '\n'; // new line for each log

  fs.appendFile(LOG_FILE, logEntry, (err) => { // add log to file
    if (err) { // if error happens
      console.error('[SECURITY LOGGER] Failed to write log:', err.message); // show error
    }
  });
};

module.exports = { logSecurityEvent }; // export function