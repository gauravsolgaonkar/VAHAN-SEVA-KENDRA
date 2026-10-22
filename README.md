# Vahan Seva Kendra

Mobile-first PWA for insurance agents, POSPs and PUC centres in India: customer vehicles, RC auto-fetch from the
registration number, document expiry tracking and WhatsApp renewal reminders. UI in Marathi, Hindi and English.

- `client/` React + Vite PWA (deploy to Vercel)
- `server/` Node + Express API, MongoDB via Mongoose (deploy to Render, database on MongoDB Atlas)

## Phase 1 (this build)

- **Auth & tenants**: sign-up creates a business (tenant) and its owner. JWT auth. Roles: owner, staff/agent
  (own customers only unless "can see all" is on), read-only. Every record carries `tenantId`; every query goes
  through `scope(req)` in `server/src/middleware/auth.js`.
- **Customers**: name, mobile, WhatsApp, alternate no., city, preferred language, tags, notes. Fleet view per customer.
- **Vehicles with RC auto-fetch**: reg no. auto-formatting and state-code validation, mandatory consent checkbox,
  fetch -> pre-filled editable form -> save. Documents (insurance, PUC, fitness, permit, road tax, RC validity) are
  created from the fetched expiry dates so reminders start immediately.
  - Provider adapter layer: `server/src/rc/` (one interface, `mock`, `surepass`, `cashfree`), ordered by
    `RC_PROVIDERS`, with timeout and automatic fallback to the next provider.
  - 30-day cache per tenant + reg no. (`RcRecord`, raw JSON + fetch time). "Refresh from VAHAN" bypasses it.
  - Consent log (`ConsentLog`) on every fetch; call log (`RcCallLog`) for every attempt: user, vehicle, provider,
    cost, cached, success/fail, duration. Per-user rate limit (per minute + per day).
- **Documents**: all vehicle document types plus health/life and driving licence, with insurance details
  (TP/OD/Comprehensive, IDV, NCB, premiums), photo/PDF upload, history when replaced. Auto end date:
  insurance = start + 1 year - 1 day, PUC by fuel/emission norms; always editable.
- **Dashboard**: counts per document type (expired / <=7 / 8-15 / 16-30 days / active), today's call list with one-tap
  call and WhatsApp, RC credits and fetches this month.
- **Reminders**: cron at 8 AM IST builds the queue at 30, 15, 7, 3, 1 days before and 1 day after expiry
  (configurable per document type). Due List opens a `wa.me` link with the message pre-filled in the customer's
  language, mark sent/skip, and a bulk mode that steps through the queue. Template editor with
  `{name} {vehicle} {doc} {expiry} {agent_name} {agent_phone}`.
- Global search, dark mode, offline viewing of last-loaded data (service worker).

Not in Phase 1: credit wallet/Razorpay, bulk fetch, renewal check, pipeline, commission, reports, import/export
(Phase 2); WhatsApp Cloud API, OCR, subscriptions, super-admin (Phase 3).

## Run locally

```bash
# API
cd server
cp .env.example .env        # set MONGODB_URI (local mongod or Atlas)
npm install
npm run seed                # demo data: owner 9999999999 / demo123, staff 9888888888 / demo123 (or set SEED_DEMO=1 to seed once on boot)
npm run dev                 # http://localhost:4000

# App
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Tests: `cd server && npm test` (unit tests plus an API test that needs a MongoDB at `TEST_MONGODB_URI`,
default `mongodb://127.0.0.1:27017/vsk_test`; the database is dropped afterwards).

## Mock RC provider

Until a real key is added, `RC_PROVIDERS=mock` returns Surepass-shaped `rc-full` JSON. Hand-made samples:
`MH08AB1234` (car), `MH09CD5678` (tipper with permit/fitness/tax), `MH12EF9012` (scooter), `MH10GH3456`
(Bolero pickup), `MH14JK7890` (blacklisted truck). Any other valid number gets generated data.
Test numbers: `MH01ZZ0001` not found, `MH01ZZ0002` timeout, `MH01ZZ0003` provider error.

To switch to Surepass: set `SUREPASS_TOKEN` and `RC_PROVIDERS=surepass` (or `surepass,cashfree` for fallback).

## Deploy

- **API on Render**: `render.yaml` blueprint. Set `MONGODB_URI` (Atlas), `CORS_ORIGINS` (the Vercel URL).
  Uploaded files are stored on local disk for now; Render's disk is ephemeral, so move uploads to S3/Cloudinary
  before real use.
- **App on Vercel**: root directory `client`, set `VITE_API_URL` to the Render URL.
