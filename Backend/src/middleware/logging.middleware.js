const fs = require('fs');
const path = require('path');

// Simple UUID v4 generator to avoid extra dependencies
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'api.log');

function logToFile(entry) {
    try {
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (e) {
        /* best-effort logging */
        // ignore
    }
}

function requestLogger(req, res, next) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    const start = process.hrtime();
    const { method, originalUrl } = req;

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const latencyMs = (diff[0] * 1e3) + (diff[1] / 1e6);
        const entry = {
            time: new Date().toISOString(),
            requestId,
            method,
            path: originalUrl,
            status: res.statusCode,
            latencyMs: Math.round(latencyMs * 100) / 100,
            remoteAddr: req.ip || req.connection.remoteAddress
        };
        // Console for quick visibility and file for persistent tracing
        console.log(JSON.stringify(entry));
        logToFile(entry);
    });

    next();
}

module.exports = requestLogger;
