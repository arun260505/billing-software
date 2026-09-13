# InWallz Billing Software — Project Status

A multi-tenant POS (Point of Sale) for **restaurants and salons**. Each business's
data is isolated by `restaurant_id`, taken from the logged-in user's JWT and never
trusted from the request body. (The column keeps the name `restaurant_id` for
both kinds of business.)

_Last updated: 2026-09-13_

> **Salons:** a business is either a restaurant or a salon, chosen by the super
> admin and locked afterwards. Salons get their own owner panel, a receptionist
> billing screen, customer management and inventory.
> Full details: **[SALON_MODULE.md](SALON_MODULE.md)**.

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

**Salons** have two roles that log in: **Owner** (stored as `admin`) and
**Receptionist** (stored as `cashier`, username `*_receptionist@<salon>`). They
also have **Stylists** (`role = 'stylist'`): added by name only, never able to
sign in, and required on every salon bill. The backend refuses any other role for
a salon.

| Local dev demo salon "Glow Salon" | Username | Password |
|---|---|---|
| Owner        | `glowowner` | `Glow@2026` |
| Receptionist | `priya_receptionist@glowsalon` | `Desk@2026` |

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

They are also never overwritten by the cloud. `printer_settings` syncs cloud →
till (for the mode and the waiter toggle), and until 2026-09-13 a pull replaced
the whole row, so changing the printer setup online, or re-activating a till,
wiped the till's saved printers. The two printer columns are now `keepLocal` in
`sync/syncTables.js` and the sync engine leaves them alone when applying a pull.
(Deleting `C:\InWallz\data` for a clean reinstall still means choosing the
printer again once.)

**Status is real, not decorative.** `GET /api/system/printers` shells out to
`Get-Printer` and returns what Windows actually has installed on the machine
running the backend — in exe mode that *is* the till, so a printer shows
Connected / Offline / Not installed on this PC honestly. When the backend is a
cloud (Linux) node it cannot see the till's printers: the endpoint returns
`detectable: false`, the page says so, and the name falls back to a text box
instead of a dropdown. A **Test print** button per printer prints a short slip
(`src/utils/testPrint.js`) for a physical check either way.

## Direct (dialog-free) printing

`window.print()` can never print silently, so a receipt is sent to the **local
backend** instead, which spools it to the configured printer — no dialog:

```
till screen ──POST /api/print { text, target }──▶ backend
                                                    │ resolves the printer name
                                                    ▼
                        scripts/print-text.ps1 ──▶ Out-Printer ──▶ paper
```

| Receipt | `dual_printer` | `cashier_kds` / `single_printer` |
|---------|----------------|----------------------------------|
| Customer bill  | cashier printer | cashier printer |
| Kitchen ticket | **kitchen printer** | cashier printer |

- `src/utils/receiptText.js` renders the bill/KOT as monospace text (32 cols on
  58mm, 48 on 80mm) from the *same* format flags the HTML renderers use.
- `src/utils/printDispatch.js` is the only thing the till screens call
  (`printBillNow` / `printKotNow` / `printTestNow`). It tries the printer, and
  **falls back to the browser dialog** if direct printing is unavailable — a
  cloud backend, no printer chosen, or a printer that is switched off. A print
  failure can never break the sale that produced it.
- Printed money reads `Rs.` not `₹`: Windows spools through a GDI font that
  often lacks the rupee glyph, and a missing glyph prints as a box on every
  line. One constant at the top of `receiptText.js` flips it.
- Direct printing only works when the backend runs **on the till** (exe/local
  node). A cloud (Linux) node answers `501` and the dialog fallback takes over —
  which also means **the waiter APK must be the LAN/auto-discovery build**, not
  a cloud-baked one, for its kitchen tickets to reach the printer.

The admin Billing/KitchenTemplate previews deliberately still use the browser
dialog — they are previews, not till prints.

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
| `GET  /api/customers/search?q=`        | Customer suggestions while billing (3+ digits / 2+ letters) |
| `POST /api/customers/resolve`          | Find a customer by mobile, or create them |
| `GET  /api/customers/:id/history`      | A customer's bills                       |
| `GET  /api/inventory` (+ `/summary`, `/movements`) | Stock items and the movement log (admin) |
| `POST /api/inventory/:id/stock`        | Stock In / Out / Adjust (admin)          |
| `GET  /api/employees/stylists`         | Salon stylists for the billing dropdown (admin, cashier) |
| `GET  /api/dashboard/stylists`         | Live per-stylist board for today (admin) |
| `PUT  /api/settings/discounts`         | Owner's front-desk discount rule: on/off, max %, max ₹ (admin) |

All are tenant-scoped (`restaurant_id` from the JWT). Table, kitchen, KOT and
running-order endpoints additionally refuse a **salon** login
(`middleware/businessTypeMiddleware.js`). See [SALON_MODULE.md](SALON_MODULE.md)
for the full salon API.

---

## Migrations

| File                                   | What it does                              |
|----------------------------------------|-------------------------------------------|
| `001_multitenant_users.sql`            | Adds `restaurant_id`/`mobile`/`email` to users |
| `002_order_items_served.sql`           | Adds `order_items.served TINYINT(1)`      |
| `006_printer_settings.sql`             | Adds `printer_settings` (the printer setup) |
| `007_printer_devices.sql`              | Adds `cashier_printer`/`kitchen_printer` to it |
| `008_order_charges.sql`                | Adds `order_charges` + `orders.charges_total` |
| `013_business_type_inventory.sql`      | Adds `restaurants.business_type` + `inventory_items` / `inventory_movements` |
| `014_order_stylist.sql`                | Adds `orders.stylist_id` (the stylist on a salon bill) |
| `016_salon_discounts.sql`              | Adds the discount rule to `settings` + `orders.discount_percent` |

Apply any not already in the DB dump. Two files share the `003_` prefix
(`003_charges.sql`, `003_order_service_charge.sql`) — they touch different
tables, so the order between them doesn't matter.

**These files are documentation, not the mechanism.** Nothing runs them
automatically. `backend/server.js` re-creates every table and adds every missing
column on boot (idempotent, self-skipping), which is how an installed till
upgrades itself: start the new build and the schema catches up. The `.sql` files
exist so the change is readable in one place and can be applied by hand.

---

## How a bill is totalled

One calculation, two mirrored implementations that must not drift:

| Side | File |
|------|------|
| Backend (authoritative — recomputes everything it stores) | `backend/utils/billing.js` |
| Till screens (has to predict the backend exactly)         | `src/utils/rates.js` |

- **GST and the service charge are charge rows, not settings.** Everything billed
  on top of the goods is a row in `charges` (Admin → Charges), read via
  `backend/utils/billingCharges.js` (30s cache, dropped when a charge is saved):

  | `charge_role` | Where it lands | Example |
  |---------------|----------------|---------|
  | `Tax`     | summed into `orders.tax` (keeps GST reportable) | GST 5%, CGST + SGST |
  | `Service` | summed into `orders.service_charge`             | Service Charge 2%   |
  | `Charge`  | itemised in `order_charges`, summed into `charges_total` | Packing, AC |

  `auto_apply = 1` puts it on every bill of a matching order type; `0` leaves it
  as a chip the cashier taps at settle time. Tax and service rows are always
  automatic — one the cashier could forget to tap is not a tax.

  **No charge rows means no tax and no service charge.** This used to be
  `settings.tax_percentage` / `settings.service_charge` with a hardcoded fallback
  of 5% GST + 2% service that no screen could switch off, which is wrong for
  every restaurant not registered for GST. Migration 010 seeds each existing
  restaurant's effective rates as charge rows so no till changed what it bills —
  the difference is those rows can now be edited or deleted.
- **Prices come from `menu_items`, never the request.** `orderModel.priceCartItems`
  re-prices every cart server-side; an item that isn't on that restaurant's menu
  is a 400.
- **A discount comes off the goods before tax.** `orders.discount` (rupees) is
  taken off the subtotal first; GST, service charge and percentage charges are
  worked out on what is left. A percentage discount also stores
  `orders.discount_percent`, so a corrected bill re-takes the same % off its new
  subtotal. Front-desk discounts are limited by the owner's rule
  (Settings → Discounts, `backend/utils/discountRules.js`); today only the salon
  billing screen offers one.
- **Tax and service are each rounded to paise before being summed**, because
  those are the lines printed on the receipt — the total is the sum of what the
  customer can read.
- **Per-bill charges** (packing, delivery) are stored: itemised in
  `order_charges`, rolled up in `orders.charges_total`, and included in
  `grand_total`. So `payments` reconcile against `grand_total`, and reports that
  sum it are correct.

A table with several orders is taxed per order, while the screen taxes the
combined subtotal once — they can land a paisa apart, so the settle tolerates ₹1
of drift and the stored total wins. Beyond that it refuses.

**Settle happens before print.** The backend can refuse a settle (unserved
items, a total that no longer matches); printing first would hand the customer a
receipt for a sale that was never recorded.

---

## Tests

```bash
cd billing-software/backend && npm test     # node:test, no extra dependency
```

Covers `utils/billing.js` (the rate fallbacks, charge resolution, and the
invariant that `grand_total` is always its own parts summed) and
`sync/syncEngine.js` (unknown columns dropped, rows pinned to the authorised
restaurant, orphans deferred).

---

## One-off scripts

| Script | Purpose |
|--------|---------|
| `backend/scripts/backfill-order-charges.js` | Moves pre-`008` per-bill charges out of their legacy "surplus" payment row and onto the order. **Dry-run by default**; `--apply` writes, `--restaurant N` scopes it. Idempotent — an order that already has `charges_total` is skipped. Take a `mysqldump` first. |

---

## Known follow-ups / ideas

- **Salon module:** still needs a hands-on click-through and a run on the exe
  till before release. Deploy the **cloud before the exe**: a new till's order
  push carries `stylist_id`, which an old cloud rejects (see SALON_MODULE.md §6.8, §8).
- **Salon discounts** (2026-09-13): owner-controlled %/₹ discounts at the front
  desk, pushed to git, **not deployed yet**. Deploy the cloud before the exe as
  usual (SALON_MODULE.md §5, §6.6b).
- **Payment numbers collide across businesses (pre-existing bug).**
  `PAY-<date>-NNNN` restarts at 0001 for each business every day
  (`utils/paymentNumber.js`, `orderModel` settle), but `payments.payment_number`
  has a UNIQUE key across all businesses. On a database with more than one
  business, whichever business takes its first payment of the day second gets
  a 500 (`Duplicate entry 'PAY-…-0001'`). Found while testing discounts; needs the
  same per-restaurant treatment as order numbers (`015_…`).
- **Reports page** (both types) was fixed on 2026-09-13: single-tab cards were
  collapsing, Overview had gaps, and every admin page overflowed on phones
  (SALON_MODULE.md §7).

- **Parcel** was removed from the cashier (a new idea is planned for it).
- **Counter cards** on the kitchen are limited to *today's* orders.
- Packaging the cashier page as a **Windows .exe** (planned via Electron).
- The per-restaurant rates have only been exercised on the fallback path — no
  restaurant in the dev database has a `settings` row, so a configured rate
  (e.g. 18%) is still untested end to end against a real bill.
- `backend/server.js` is ~600 lines, most of it boot-time DDL. Worth moving into
  a real migration runner at some point; the duplicate `003_` prefix is a symptom.
