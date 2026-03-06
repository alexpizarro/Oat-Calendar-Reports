# HL Analytics — HighLevel Appointment Analytics & Tagging

Multi-tenant web app that connects to GoHighLevel Locations, ingests calendar events + contacts, generates appointment analytics, and pushes cohort tags back to GHL.

**Stack:** Next.js 14 App Router · TypeScript · Tailwind · Azure Static Web Apps · Azure SQL Server · Prisma

---

## Local Development

### Prerequisites
- Node.js 18+
- Azure SQL Server database (or local SQL Server / Azure SQL Edge via Docker)
- GoHighLevel developer account (for OAuth or Private Integration tokens)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.local.example .env.local

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations (creates all tables)
npm run db:migrate

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials you set in `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`.

### Generating a password hash

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('yourpassword', 12).then(h => console.log(h.replace(/\$/g, '\\$')))"
```

Note: Next.js expands `$VAR` inside `.env*` files. bcrypt hashes contain `$`, so they must be escaped as `\$` in `ADMIN_PASSWORD_HASH`.

### Running with SWA CLI (emulates Azure Functions timer locally)

```bash
npm install -g @azure/static-web-apps-cli
swa start
```

---

## Database

This app uses **Azure SQL Server** via Prisma.

### Create Azure SQL Database

```bash
# Create resource group + server + database
az group create --name hlanalytics-rg --location australiaeast
az sql server create --name hlanalytics-sql --resource-group hlanalytics-rg \
  --location australiaeast --admin-user sqladmin --admin-password YourPassword
az sql db create --resource-group hlanalytics-rg --server hlanalytics-sql \
  --name hlanalytics --service-objective S0

# Allow Azure services to connect
az sql server firewall-rule create --resource-group hlanalytics-rg \
  --server hlanalytics-sql --name AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

### Run Migrations (CI/CD)

Migrations run automatically during deployment via `npm run db:deploy` (uses `prisma migrate deploy`).

---

## Deployment — Azure Static Web Apps

### 1. Create the Static Web App

```bash
az staticwebapp create \
  --name hlanalytics-swa \
  --resource-group hlanalytics-rg \
  --location centralus \
  --sku Standard \
  --source https://github.com/your-org/your-repo \
  --branch main \
  --app-location "." \
  --output-location ".next"
```

### 2. Set secrets in GitHub

In your repository → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | From Azure portal → Static Web App → Manage deployment token |
| `DATABASE_URL` | Azure SQL connection string |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `JWT_SECRET` | 64 hex chars |
| `INTERNAL_API_SECRET` | 32 hex chars |
| `ENCRYPTION_KEY` | 64 hex chars |
| `GHL_AUTH_MODE` | `oauth` or `private` |
| `GHL_CLIENT_ID` | GHL OAuth client ID |
| `GHL_CLIENT_SECRET` | GHL OAuth client secret |
| `GHL_REDIRECT_URI` | `https://your-app.azurestaticapps.net/api/oauth/callback` |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.azurestaticapps.net` |

### 3. Push to main

```bash
git push origin main
```

The GitHub Actions workflow will:
1. Install dependencies
2. Generate Prisma client
3. Run DB migrations
4. Build Next.js app
5. Deploy to Azure Static Web Apps

---

## GoHighLevel Setup

### OAuth Mode (recommended)

1. Create a GHL Marketplace App at [marketplace.gohighlevel.com](https://marketplace.gohighlevel.com)
2. Set Redirect URI to `https://your-app.azurestaticapps.net/api/oauth/callback`
3. Set `GHL_AUTH_MODE=oauth` and add `GHL_CLIENT_ID` / `GHL_CLIENT_SECRET`
4. Add a Location in the app → it will redirect through GHL OAuth consent

### Private Integration Token Mode

1. In GHL → Sub-account → Settings → Private Integrations → Create token
2. Set `GHL_AUTH_MODE=private`
3. When adding a Location in the app, paste the Private Integration Token directly

---

## Architecture

```
Browser
  └── Next.js App Router (Azure Static Web Apps)
        ├── /api/* routes (Azure Functions — managed)
        └── Pages (SSR/SSG)

Azure Timer Function (every 5 min)
  └── POST /api/internal/run-jobs
        └── Dequeues and runs: SYNC_BACKFILL | SYNC_INCREMENTAL | TAG_COHORT

GoHighLevel API v2
  ├── Calendars
  ├── Calendar Events (windowed, paginated)
  └── Contacts (search + bulk tag)

Azure SQL Server (Prisma)
  ├── Location, Calendar, Contact
  ├── AppointmentEvent, SyncCheckpoint
  ├── Job, TagJobResult
  └── RateLimitState
```

### Sync Flow

1. **Backfill** — Fetches all historical appointments in 14-day windows. Resumable via `SyncCheckpoint`. Enriches each event with contact metadata.
2. **Incremental** — Fetches events in a rolling window (default 7 days). Runs on a schedule to keep data fresh.

### Rate Limiting

- Token bucket: 100 tokens per 10-second window per location (in-memory)
- 429 responses trigger exponential backoff (1s base, 60s max, ±500ms jitter)
- Bucket state persisted to DB for cold-start recovery

---

## Environment Variables

See [.env.local.example](.env.local.example) for the full list with descriptions.

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create migration + apply (dev) |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:studio` | Open Prisma Studio |
