# Ala Eh! Inventory & Monitoring System

A working implementation of the *Inventory & Monitoring System — Documentation Plan v3.0*
for Ala Eh Product Ventures Corporation. ReactJS frontend, PHP REST API, MySQL database —
built to run on a standard XAMPP install.

```
inventory-system/
├── database/
│   └── schema.sql          <- import this first
├── backend/                <- copy this folder into htdocs
│   ├── public/              <- web root: front controller + rewrite rule
│   │   ├── index.php        <- routes every /api/... request to a controller
│   │   └── .htaccess
│   ├── src/
│   │   ├── config.php       <- DB credentials (defaults match stock XAMPP)
│   │   ├── routes.php        <- the full route table
│   │   ├── Support/          <- Database, Http, Audit, Router helpers
│   │   ├── Domain/            <- shared business logic (e.g. channel inventory)
│   │   └── Controllers/       <- one class per resource, grouped by domain
│   │       └── Ospr/          <- the 4 OSPR endpoints (batches/items/close/boxes)
│   └── seed_admin.php        <- run once in browser, then delete
└── frontend/                <- React (Vite) app, run with npm
    └── src/
        ├── app/               <- routes + page shell
        ├── shared/            <- axios client, auth context
        └── features/          <- one folder per screen/section
```

## 1. Database

1. Start Apache + MySQL in the XAMPP control panel.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`).
3. Click **Import**, choose `database/schema.sql`, and run it.
   This creates the `inventory_system` database, all tables in Section 5
   of the plan, and seeds the ~29-item product catalog from Section 10.

## 2. Backend (PHP API)

1. Copy the `backend` folder into your XAMPP `htdocs` directory and
   rename it `inventory-api`, e.g.:
   `C:\xampp\htdocs\inventory-api\` (Windows) or `/Applications/XAMPP/htdocs/inventory-api/` (Mac).
2. If your MySQL root user has a password, edit `backend/src/config.php`
   and set `DB_PASS`. The defaults (`root` / empty password) match a
   stock XAMPP install.
3. In your browser, visit:
   `http://localhost/inventory-api/seed_admin.php`
   This creates the default login `admin / admin123`. **Delete
   `seed_admin.php` afterwards.**
4. Confirm the API is up: `http://localhost/inventory-api/public/api/units`
   should return a JSON list of the 5 units. All API traffic goes through
   `backend/public/` (a front controller + `.htaccess` rewrite - no extra
   Apache config needed on a stock XAMPP install, since `mod_rewrite` and
   `AllowOverride All` are already on by default for `htdocs`).

Every endpoint from Section 6 of the plan is implemented as a controller
under `backend/src/Controllers/`, routed (see `backend/src/routes.php`)
as: `POST /api/login`, `GET|POST /api/products`, `GET|POST /api/packers`,
`GET /api/units`, `GET|PUT /api/channel-inventory`, `GET /api/stock-alerts`,
`GET|POST /api/withdrawals`, `GET|POST /api/ospr/batches`,
`GET|POST|DELETE /api/ospr/items`, `POST /api/ospr/close`,
`GET|POST /api/ospr/boxes-used`, `GET|POST|PUT /api/transfers`,
`GET|POST /api/rts-triage`, `GET|POST /api/logistics`,
`GET|POST /api/fulfillment-daily`, `GET /api/log-books` and
`GET /api/audit-trail`.

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

If your PHP API lives somewhere other than
`http://localhost/inventory-api/public`, edit `VITE_API_BASE_URL` in `.env`.

To build a static production bundle: `npm run build` (output in
`frontend/dist/`) — copy that folder into `htdocs` if you want to serve
the compiled app from Apache instead of the Vite dev server.

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
  Bad Order, updating OFFLINE balances directly.
- **Daily fulfillment summary** — Fulfillment (OUT) vs RTS per
  product/unit, computed live or saved as a snapshot (Section 8.3).
- **Dual log book** — By SKU and By Packer views (Section 8.4).
- **Stock alerts** and **audit trail** for reconciliation.
- **Product catalog** — the ~29-item catalog from Section 10, with the
  ability to add new products and flag which units they carry.

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
- `seed_admin.php` should be deleted from the server after first use.
