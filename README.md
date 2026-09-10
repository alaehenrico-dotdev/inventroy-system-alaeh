# Ala Eh! Inventory & Monitoring System

A working implementation of the *Inventory & Monitoring System — Documentation Plan v3.0*
for Ala Eh Product Ventures Corporation. ReactJS frontend, Express + TypeScript REST API,
MySQL database.

```
inventory-system/
├── database/
│   ├── schema.sql          <- import this first (fresh installs)
│   └── migrations/         <- run in order against an already-provisioned DB
├── backend/                 <- Express + TypeScript API, run with npm
│   ├── .env.example         <- copy to .env and edit (gitignored, has DB + seed-admin creds)
│   ├── src/
│   │   ├── server.ts         <- express app setup (CORS, JSON body parsing), listens on PORT
│   │   ├── config/env.ts     <- loads DB credentials + PORT from .env
│   │   ├── routes/           <- the full route table
│   │   ├── support/          <- db pool, http response helpers, audit log
│   │   ├── domain/           <- shared business logic (e.g. channel inventory)
│   │   └── controllers/      <- one module per resource, grouped by domain
│   │       ├── ospr/         <- the 4 OSPR endpoints (batches/items/close/boxes)
│   │       └── logistics/    <- the 3 Delivery Receipt manifest endpoints
│   └── scripts/seedAdmin.ts  <- CLI: `npm run seed:admin`
└── frontend/                <- React (Vite) app, run with npm
    └── src/
        ├── app/              <- routes + page shell
        ├── shared/           <- axios client, auth context
        └── features/         <- one folder per screen/section
```

## 1. Database

1. Start MySQL (e.g. via XAMPP's control panel, or any local MySQL install).
2. Import the schema, e.g. via phpMyAdmin's **Import**, or from a terminal:
   `mysql -u root -e "CREATE DATABASE IF NOT EXISTS inventory_system"` then
   `mysql -u root inventory_system < database/schema.sql`.
   This creates the `inventory_system` database, all tables in Section 5
   of the plan, and seeds the ~29-item product catalog from Section 10.

**Upgrading an existing install instead?** Don't re-run `schema.sql` — it
would try to recreate tables that already exist. Apply each file in
`database/migrations/` once, in order, e.g.:
`mysql -u root inventory_system < database/migrations/002_offline_logistics_improvements.sql`.

## 2. Backend (Express + TypeScript API)

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. In a terminal:
   ```
   cd backend
   npm install
   cp .env.example .env
   ```
3. Edit `backend/.env` if needed — this is where DB credentials, the port,
   and the seed-admin login live, and it's gitignored so real values never
   get committed. The defaults (`root` / empty password, port `4000`,
   `admin` / `admin123`) match a stock local MySQL/XAMPP install, so this
   step is optional if you're fine with those.
4. Create the admin login: `npm run seed:admin` — creates/resets the admin
   user from `.env` (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, default
   `admin` / `admin123`).
5. Start the API: `npm run dev` (auto-restarts on file changes) or
   `npm run build && npm start` for a production build.
6. Confirm the API is up: `http://localhost:4000/api/units` should return
   a JSON list of the 5 units.

Every endpoint from Section 6 of the plan is implemented as a controller
under `backend/src/controllers/`, routed (see `backend/src/routes/index.ts`)
as: `POST /api/login`, `GET|POST /api/products`, `GET /api/products/lookup`
(barcode → product, used by the scan-to-select flow), `GET|POST /api/packers`,
`GET /api/units`, `GET|PUT /api/channel-inventory`, `GET /api/stock-alerts`,
`GET|POST /api/withdrawals`, `GET|POST /api/ospr/batches`,
`GET|POST|DELETE /api/ospr/items`, `POST /api/ospr/close`,
`GET|POST /api/ospr/boxes-used`, `GET|POST|PUT /api/transfers`,
`GET|POST /api/rts-triage`, `GET|POST /api/logistics`,
`GET|POST /api/logistics/receipts` (open/list a Delivery Receipt manifest),
`GET|POST|DELETE /api/logistics/receipts/items` (scan a line onto one),
`POST /api/logistics/receipts/close`, `GET|POST /api/fulfillment-daily`,
`GET /api/log-books` and `GET /api/audit-trail`.

A `POST` to `/api/logistics` or `/api/logistics/receipts` with a `reference`
that's already been used returns `409 {"error":"duplicate_reference", ...}`
instead of logging it twice — resubmit the same body with
`"confirm_duplicate": true` once you've confirmed it's not a mistake.

## 3. Frontend (React)

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. In a terminal:
   ```
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```
3. Open the URL Vite prints (usually `http://localhost:5173`).
4. Sign in with `admin / admin123`.

If your backend API lives somewhere other than `http://localhost:4000`,
edit `VITE_API_BASE_URL` in `.env`.

To build a static production bundle: `npm run build` (output in
`frontend/dist/`) — serve that folder from any static host or reverse
proxy in front of the backend.

## 4. What's implemented

- **Withdrawals** — 1st-hour Production → Packing pulls, replacing the
  raw tally page (Section 7.3/7.9).
- **OSPR batches** — open a sheet, scan/add order rows (Code Name, Unit,
  Variant, Customer's Name), close the batch to auto-compute the
  Accomplishment Report and boxes-used-per-packer (Section 8.1–8.2).
- **Inter-channel transfers** — scan-before-move, atomic balance update,
  immutable ledger, admin approval above a configurable quantity
  (Section 4).
- **RTS triage** — single tally by default, with an optional
  Good/Leak/Bad Order breakdown (Section 5.3).
- **Offline logistics log** — Delivery Receipt / Backload / Upsell /
  Bad Order, updating OFFLINE balances directly. Any entry's reference
  (waybill/DR no.) is checked for accidental duplicates before it's logged.
- **Delivery Receipt manifests** — open one per waybill, scan multiple SKUs
  onto it (camera barcode scan or manual product/unit selection), then close
  it, instead of one flat row per SKU.
- **Barcode scan-to-select** — on the Logistics Log and Delivery Receipt
  pages, "Scan barcode" uses the device camera to resolve a product's
  barcode instead of scrolling a dropdown. Requires a product to have a
  barcode set in the Product Catalog first, and camera permission in the
  browser.
- **Works with a flaky connection** — the Logistics Log and Delivery Receipt
  pages queue their writes locally (IndexedDB) when a request can't reach
  the server at all, and replay them automatically once the app is back
  online or reopened. A banner shows how many changes are queued, and flags
  any that failed to sync on replay (e.g. a receipt someone else already
  closed) so nothing silently vanishes.
- **Daily fulfillment summary** — Fulfillment (OUT) vs RTS per
  product/unit, computed live or saved as a snapshot (Section 8.3).
- **Dual log book** — By SKU and By Packer views (Section 8.4).
- **Stock alerts** and **audit trail** for reconciliation.
- **Product catalog** — the ~29-item catalog from Section 10, with the
  ability to add new products, flag which units they carry, and assign each
  a barcode for the scan-to-select flow.

## 5. Notes & things to confirm before go-live

- Retail items 24 and 27–29 (Iodized Salt, Ground Pepper, Onion Powder,
  Chili Powder) were entered under the GAL column on the paper form but
  are classified as **KG** here per the appendix footnote — confirm
  this with operations.
- "Palm Oil" and "NSC" appear as unlabeled entries on the field sheet
  with no recorded quantity and are **not** in the seeded catalog —
  add them once their units/meaning are confirmed.
- Login is intentionally simple (username/password, no session
  timeout) to match the scope of this build — harden it before
  exposing the system beyond the local network.
- Change `ADMIN_PASSWORD` in `backend/.env` before running `npm run seed:admin`
  for anything beyond local testing — the default is the same for every
  install of this repo.

## 6. Known limitations

- The offline queue only covers the Logistics Log and Delivery Receipt write
  requests (open/add-line/remove-line/close/quick-log) — not Withdrawals,
  OSPR, RTS or Transfers. It replays queued changes when the browser fires
  its `online` event or when the app is next opened, **not** from a fully
  closed tab in the background — reopen the app after a delivery to sync.
- Barcode **scanning** (the camera lookup) needs a live connection to
  resolve the barcode to a product; it does not work offline. Manual
  product/unit selection still works offline, since the product list itself
  is cached for use without a connection.
- The product catalog's `barcode` field must be unique when set (enforced by
  the database) — scan or type each product's real barcode once in the
  Product Catalog page before relying on scan-to-select for it.
- The sidebar/login mark (`shared/brand/LogoMark.jsx`, and
  `frontend/public/icon.svg` used for the favicon/PWA icon) is a hand-drawn
  approximation of the real Ala Eh! Food Products seal, built from the
  colors and shapes visible in it — not the actual logo file. Swap both for
  the real artwork once it's available as an image file.
