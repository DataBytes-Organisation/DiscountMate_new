---
title: "Backend Tech Specs"
sidebar_label: "Tech Specs"
sidebar_position: 2
---

# Backend Tech Specs

## Local setup

From `Backend/`:

npm install
cp .env.example .env
npm start

For active development with auto-reload:

npm run dev

Runs on `http://localhost:3000`. Swagger docs at `http://localhost:3000/api-docs`.

**Never commit a real `.env` file or paste real secrets into a PR, issue, or documentation.**

## Database and migration commands

The backend is mid-migration from MongoDB to PostgreSQL. See `Backend/src/migration/README.md` for the legacy, intermediate, and finalised schema stages.

| Command                                                        | Purpose                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run setup:app-db`                                         | Set up the core app PostgreSQL database                                     |
| `npm run migrate:app`                                          | Run app database migrations                                                 |
| `npm run db:migrate` / `db:migrate:show` / `db:migrate:revert` | TypeORM migrations                                                          |
| `npm run db:silver:setup` / `db:silver:status`                 | DE-owned Silver schema (read-only from App Dev)                             |
| `npm run db:finalised:preview` / `db:finalised:apply`          | Preview/apply the finalised target schema — read the migration README first |
| `npm run migrate:all` / `reconcile:all`                        | Run all Mongo-to-Postgres migration/reconciliation phases                   |
| `npm run migrate:users` / `reconcile:users`                    | Run a single domain phase (example: users)                                  |

**Check with a team lead before running `db:finalised:*` or `migrate:all` against a shared environment** — these affect the migration state for the whole team.

## Tests and quality checks

| Command            | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `npm test`         | Node's built-in test runner                                 |
| `npm run lint`     | ESLint over `src/`                                          |
| `npm run check:ci` | Full CI gate: syntax checks + tests + migration file checks |

Run these locally before opening a PR.

## Project structure

| Path                               | Purpose                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `server.js`                        | Express app entrypoint                                                         |
| `src/config/`                      | Database connections (`database.js` for MongoDB, `postgres.js` for PostgreSQL) |
| `src/controllers/`, `src/routers/` | Route handlers and route definitions                                           |
| `src/migration/`                   | MongoDB-to-PostgreSQL migration tooling, schema docs, and diagrams             |
| `ml-service/`                      | Flask ML sidecar (recommendations, price prediction, OCR, chatbot)             |
| `test/`                            | Node test suite                                                                |

## Common troubleshooting

**"MONGO_URI is not defined" on startup**
`.env` is missing or `MONGO_URI` wasn't filled in — check against `.env.example`.

**MongoDB password with special characters fails to connect**
URL-encode special characters in the connection string password (e.g. `^` becomes `%5E`, `$` becomes `%24`).

**ML service dependency install errors**
Confirm Python 3.10 or 3.11 is used for `Backend/ml-service` — 3.12+ breaks pinned dependencies (pandas, google-auth) via missing prebuilt wheels.

**Reverse image search sidecar: "No module named uvicorn"**
Sidecar is using system Python instead of your venv. Set `RIS_PYTHON` in `.env` to your venv's Python path.

## Where to ask for help

Post in the **App Development Teams group chat**.
