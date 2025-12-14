const fs = require('fs');
const path = require('path');

const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const dbLogFile = path.join(logDir, 'mongoose_queries.log');

function logEntry(entry) {
    try { fs.appendFileSync(dbLogFile, JSON.stringify(entry) + '\n'); } catch (e) { }
}

function plugin(schema) {
    ['find', 'findOne', 'updateOne', 'updateMany', 'save', 'remove'].forEach((hook) => {
        if (hook === 'save' || hook === 'remove') {
            schema.pre(hook, function(next) {
                this._startTime = process.hrtime();
                next();
            });
            schema.post(hook, function(doc) {
                const diff = process.hrtime(this._startTime);
                const ms = (diff[0] * 1e3) + (diff[1] / 1e6);
                const entry = { time: new Date().toISOString(), hook, durationMs: Math.round(ms * 100) / 100 };
                if (entry.durationMs > 100) { logEntry(entry); console.warn('Slow mongoose operation', entry); }
            });
        } else {
            schema.pre(hook, function() {
                this._startTime = process.hrtime();
            });
            schema.post(hook, function(result) {
                const diff = process.hrtime(this._startTime);
                const ms = (diff[0] * 1e3) + (diff[1] / 1e6);
                const entry = { time: new Date().toISOString(), hook, durationMs: Math.round(ms * 100) / 100 };
                if (entry.durationMs > 100) { logEntry(entry); console.warn('Slow mongoose operation', entry); }
            });
        }
    });
}

module.exports = plugin;
