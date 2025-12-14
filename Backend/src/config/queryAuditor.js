const fs = require('fs');
const path = require('path');

const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const dbLogFile = path.join(logDir, 'db_queries.log');

function logDb(entry) {
    try {
        fs.appendFileSync(dbLogFile, JSON.stringify(entry) + '\n');
    } catch (e) {
        // ignore best-effort
    }
}

function wrapCollection(collection) {
    const methodsToWrap = ['find', 'insertOne', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'aggregate', 'findOne'];

    const proxy = new Proxy(collection, {
        get(target, prop) {
            const orig = target[prop];
            if (typeof prop === 'string' && methodsToWrap.includes(prop) && typeof orig === 'function') {
                return function(...args) {
                    const start = process.hrtime();
                    const result = orig.apply(target, args);
                    const finalize = (outcome) => {
                        const diff = process.hrtime(start);
                        const ms = (diff[0] * 1e3) + (diff[1] / 1e6);
                        const entry = {
                            time: new Date().toISOString(),
                            collection: target.collectionName,
                            method: prop,
                            durationMs: Math.round(ms * 100) / 100,
                            argsSummary: (args && args[0]) ? JSON.stringify(args[0]) : undefined
                        };
                        if (entry.durationMs > 100) { // threshold
                            console.warn('Slow DB query:', entry);
                            logDb(entry);
                        }
                        return outcome;
                    };

                    // handle cursor and promise results
                    if (prop === 'find' || prop === 'aggregate') {
                        // find returns a cursor; wrap exec-like iteration
                        const cursor = result;
                        const origToArray = cursor.toArray ? cursor.toArray.bind(cursor) : null;
                        if (origToArray) {
                            cursor.toArray = async function() {
                                const res = await origToArray();
                                finalize();
                                return res;
                            };
                        } else {
                            finalize();
                        }
                        return cursor;
                    }

                    if (result && typeof result.then === 'function') {
                        return result.then(r => finalize(r));
                    }
                    // synchronous fallback
                    finalize(result);
                    return result;
                };
            }
            return orig;
        }
    });
    return proxy;
}

function enableQueryAuditing(db) {
    const origCollection = db.collection.bind(db);
    db.collection = function(name, options) {
        const collection = origCollection(name, options);
        return wrapCollection(collection);
    };
}

module.exports = {
    enableQueryAuditing,
};
