# API Best Practices Implementations

This file documents a few infrastructure additions implemented to improve API compatibility, observability, and safety.

- **API Versioning**: All routes are mounted under `/api/v1`. The root `/api` returns a deprecation notice and points to `/api/v1`.
- **Request Logging**: A structured request logger is available at `src/middleware/logging.middleware.js` which generates request IDs, logs latency and status, and writes to `logs/api.log`.
- **Schema Validation**: `Joi`-based validation middleware is in `src/middleware/validation.middleware.js`. Example user schemas are in `src/validation/user.validation.js` and are applied to `/users/signup` and `/users/signin`.
- **DB Query Auditing**: Native MongoDB collections are wrapped with a lightweight auditor (`src/config/queryAuditor.js`) that logs slow queries (>100ms) to `logs/db_queries.log`. A Mongoose plugin (`src/config/mongooseAudit.js`) is also applied globally to catch slow Mongoose operations and log them to `logs/mongoose_queries.log`.

To change thresholds, edit the `100` ms constants in `src/config/queryAuditor.js` and `src/config/mongooseAudit.js`.
