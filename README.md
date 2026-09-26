# StockSense

StockSense is a web-based inventory management application for small warehouse and stockroom teams. It helps a team maintain a product catalog, organize stock across warehouses and locations, record inventory changes, review movement history, and see which products need replenishment.

The project is a locally runnable development prototype. It includes a working React interface and FastAPI service, demo accounts and sample inventory, role-aware workspaces, a ledger-backed stock movement flow, live updates, OTP account verification and password reset, and an optional Groq-powered dashboard assistant.

> **Data boundary:** StockSense tracks only information stored in its own database or entered through its UI/API. It is not automatically connected to suppliers, a point-of-sale system, an ERP, an ecommerce store, or a public inventory source. Demo records are sample data, not real stock.

## Contents

- [Features](#features)
- [Roles, accounts, and workspaces](#roles-accounts-and-workspaces)
- [How inventory works](#how-inventory-works)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Tests and frontend checks](#tests-and-frontend-checks)
- [Known limitations](#known-limitations)

## Features

### Inventory workspace

- **Dashboard:** workspace-level inventory summary, key counts and values, stock warnings, and recent activity. Dashboard figures are calculated from that workspace's records.
- **Products:** maintain product names, SKUs, categories, units of measure, and minimum/maximum stock thresholds. Search and filter the catalog and inspect stock quantities by location.
- **Warehouses and locations:** managers can add warehouses and locations. Locations distinguish physical/internal stock areas from virtual vendor, customer, and loss locations used by movements.
- **Stock operations:** record receipts from vendors, deliveries to customers, internal transfers, and stock adjustments. Operations use a draft/validation workflow where applicable; validation applies the movement to the ledger.
- **Reorder checks:** compare available stock with product thresholds and surface products that need attention. Reorder suggestions are drafts for review; StockSense does not place supplier orders.
- **Movement history:** review paginated ledger entries and stock balances. The ledger records validated movements so balances can be reconstructed from inventory activity.
- **Live updates:** committed stock movements are broadcast over an authenticated WebSocket to connected members of the same workspace. Open dashboards refresh their inventory data after relevant events.

### Authentication and account recovery

- Email and password sign-in with Argon2 password hashing and JWT sessions. The API sets an HttpOnly cookie; the browser client also keeps a bearer token for API requests.
- New accounts are created as inactive until the user verifies a six-digit email OTP. Successful verification activates the account, signs the user in, and opens the dashboard.
- **Forgot password** sends a six-digit OTP to the account email. A valid, unexpired code allows the user to choose a new password.
- OTPs expire after the configured number of minutes and requests are rate-limited per email.
- Local development without SMTP returns a development-only code to the UI. Production never returns the code in an API response and requires SMTP configuration.

### Workspace assistant (optional)

The dashboard has an optional assistant backed by Groq. It can answer questions using the signed-in workspace's current inventory snapshot and StockSense feature guidance. Its context is assembled on the server for the authenticated user's workspace; the Groq API key is kept server-side. The assistant is unavailable until `GROQ_API_KEY` is configured.

Assistant responses are generated text, not authoritative inventory mutations. Make stock decisions from the application records and validate all proposed actions in the inventory UI.

## Roles, accounts, and workspaces

StockSense separates each account's workspace data. A standalone signup creates a private manager workspace with no preloaded inventory. A user can instead enter a current manager invite code during signup to join that manager's workspace as warehouse staff. Members of the same workspace see the same inventory and receive its live updates.

| Account type | How it is created | Access and data |
|---|---|---|
| Demo Inventory Manager | Seeded in non-production development startup | Manager access to the demo manager workspace and its sample data |
| Demo Warehouse Staff | Seeded in non-production development startup | Staff access to a separate demo staff workspace and its sample data |
| New account without an invite | Signup followed by email OTP verification | A private, empty manager workspace |
| New account with a valid manager invite | Signup followed by email OTP verification | Staff membership in the inviting manager's workspace |

Managers can generate a workspace invite from the dashboard assistant area and share the current code with staff. Generating a new code replaces the previous one. An invite code is distinct from the six-digit email OTP: the invite chooses which workspace to join; the OTP verifies the new account's email.

### Development demo sign-ins

| Role | Email | Password |
|---|---|---|
| Inventory Manager | `manager@stocksense.com` | `Manager@12345` |
| Warehouse Staff | `staff@stocksense.com` | `Staff@12345` |

These public sample credentials are for local demonstration only. Do not use them for a deployed service. The manager and staff demos intentionally have different showcase data and are not members of the same workspace. New standalone users do not inherit either demo's inventory.

## How inventory works

1. A manager creates or reviews product categories, products, warehouses, locations, and stock thresholds.
2. A user records a receipt, delivery, transfer, or adjustment. Draft operations can be reviewed before they are validated.
3. Validation sends the movement through the ledger engine, which checks the operation and updates stock balances transactionally.
4. The dashboard, product stock view, reorder checks, and movement history read the resulting workspace data.
5. The service broadcasts a committed movement to other connected clients in that workspace, which refresh their views.

The ledger and quantities are application records. StockSense does not independently confirm physical counts; users remain responsible for entering accurate movements and adjustments.

## Technology

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | FastAPI, Pydantic, SQLAlchemy async |
| Local database | SQLite with `aiosqlite` |
| PostgreSQL driver | `asyncpg` |
| Schema changes | Alembic migrations |
| Authentication | JWT, Argon2, HttpOnly cookie, OTP flows |
| Live events | FastAPI WebSocket |
| Optional AI assistant | Groq OpenAI-compatible chat completions API |

## Repository layout

```text
backend/
  main.py                 FastAPI application, development seed data, health route
  app/api/v1/             Authentication, inventory, dashboard, assistant, WebSocket APIs
  app/core/                Settings, database/session setup, email, security helpers
  app/ledger/              Stock movement and balance logic
  app/models/              SQLAlchemy database models
  app/schemas/             Pydantic request and response models
  alembic/                 Database migrations
  tests/                   Backend tests
frontend/
  src/pages/               Sign-in, dashboard, products, operations, history, warehouses
  src/components/          Shared navigation, dashboard and assistant UI
  src/context/             Authentication state
  src/lib/                 API client and query hooks
  src/                     Vite and TypeScript application source
render.yaml                Optional Render Blueprint configuration
```

## Run locally

### Prerequisites

- Python 3.11 or newer
- Node.js 20.19 or newer and npm
- PowerShell on Windows (commands below use PowerShell)

### Start the backend

From the repository root:

```powershell
cd backend
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn main:app --reload --port 8000
```

If PowerShell blocks activation, run the environment's executable directly instead, for example `venv\Scripts\python.exe -m pip install -r requirements.txt` and `venv\Scripts\uvicorn.exe main:app --reload --port 8000`.

Apply migrations before using the app. In development, startup also creates missing tables and seeds the manager/staff demo data when the database has no users. Production startup does not create tables or seed demo accounts.

### Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:8000](http://localhost:8000), interactive OpenAPI documentation is at [http://localhost:8000/docs](http://localhost:8000/docs), and the health route is [http://localhost:8000/health](http://localhost:8000/health). Vite proxies `/api` requests and WebSocket connections to the backend.

### First sign-in

- Use one of the demo accounts above to inspect seeded showcase data.
- To make a new private workspace, select **Sign up**, leave **Workspace Invite Code** blank, create the account, then verify the email OTP. The new user is taken to their empty inventory dashboard.
- To join a manager's workspace, enter the manager's current invite code before submitting signup, then verify the email OTP. A bad or expired invite blocks signup before an OTP is generated.
- When SMTP is not configured in development, use the OTP shown in the app. For email delivery, configure SMTP as described below.

## Configuration

Copy `backend/.env.example` to `backend/.env` and edit the local file. The backend also checks a `.env` in the project root. Do not commit either file or put secrets in frontend environment variables.

### Main settings

| Variable | Purpose | Local default / notes |
|---|---|---|
| `APP_ENV` | Environment behavior | `development`; use `production` only with production requirements configured |
| `SECRET_KEY` | Signs JWT sessions | Replace with a unique secret for deployments |
| `DATABASE_URL` | Async SQLAlchemy database connection | `sqlite+aiosqlite:///./stocksense.db`; path is relative to backend working directory |
| `COOKIE_SECURE` | Marks session cookie HTTPS-only | `false` for local HTTP; must be `true` in production |
| `COOKIE_SAMESITE` | Session cookie SameSite policy | `lax` for local development |
| `CORS_ORIGINS` | Allowed browser origins | Local Vite origins are listed in `.env.example` |
| `OTP_EXPIRE_MINUTES` | OTP lifetime | `10` |
| `OTP_MAX_PER_HOUR` | OTP requests allowed per email per hour | `5` |
| `SMTP_HOST`, `SMTP_PORT` | Outgoing mail server | Configure for actual OTP email delivery |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Optional SMTP authentication | Configure both or leave both blank |
| `SMTP_FROM_EMAIL` | Sender address for OTP mail | Required for SMTP delivery |
| `SMTP_STARTTLS` | Use STARTTLS for SMTP | `true` by default |
| `GROQ_API_KEY` | Enables the dashboard assistant | Optional; keep the real key only in backend environment |
| `GROQ_MODEL` | Groq chat completion model | `openai/gpt-oss-20b` |

Without SMTP in development, signup/reset OTP codes are returned only as development data for the UI. With SMTP configured, codes are sent to the user's email. Production configuration requires SMTP and never returns a debug OTP.

### Production configuration requirements

Before setting `APP_ENV=production`, configure all of the following:

- A unique `SECRET_KEY` at least 32 characters long
- `DATABASE_URL` using `postgresql+asyncpg://...`
- `COOKIE_SECURE=true`
- `CORS_ORIGINS` containing only the HTTPS origins of the deployed frontend
- `SMTP_HOST`, `SMTP_FROM_EMAIL`, and `SMTP_STARTTLS=true`
- SMTP username and password together if the mail provider requires authentication
- Alembic migrations applied before the API begins serving traffic

The application rejects unsafe production defaults. Never place secrets in source control, browser code, screenshots, or issue reports. If a credential is exposed, revoke it and replace it.

### Optional Groq assistant

Add the API key to `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
```

Restart the backend after changing environment variables. The key is read server-side; do not add it to frontend code or commit it. If the key is absent, the dashboard assistant stays visible but reports that it is not configured. The assistant only receives the authenticated workspace snapshot and application guidance prepared by the backend; it is not a general access path to other users' data.

### PostgreSQL

The application can use PostgreSQL through `asyncpg`. For a local PostgreSQL database, set `DATABASE_URL` to a URL such as:

```text
postgresql+asyncpg://username:password@localhost:5432/stocksense
```

Then run `alembic upgrade head` from `backend/` before launching the API. URL-encode special characters in credentials as required by SQLAlchemy URLs.

## API overview

All HTTP routes are under `/api/v1`. Use `/docs` or `/openapi.json` while the backend is running for exact schemas and parameters.

| Area | Route prefix / route | Capabilities |
|---|---|---|
| Authentication | `/auth` | Signup, verify signup OTP, login, logout, current user, workspace invite generation, request reset OTP, reset password |
| Products | `/products` | List/filter/search products, create/update products, categories, reorder checks |
| Warehouses | `/warehouses` | List/create warehouses and locations |
| Operations | `/operations` | List and create operations, advance status, validate operations, quick adjustments and transfers |
| Ledger | `/ledger` | Paginated movement history, current stock quants, manager ledger rebuild |
| Dashboard | `/dashboard/kpis` | Workspace dashboard summary and supported filters |
| Assistant | `/assistant/chat` | Ask a question against the authenticated workspace context; requires Groq configuration |
| WebSocket | `/ws/alerts` | Authenticated committed movement events scoped to the user's workspace |

## Tests and frontend checks

Run the backend suite from the repository root:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -q
```

The default test database is isolated in-memory SQLite. To test against PostgreSQL, set `TEST_DATABASE_URL` to a separate disposable database. Test fixtures create and drop tables; never point this variable at a production database.

Build and lint the frontend from `frontend/`:

```powershell
npm run build
npm run lint
```

SQLite is useful for local work but does not verify PostgreSQL row-lock behavior. A PostgreSQL-backed test run is needed to validate those database-specific concurrency guarantees.

## Known limitations

- **Prototype status:** review security, operational controls, and authorization behavior before exposing the service publicly.
- **Demo credentials:** the seeded manager and staff passwords are public and must never be reused in production.
- **Email:** OTP email delivery depends on a correctly configured SMTP service. Verify delivery and sender reputation before relying on account recovery.
- **Live events:** WebSocket connections and broadcasts are held in API process memory. Run a single API instance unless a shared pub/sub service is added for multi-instance delivery.
- **External integrations:** there is no supplier, ERP, POS, ecommerce, barcode, or product-data integration configured by default.
- **Assistant:** Groq availability, model behavior, rate limits, and account usage depend on the configured Groq account. Assistant output can be inaccurate and does not mutate stock.
- **Verification coverage:** SQLite tests do not replace PostgreSQL integration, browser interaction, dependency/security scanning, load, backup/restore, and deployment testing.

## Deployment note

The repository includes a root [`render.yaml`](render.yaml) Blueprint for the API, static frontend, and managed PostgreSQL. Treat that file as a deployment template: review current provider pricing, set production secrets and SMTP values in the hosting dashboard, run migrations, and confirm health, email, cookies, CORS, and WebSocket behavior against the deployed environment before relying on it. Keep the API at one instance until WebSocket event delivery uses shared pub/sub.
