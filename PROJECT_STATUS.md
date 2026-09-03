# InWallz Billing Software — Project Status

A multi-tenant restaurant POS (Point of Sale). Each restaurant's data is isolated
by `restaurant_id`, taken from the logged-in user's JWT and never trusted from the
request body.

_Last updated: 2026-09-03_

---

## Tech stack

| Layer     | Tech                                                        |
|-----------|-------------------------------------------------------------|
| Frontend  | React (Create React App), plain CSS (scoped per role)       |
| Backend   | Node.js + Express (callback-style controllers/models)       |
| Database  | MySQL (`mysql2`)                                             |
| Auth      | JWT (`jsonwebtoken`) + `bcrypt` password hashing            |
| Repo      | https://github.com/arun260505/billing-software              |

Standard API response envelope: `{ success, message, data }` via `backend/utils/response.js`.

---

## Run it locally

```bash
# 1) Backend  (http://localhost:5000)
cd "billing-software/backend"
node server.js

# 2) Frontend (http://localhost:3000)   — separate terminal
cd "billing-software"
npm start
```

Backend config lives in `backend/.env` (`DB_HOST`, `DB_USER`, `DB_PASS`,
`DB_NAME=inwallz_billing`, `JWT_SECRET`, …).

> **Node does not hot-reload.** After changing any backend file, stop and restart
> `node server.js`. The frontend (CRA) hot-reloads on save.

---

## Setup on a new machine (a friend / new laptop)

1. `git clone` (or `git pull`) the repo.
2. Create the MySQL database and load the schema/data dump.
3. Apply any pending migrations in `backend/migrations/` that aren't in the dump:
   ```bash
   Get-Content .\backend\migrations\002_order_items_served.sql | mysql -u root -p inwallz_billing
   ```
4. Set `backend/.env` (DB creds + `JWT_SECRET`).
5. `npm install` in both root and `backend/`.
6. Start backend + frontend (see above).

After every `git pull`: **restart the backend** if backend files changed.

---

## Roles & credentials

Usernames are per-restaurant, e.g. `ravikumar_waiter@<restaurant>`.

| Role       | Purpose                                    | Example (restaurant "inwallz") |
|------------|--------------------------------------------|--------------------------------|
| super_admin| Creates restaurants/admins                 | `inwallz` / `Admin@123`        |
| admin      | Manages menu, categories, tables, staff    | (created per restaurant)       |
| waiter     | Takes table orders (mobile-first UI)       | `*_waiter@<restaurant>`        |
| cashier    | Billing + counter orders (desktop POS)     | `*_cashier@<restaurant>`       |
| kitchen    | Kitchen display                            | `kitchen@inwallz` / `Kitchen@123` |

---

## The order → kitchen → bill lifecycle

```
Waiter/Cashier adds items ─▶ Send to Kitchen ─▶ order = "Preparing"
        │                                            │
        │                                     Kitchen board shows it
        │                                            │
        │                             Serve items (waiter / kitchen / cashier)
        │                                            │
   Waiter: 🧾 Bill ────────────────────────▶ table = "Billing" (locked + off kitchen)
        │                                            │
   Cashier: Print & Settle ────────────────▶ table = "Available" (cycle done)
```

- **Table statuses:** `Available` · `Occupied` · `Billing` · (`Reserved`/`Cleaning`).
- **Order statuses:** `Pending` · `Preparing` · `Ready` · `Served` · `Completed` · `Cancelled`.
- **`order_items.served`** (tinyint) tracks per-item serve.

---

## Waiter page (mobile-first)

Locked to a centered ~440px phone-width column (looks like a phone even on desktop).

- **Screen 1 — Tables:** stats + a 2-up grid of table cards. Each occupied/billed
  card shows an **X/Y served** chip. **Billed tables are locked** (🔒) until the
  cashier settles them.
- **Screen 2 — Order (tap a table):** stable menu grid (adding items never shifts
  the layout), veg/non-veg cards with a `− qty +` stepper, whole-menu search.
  - **Review & Send** bottom bar → opens an order sheet to review before sending.
  - **Per-item cooking notes** (e.g. one juice "no ice", another "with ice").
  - **🧾 Bill** (header) → editable bill: adjust/cancel items, **＋ add an item**,
    then **Confirm & Send to Cashier**.
  - "Already sent to kitchen" strip with per-item **Serve**.

## Cashier page (desktop POS — the exe target)

Full-window "docked bill panel" layout:

- **Top bar:** brand, compact stats, 🍽 Menu availability, 🔔 running orders, cashier, logout.
- **Table bar:** T1/T2/T3 chips (Free/Occupied/Billed, with served counts) + **Counter** chip.
- **Center:** menu grid (search, categories, veg-dot cards with steppers).
- **Docked bill panel (right):** current unpaid order (+ Serve / Print & Settle),
  new items with **per-item notes**, live Subtotal/GST/Service/Total, and actions.
- **Counter / walk-in orders (no table):** add items without picking a table →
  **Send & Bill →** creates the order (sends it to the kitchen) **and** opens
  payment in one step. No "Update Order" in counter mode.

## Admin → Settings (printer setup)

The sidebar's old "Charges & Settings" is now just **Charges**; **Settings**
(`/admin/settings`) is its own page. It holds one choice — which printer setup this
restaurant runs — saved per restaurant in `printer_settings.printer_mode` and read
by the cashier and waiter screens (they re-read it every 10s):

| Mode | Setup | Table orders | Counter / walk-in orders |
|------|-------|--------------|--------------------------|
| `cashier_kds`    | Cashier printer + Kitchen Display | bill only, no KOT | bill only, no KOT |
| `dual_printer`   | Cashier printer + kitchen printer | KOT on send, bill at settle | KOT on send, bill at settle |
| `single_printer` | One printer for everything | bill only (kitchen told by hand) | **customer bill, then kitchen bill** |

`dual_printer` is the default, so an existing restaurant keeps behaving as before
until an admin changes it. The rules live in one place —
`src/utils/printerMode.js` (`shouldPrintKotOnSend` / `shouldPrintKotWithBill`) —
so the cashier and waiter screens can't drift apart.

## Cashier → Printer (connecting the devices)

The admin picks the *setup*; the cashier's **🖨 Printer** sidebar page connects the
actual printers that setup calls for — **two boxes** for `dual_printer` (cashier +
kitchen), **one** for the other two modes. `src/utils/printerMode.js`
(`requiredPrinters`) is what decides which boxes appear. Names are saved to
`printer_settings.cashier_printer` / `.kitchen_printer` per restaurant, so a
browser reset or reinstall doesn't lose them.

**Status is real, not decorative.** `GET /api/system/printers` shells out to
`Get-Printer` and returns what Windows actually has installed on the machine
running the backend — in exe mode that *is* the till, so a printer shows
Connected / Offline / Not installed on this PC honestly. When the backend is a
cloud (Linux) node it cannot see the till's printers: the endpoint returns
`detectable: false`, the page says so, and the name falls back to a text box
instead of a dropdown. A **Test print** button per printer prints a short slip
(`src/utils/testPrint.js`) for a physical check either way.

Printing still goes through the browser's print dialog, so the recorded name does
not yet *route* the job — set the printer as the Windows default, or pick it in
the dialog. Routing by name needs the print path to move out of the browser.

## Kitchen page (display)

- **Grouped by table** (T1/T2/T3 fixed at the top) **plus counter orders** (each a
  "Counter" card labelled with its order number).
- Each item has a **Serve** button → strikes it through; **new items appear on top
  with a NEW tag**, **served items sink to the bottom**.
- **Cooking notes** show next to each item.
- A table **resets/drops off** once it's **billed**; counter orders stay until every
  item is served (regardless of paid status).

---

## Notable backend endpoints (recent)

| Method & path                          | Purpose                                  |
|----------------------------------------|------------------------------------------|
| `PUT  /api/orders/item/:itemId/serve`  | Mark one order-item served               |
| `PUT  /api/orders/item/:itemId/qty`    | Set an item's quantity on the bill       |
| `POST /api/orders/table/:tableId/item` | Add an item to a table's bill            |
| `DELETE /api/orders/item/:itemId`      | Cancel one bill item (recomputes totals) |
| `POST /api/orders/table/:tableId/settle`| Settle a table (mark paid, free it)     |
| `GET  /api/kitchen/tables`             | Kitchen board (by table + counter)       |
| `PUT  /api/kitchen/item/:itemId/serve` | Kitchen marks an item served             |
| `GET  /api/printer-settings`           | Read the printer setup (any staff role)  |
| `PUT  /api/printer-settings`           | Change the printer setup (admin only)    |
| `PUT  /api/printer-settings/devices`   | Set the till's printers (cashier/admin)  |
| `GET  /api/system/printers`            | Printers installed on the server PC      |

All are tenant-scoped (`restaurant_id` from the JWT).

---

## Migrations

| File                                   | What it does                              |
|----------------------------------------|-------------------------------------------|
| `001_multitenant_users.sql`            | Adds `restaurant_id`/`mobile`/`email` to users |
| `002_order_items_served.sql`           | Adds `order_items.served TINYINT(1)`      |
| `006_printer_settings.sql`             | Adds `printer_settings` (the printer setup) |
| `007_printer_devices.sql`              | Adds `cashier_printer`/`kitchen_printer` to it |

Apply any not already in the DB dump.

---

## Known follow-ups / ideas

- **Parcel** was removed from the cashier (a new idea is planned for it).
- **Counter cards** on the kitchen are limited to *today's* orders.
- Packaging the cashier page as a **Windows .exe** (planned via Electron).
