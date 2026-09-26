# StockSense

StockSense is an inventory management system for tracking products, warehouses, locations, and stock movements. It is a local-development prototype built around an append-only stock ledger. It is **not yet safe to expose as a production service**; known security and deployment gaps are listed below.

“Real time” here means that a committed movement in this StockSense database is broadcast over WebSocket and connected dashboards refresh. It does not mean StockSense is connected to a supplier, ERP, marketplace, or public inventory feed.

## What It Does

- Maintains product, category, warehouse, and location records.
- Supports receipts, deliveries, internal transfers, adjustments, and reorder drafts.
- Routes stock changes through one ledger engine; current per-location balances are derived from ledger movements.
- Shows dashboard KPIs, reorder alerts, product stock by location, operations, and paginated movement history.
- Provides manager/staff UI states, HTTP API authentication, role checks, and OTP password reset.
- Broadcasts committed stock movements to connected browser clients and invalidates their cached data.

## Stack

| Area | Technology |
|------|------------|
| UI | React, TypeScript, Vite, Tailwind CSS 4, TanStack Query |
| API | FastAPI, Pydantic, SQLAlchemy async |
| Database | SQLite for local development; PostgreSQL via `asyncpg` is supported by configuration |
| Schema | Alembic migrations |
| Authentication | JWT, Argon2 password hashing, HttpOnly session cookie, OTP reset |
| Live updates | FastAPI WebSocket alerts |

## Repository Layout

```text
backend/
  app/api/v1/       REST and WebSocket endpoints
  app/core/         settings, database, security, email
  app/ledger/       authoritative stock movement engine
  app/models/       SQLAlchemy models
  app/schemas/      API request/response schemas
  alembic/          database migrations
  tests/            backend tests
frontend/
  src/pages/        dashboard, login, products, operations, history, warehouses
  src/lib/          API client and TanStack Query hooks
stocksensprogress   local progress notes; intentionally not included in Git
```

## Run Locally

Prerequisites: Python 3.11 or newer (tested with Python 3.14), Node.js 20.19 or newer (tested with Node 24), and npm.

### Backend

In PowerShell from the repository root:

```powershell
cd backend
py -3.14 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
venv\Scripts\alembic.exe upgrade head
venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

Run the Alembic migration before the first server start. Development startup also creates missing tables and seeds demo data when the user table is empty; production startup does neither.

### Frontend

Open a second terminal from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

The app is at [http://localhost:5173](http://localhost:5173). The API is at [http://localhost:8000](http://localhost:8000), with interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs). Vite proxies `/api`, including WebSocket upgrades, to the backend.

Development demo accounts are seeded only outside production:

| Role | Email | Password |
|------|-------|----------|
| Inventory Manager | `manager@stocksense.com` | `Manager@12345` |
| Warehouse Staff | `staff@stocksense.com` | `Staff@12345` |

These are public demo credentials. Never use them for a deployed system.

## Configuration

Copy `backend/.env.example` to `backend/.env` for local settings. The default database is `sqlite+aiosqlite:///./stocksense.db`, relative to the backend working directory.

Production requires all of the following before startup:

- `APP_ENV=production`
- A unique `SECRET_KEY` of at least 32 characters
- `DATABASE_URL=postgresql+asyncpg://...`
- `COOKIE_SECURE=true`
- `CORS_ORIGINS` containing only the HTTPS application origins
- `SMTP_HOST`, `SMTP_FROM_EMAIL`, and `SMTP_STARTTLS=true`; SMTP username/password must be supplied together when authentication is required

The application rejects unsafe production defaults. Apply Alembic migrations before deployment; production startup intentionally does not create tables or seed demo accounts. Do not commit `.env` files or real credentials.

## API Overview

All REST routes are under `/api/v1`:

| Resource | Routes / capabilities |
|----------|-----------------------|
| Authentication | Signup, login, logout, current user, request OTP, reset password |
| Products | List/search/filter, create/update, categories, reorder check |
| Warehouses | List/create warehouses and locations |
| Operations | Receipts, deliveries, transfers, adjustments, status advancement, validation |
| Ledger | Paginated movement history, current quants, manager rebuild endpoint |
| Dashboard | KPI summary with warehouse/category filters |
| WebSocket | `/api/v1/ws/alerts` committed movement events |

OpenAPI is available at `/docs` when the backend is running.

## Tests and Build

Run backend tests from the repository root:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -q
```

The default test database is isolated in-memory SQLite. To run against PostgreSQL, set `TEST_DATABASE_URL` to a **separate disposable test database**; the fixtures create and drop tables. Do not point it at a production database.

Build and lint the frontend from `frontend/`:

```powershell
npm run build
npm run lint
```

Last verified locally: 12 backend tests passed; the TypeScript/production frontend build passed; an authenticated manager receipt reached a separate staff browser over WebSocket. PostgreSQL migration SQL was compiled offline, but a live PostgreSQL server was not available for an online migration or test run.

## Current Limitations

This is a working prototype, not a production-ready inventory service. Before exposing it to the internet:

1. Configure a real SMTP provider and verify mail delivery. Development-only `otp_debug` is not returned outside development.
2. Run Alembic migrations and the full suite against a real PostgreSQL test database; SQLite does not verify PostgreSQL row-lock behavior.
3. Add frontend interaction tests, broader API authorization tests, dependency scanning, and load testing before a real deployment.

The local browser check created a one-unit demo receipt (`WH1/IN/0005`) in the ignored SQLite database; it is not part of a fresh clone or GitHub history.

## Real Data and Free APIs

There is no public API that can provide a business's real on-hand inventory. Quantities, reservations, and movements must come from that business's own stock system or be entered/scanned into StockSense.

For **food product metadata** (name, brand, barcode, ingredients, and similar catalog fields), [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) provides a free/open API. It does not provide authoritative stock quantities or dependable prices. Its documentation currently specifies limits of 15 product reads per minute per IP and 10 search requests per minute per IP; it also requests a descriptive User-Agent and explains ODbL/database-content licensing. Check its current terms and data quality before using it.

For actual store inventory, connect to the user's own ERP/POS/e-commerce system (for example, a Shopify or WooCommerce store) using that provider's authenticated API. Such APIs expose that account's data; they are not a free source of arbitrary real inventory. FakeStoreAPI and DummyJSON are useful for UI prototyping only and return sample data.
