# Salon Module — Restaurant / Salon Business Types

InWallz started as a restaurant POS. It now runs **salons** too. The super admin
picks the business type when creating a business, and each type gets its own
owner panel and its own billing screen. Both run on the same codebase, database,
cloud and exe till.

_Added: 2026-09-13 · Updated: 2026-09-13 (stylists, Reports fixes)_

---

## 1. At a glance

| | Restaurant | Salon |
|---|---|---|
| Chosen by | Super admin, at creation | Super admin, at creation |
| Can it be changed later? | **No** (locked) | **No** (locked) |
| People with a login | admin, cashier, waiter, kitchen | **Owner** (admin), **Receptionist** (cashier) |
| Staff without a login | — | **Stylists** (name only) |
| Billing screen | `/cashier`: tables, KOT, counter | `/salon/pos`: services + customer + stylist |
| Catalogue | Menu | **Services** (same `menu_items` table) |
| Tables / KOT / Kitchen display | Yes | No |
| Customer on every bill | Optional | **Required** (mobile + name, suggested while typing) |
| Stylist on every bill | — | **Required** (one per bill) |
| Customer management | Yes (`/admin/customers`) | Yes |
| Inventory | — | Yes (`/admin/inventory`) |
| Live stylist board | — | Yes (salon dashboard) |
| Waiter APK | Yes | No |

---

## 2. Try it locally (demo salon)

A demo salon is seeded in the **local dev database only** (not the cloud).

```bash
cd billing-software/backend && node server.js     # http://localhost:5000
cd billing-software && npm start                  # http://localhost:3000
```

| Login | Username | Password | Lands on |
|---|---|---|---|
| Salon owner | `glowowner` | `Glow@2026` | Salon owner panel |
| Receptionist | `priya_receptionist@glowsalon` | `Desk@2026` | Salon billing screen |

The demo **Glow Salon** includes:
- **Services:** Hair, Skin and Nails categories.
- **Charge:** GST 18%.
- **Customers:** Anita (`9876500001`), Rahul (`9876500002`), Meera (`9876500003`).
- **Stylists (no login):** Ravi Kumar, Meena Das, Arjun Rao.
- **Stock:** one item healthy, one low, one out of stock.
- **Bills:** a few paid bills credited to Ravi and Meena.

To make a real salon, log in as super admin, choose **Salon** in *Create Admin*,
and fill in the rest as usual.

---

## 3. Super admin

- **Create Admin** has a **Business type** dropdown (Restaurant / Salon). The
  name placeholder follows the choice.
- **Registered Admins** shows each business name with a Restaurant / Salon tag.
- **The type is locked.** It is shown in the edit row, never offered as an input.
  `PUT /api/super-admin/admin/:id` doesn't read it. No other query writes
  `business_type` after the insert.

---

## 4. Salon owner panel

The sidebar replaces the restaurant menu:

| Page | Route | What it does |
|---|---|---|
| Dashboard | `/admin/dashboard` | Today's sales, bills, customers and low stock, plus the **live Stylists Today board**, sales chart, payments, top services, low-stock list and recent bills |
| Services | `/admin/services` | Add/edit/delete services (name, category, price, description, available) and toggle availability |
| Categories | `/admin/categories` | Service groups (Hair, Skin, Nails…) |
| Customers | `/admin/customers` | Search and sort. Shows visits, total spent, last visit and full bill history (with the stylist on each bill). Add/edit/delete. |
| Inventory | `/admin/inventory` | Stock items, Update Stock (In / Out / Adjust), per-item history and a movement log |
| Employees | `/admin/employees` | Add a **Receptionist** (gets a username + password) or a **Stylist** (name only, no credentials). A salon employee's role can't be changed after adding. |
| Bills | `/admin/orders` | All bills with Customer and Stylist columns, and Unpaid / Completed / Cancelled tabs |
| Charges | `/admin/charges` | GST and other charges. No Dine-in/Takeaway/Delivery choice; salon charges apply to every bill. |
| Bill Format | `/admin/billing` | Receipt layout. FSSAI, dine-in line and waiter name are hidden and forced off. |
| Reports | `/admin/reports` | Salon wording (Bills, Services), **Stylist Report**, "today" charted hour by hour. No Kitchen, Tables or order-type sections. |
| Settings | `/admin/settings` | Salon details, Payments, Security. No staff-permissions or printer-setup tabs. |

Restaurant-only routes (`/admin/menu`, `/admin/tables`, `/admin/kitchen-template`)
redirect a salon login away. Salon-only routes (`/admin/services`, `/admin/inventory`)
do the same for a restaurant.

### Live Stylists Today board

At the top of the salon dashboard, **refreshed every 10 seconds** (and straight
away when the tab comes back into view). One row per stylist:

| Column | Meaning |
|---|---|
| Customers | Distinct customers on the stylist's **paid** bills today |
| Bills | Paid bills today |
| Services | Services done on those bills (quantities added up) |
| Sales | Total of those bills |
| Last bill | Time of the latest paid bill |

- The top earner so far is highlighted **Top today**.
- *"N unpaid at the desk"* shows bills rung up but not yet paid.
- Every active stylist is listed, including those with nothing yet.
- The **● Live** badge shows the last refresh time and turns amber
  ("Reconnecting…") if a refresh fails.

---

## 5. Receptionist billing screen (`/salon/pos`)

It runs on the same exe till as the restaurant cashier. A receptionist logging in
lands here instead of `/cashier`.

**Billing flow**

1. Pick services (search or category tabs). Quantities are adjusted in the bill panel.
2. **Customer: mobile number and name are both required.**
   - Type **3+ digits** of the mobile number or **2+ letters** of the name, and a
     list of matching existing customers drops down. Click one or use ↑ ↓ + Enter
     (Esc closes the list).
   - Typing the **full 10-digit number** of an existing customer selects them automatically.
   - A number nobody has shows *"New customer — they'll be saved with this bill."*
     The customer is created when the bill is made.
3. **Stylist: required.** Pick who did the work from the dropdown. If the owner
   hasn't added any stylists yet, the panel says so.
4. **Bill & Take Payment →** opens the payment modal (Cash / Card / UPI / Wallet /
   Split). The modal shows the customer and stylist. Removable and opt-in
   charges work as on the restaurant counter.
5. Confirm. The bill is paid and printed, and the screen resets (services,
   customer, stylist and discount) with a *"✓ Bill … paid and printed"* notice.

**Discounts (only if the owner allows them)**

The owner decides in **Settings → Discounts** whether the front desk may give a
discount, and how much:

| Setting | Meaning |
|---|---|
| Allow discounts at the front desk | Off (default): no discount box on the billing screen, and the backend refuses one |
| Maximum discount (%) | The most a receptionist can take off as a percentage. `0` = no percentage discounts |
| Maximum discount (₹) | The most a receptionist can take off as a flat amount. `0` = no flat discounts |

- With the rule on, the bill panel shows **Discount [%] [₹] [ amount ]** under
  Subtotal (only the kinds the owner allowed). Going over a limit shows *"The
  owner allows up to 10% off."* and the Bill button stays disabled.
- **The discount comes off the services before GST.** 2 × ₹300 with 10% off and
  18% GST: Subtotal 600 → Discount (10%) −60 → GST 18% on 540 = 97.20 → Total 637.20.
- The discount is printed on the bill (browser print and direct thermal) as
  *Discount (10%)* or *Discount*, and shown in the payment modal and the bill
  correction popup.
- **Correcting a bill keeps its discount:** a percentage is re-taken off the new
  subtotal, and a flat amount stays (never more than the subtotal).
- The till polls the rule every 10 seconds, so an owner's change reaches the desk
  without a restart (on the exe, once it has synced down).

**Bill on WhatsApp (click-to-chat, no API)**

The owner sets it up in **Admin → Settings → Bills & WhatsApp**:

| Setting | Options |
|---|---|
| Bill printer | **Printer optional** (default): payment shows **Paid · Send on WhatsApp** and **Paid · Print + WhatsApp**. **No printer**: payment shows only **Paid · Send on WhatsApp**, and the till's 🖨 Printer screen is hidden. |
| WhatsApp message | The owner's own text, with tags filled from each bill: `{salon_name}` `{customer_name}` `{bill_no}` `{date}` `{stylist}` `{services}` `{amounts}` (subtotal, discount, GST, total) `{total}` `{payment_method}` `{salon_phone}` `{salon_address}`. Click a tag to insert it at the cursor. Live WhatsApp-style preview with a sample bill, **Reset to default**, up to 2000 characters, `*stars*` for bold. A line whose tags are all empty is left out. |

- `{salon_phone}` is the **shop number given when the super admin created the
  salon** (`restaurants.mobile`), shown on the tab.
- **At payment, both buttons open WhatsApp** on the customer's chat with the bill
  typed in; Print also prints. The receptionist only presses **Send**. WhatsApp
  doesn't let a normal number send without that press; fully automatic sending
  needs the Business API.
- WhatsApp is opened **straight after the payment is saved, before printing**, so
  the browser still treats it as the receptionist's click and doesn't block the
  window. The printer is spooled by the local backend, so it doesn't need that.
- A green panel under the bill says *"WhatsApp opened for Anita"* with
  **Open WhatsApp again**. If the browser blocked the window, it says so and
  offers **Send bill on WhatsApp** (one click).
- **Per till** (this browser, `inwallz_whatsapp_prefs`): open bills in
  **WhatsApp Web** (default; a reused window named `inwallz-whatsapp`, log in
  once with the QR code) or **WhatsApp app** (WhatsApp Desktop via `whatsapp://`;
  Edge asks "Open WhatsApp?" the first time, so tick *Always allow*).
- **Bills → WhatsApp** sends or resends any of today's bills that has a customer
  mobile, from the saved bill (so a corrected bill goes out corrected), with the
  owner's message. Tax and charges show as GST / Service charge / Other charges.
- Numbers get the 91 country code (10 digits, a leading 0 or an existing 91 are handled).
- **Till setup:** in Edge, allow pop-ups for `http://localhost:5050`
  (Settings → Cookies and site permissions → Pop-ups and redirects → Allow), and
  log in to WhatsApp Web once (or install WhatsApp Desktop).

| Method & path | Roles | Purpose |
|---|---|---|
| `PUT /api/settings/whatsapp` `{ bill_delivery, whatsapp_template }` | admin | `bill_delivery`: `printer_optional` \| `no_printer`. Blank template = default (stored NULL). Refuses other values, non-text and over 2000 characters. |
| `GET /api/settings/restaurant` | any signed-in role | Also returns `bill_delivery`, `whatsapp_template` and `shop_mobile` (the till polls it every 10 s) |

Code: `src/utils/whatsappBill.js` (template, message, number, URL, prefs);
`components/Cashier/BillModal.js` (`delivery` + `onWhatsApp` props; the restaurant
counter passes neither and is unchanged); `pages/Salon/Pos.js`;
`BillsHistory`'s `onWhatsApp`; `pages/Admin/Settings.js` (`TabBillsWhatsApp`).
Columns `settings.bill_delivery`, `settings.whatsapp_template` (017, added on boot, synced cloud → till).

**Other views** (☰ menu)

| View | What it does |
|---|---|
| ✂ Services | Mark services available / unavailable |
| 📋 Bills | Today's bills with Customer and Stylist columns (search by bill no., name or mobile). View / Edit corrects a bill and reprints it. |
| 🖨 Printer | One **Bill printer** box (no kitchen printer, whatever setup is stored) |

**Details worth knowing**

- The printed bill (both the browser print and direct thermal printing) shows
  **Stylist:** and prints **Receptionist:** instead of Cashier. The customer's
  name prints when *Show Customer "Name:" Line* is on in Bill Format. No table,
  dine-in, waiter or FSSAI lines.
- Closing the payment modal without paying and pressing Bill again **reuses the
  same unpaid order**. If the services, customer or stylist changed in between,
  the old unpaid order is cancelled first. If the owner turned on *cancel needs
  approval* (Settings → Security), that cancel is refused and the old bill stays
  in Bills as Unpaid. No money is involved.
- The cart survives a page refresh (`usePersistentCart`, key `inwallz_cart_salon`).

---

## 6. How it's built

### 6.1 The business type

- **Column:** `restaurants.business_type VARCHAR(20) NOT NULL DEFAULT 'restaurant'`.
  Every existing tenant is a restaurant.
- **Names stay `restaurant*`.** The table and every `restaurant_id` keep their
  names; renaming them would break the sync engine and every installed till. In
  column names, "restaurant" means "business".
- **Normalising:** `backend/utils/businessType.js` and `src/utils/businessType.js`.
  Anything missing or unknown counts as `restaurant`.

### 6.2 Login and routing

- `backend/models/authModel.js` reads `business_type` from the restaurants row and
  puts it in the **JWT** and the returned `user`. It never comes from the client.
- A token issued before this change has no `business_type` and is treated as a
  restaurant, so nobody is logged out.
- **A `stylist` row can never sign in.** Login answers "Invalid username or
  password" whatever is typed.
- `src/utils/businessType.js → homeFor(user)` decides the landing page. Login and
  `/` both use it:

  | Role | Restaurant | Salon |
  |---|---|---|
  | super_admin | `/super_admin` | — |
  | admin | `/admin/dashboard` | `/admin/dashboard` (salon dashboard) |
  | cashier | `/cashier` | `/salon/pos` |
  | waiter / kitchen | `/waiter` / `/kitchen` | *(not a salon role, so it shows login)* |

- `ProtectedRoute` accepts `types={["restaurant"]}` / `types={["salon"]}` alongside `roles`.
- `roleLabel()` shows admin as **Owner**, cashier as **Receptionist**, and stylist as **Stylist**.

### 6.3 Backend guards (a hidden link is not a permission)

`backend/middleware/businessTypeMiddleware.js` exports `restaurantOnly` and
`salonOnly`. These refuse a salon JWT with **403**:

| Guarded | Where |
|---|---|
| All of `/api/tables` | `routes/tableRoutes.js` |
| All of `/api/kitchen` | `routes/kitchenRoutes.js` |
| All of `/api/kitchen-format` | `routes/kitchenFormatRoutes.js` |
| `/api/orders/running`, `/table/*`, `/item/:id/serve`, `/:id/serve` | `routes/orderRoutes.js` |
| `/api/reports/table-sales` | `routes/reportRoutes.js` |

On top of that, for salon bills (`orderController.createOrder`):
- **Always a counter bill:** `order_type = 'Takeaway'`, `table_id = NULL`,
  `order_status = 'Pending'`. Takeaway is what charges and reports key on.
- **Customer required:** otherwise `400 "Add the customer to this bill."`.
  `customer_id` must belong to the caller's business *(previously unchecked for everyone)*.
- **Stylist required:** otherwise `400 "Choose the stylist for this bill."`.
  `stylist_id` must be an **active `stylist` of the same business**, not a
  receptionist or someone from another business.

Employee roles are validated per type:
- A salon adds `cashier` (username `name_receptionist@salon`) or `stylist`
  (no credentials).
- A restaurant adds admin, cashier, waiter or kitchen.
- A salon edit never changes an employee's role.

*(Previously any role, including `super_admin`, was accepted when adding an employee.)*

### 6.4 Stylists

- **Stored as** `users` rows with `role = 'stylist'`. They get a generated
  username and a long random password nobody is shown, and login refuses the
  role anyway.
- **They sync** cloud → till with the rest of `users`, so the till's dropdown has them.
- **On the bill:** `orders.stylist_id` (NULL for restaurants and for older salon bills).

| Method & path | Roles | Purpose |
|---|---|---|
| `POST /api/employees` `{ full_name, role: "stylist" }` | admin | Add a stylist. Response has `username: null, password: null`. |
| `GET /api/employees/stylists` | admin, **cashier** | Active stylists `{ id, full_name }` for the billing dropdown |
| `GET /api/employees/summary` | admin | Now includes `stylists` |
| `GET /api/dashboard/stylists` | admin | Today's board: `customers`, `bills`, `unpaid_bills`, `services`, `sales`, `last_bill_at` per stylist, sorted by sales |

`stylist_name` is returned by `GET /api/orders`, `/orders/bills/today`,
`/orders/bills/:id` and `/customers/:id/history`.

**Reports:** for a salon, the Staff tab's query groups by `orders.stylist_id`
(stylist, customers, bills, sales, average bill) instead of the employee who
rang the bill up.

### 6.5 Customers

Customers live in the same `customers` table for both business types. It syncs
till → cloud.

| Method & path | Roles | Purpose |
|---|---|---|
| `GET /api/customers` | admin, cashier, waiter | List with `visit_count`, `lifetime_spent`, `last_visit` |
| `GET /api/customers/search?q=` | admin, cashier, waiter | Up to 8 suggestions. Digits (3+) match the mobile; letters (2+) match the name. Prefix matches first. |
| `GET /api/customers/lookup?mobile=` | admin, cashier, waiter | Exact mobile match, or `data: null` |
| `POST /api/customers/resolve` | admin, cashier | Find by mobile, or create with `customer_name` (used while billing) |
| `GET /api/customers/:id/history` | admin, cashier, waiter | The customer plus their bills, with services, stylist and payment method |
| `GET /api/customers/:id` | admin, cashier, waiter | One customer |
| `POST /api/customers` | admin, cashier, waiter | Create |
| `PUT /api/customers/:id` | admin, cashier, waiter | Update details (not the counters) |
| `DELETE /api/customers/:id` | **admin** | Soft delete |

- **One mobile number, one customer** per business. A duplicate gets
  `409 "This mobile number already belongs to …"`.
- **Visit stats are counted from `Completed` orders**, not from
  `customers.total_orders` / `total_spent`, which nothing maintains.
- Validation: name required; mobile exactly 10 digits; email format; date of
  birth `YYYY-MM-DD`. Blank optional fields are stored as NULL (MySQL is strict).

### 6.6 Inventory

```
inventory_items      id, uuid, restaurant_id, item_name, sku, category, unit,
                     quantity, min_quantity (reorder level), cost_price, status,
                     created_at, updated_at, deleted_at
inventory_movements  id, uuid, restaurant_id, inventory_item_id,
                     movement_type ('In' | 'Out' | 'Adjust'),
                     quantity (signed change), balance_after, note, created_by,
                     created_at, updated_at, deleted_at
```

| Method & path | Purpose |
|---|---|
| `GET /api/inventory` | Items, with `is_low` / `is_out` |
| `GET /api/inventory/summary` | `total_items`, `low_stock`, `out_of_stock`, `stock_value` |
| `POST /api/inventory` | Create. Opening stock becomes the first movement. |
| `PUT /api/inventory/:id` | Edit details. **Never changes quantity.** |
| `DELETE /api/inventory/:id` | Soft delete |
| `POST /api/inventory/:id/stock` | `{ movement_type, quantity, note }` |
| `GET /api/inventory/:id/movements` | One item's log |
| `GET /api/inventory/movements` | Log across all items |

All inventory endpoints are **admin only**.

- **In** adds the quantity, **Out** subtracts it, and **Adjust** sets stock to the
  counted number.
- The row is locked (`SELECT … FOR UPDATE`) inside a transaction.
- **Stock never goes below zero**, and a change of 0 is refused.
- The movement log always adds up to the quantity on the item.

### 6.6b Discounts

**The rule** is three columns on the synced `settings` table:
`discount_enabled`, `discount_max_percent`, `discount_max_amount`.

| Method & path | Roles | Purpose |
|---|---|---|
| `PUT /api/settings/discounts` `{ discount_enabled, discount_max_percent, discount_max_amount }` | admin | Save the rule. Refuses % over 100, negatives, and "on" with both limits 0. Saved separately from the main settings form, so neither overwrites the other. |
| `GET /api/settings/restaurant` | any signed-in role | Returns the rule with the other settings (the billing screen reads it here) |
| `POST /api/orders` `{ …, discount_type: "percent" \| "amount", discount_value }` | desk | Discount on a new bill |

**Enforced on the backend** (`backend/utils/discountRules.js → checkDiscount`), against the server-priced subtotal:
- A receptionist's discount must be switched on, of an allowed kind, and within its limit; otherwise `400` with a message for the desk.
- An old client sending a bare `discount` number is checked as a flat amount.
- `orders.discount` stores the rupees; `orders.discount_percent` stores the rate for a % discount (NULL for flat or none).

**Maths** (`backend/utils/billing.js` and its mirror `src/utils/rates.js`):
`totalsFromSubtotal(subtotal, charges, discount)` / `billTotals(…)` clamps the
discount to 0…subtotal, works tax, service charge and percentage charges out on
`taxable = subtotal − discount`, and totals `taxable + tax + service + charges`.
`resolveDiscount(subtotal, { percent, amount })` turns a stored discount back into
rupees. `orderModel` uses it wherever a bill is recomputed (quantity change, item
removed, item added), and settle-time charges are resolved on the discounted goods.

`orders.discount` / `discount_percent` are returned by `/orders/bills/today` and
`/orders/bills/:id`. The **Discounts** approval row in Settings → Security is
hidden for salons (the Discounts tab replaces it).

### 6.7 Dashboard figures

`GET /api/dashboard/summary` gained `customers_today` and `low_stock_items`.
`GET /api/dashboard/stylists` feeds the live board (§4). The `orders` lists also
return `customer_name`, `customer_mobile` and `stylist_name`.

### 6.8 Sync (cloud ↔ till)

| Table / column | Direction | Note |
|---|---|---|
| `restaurants` (incl. `business_type`) | cloud → till | A till learns its type from the cloud row |
| `users` (incl. stylists) | cloud → till | The till's stylist dropdown comes from here |
| `printer_settings` | cloud → till | Mode comes from the cloud; the **bill printer chosen on the till is kept** (`keepLocal`), so restarts, re-activation or an online settings change never make the desk set it up again |
| `customers` | till → cloud | Unchanged |
| `orders.stylist_id` | till → cloud | New foreign key, translated through `users.uuid` like `customer_id` |
| `inventory_items`, `inventory_movements` | cloud → till | New. **Last** in `sync/syncTables.js` |

> **Deploy the cloud before the tills.** A till on the new code pushes orders
> with a `stylist_id` link. A cloud on the old code doesn't know that link and
> rejects the push, so orders would stop syncing until the cloud is updated.
> Pulls are safe either way: the inventory tables are last in the pull order, so
> only those two fail on an old cloud.

### 6.9 Schema changes (automatic on boot)

| Change | Applied by | Documented in |
|---|---|---|
| `restaurants.business_type` | `migrations/syncColumns.js` | `013_business_type_inventory.sql` |
| `inventory_items`, `inventory_movements` | `server.js` | `013_business_type_inventory.sql` |
| `orders.stylist_id` | `migrations/syncColumns.js` | `014_order_stylist.sql` |
| `settings.discount_enabled`, `discount_max_percent`, `discount_max_amount`; `orders.discount_percent` | `server.js` | `016_salon_discounts.sql` |

The discount rule rides on `settings` (cloud → till). `orders.discount` was
already synced up; `orders.discount_percent` is a plain column and goes up with
the order once both sides have it.

Nothing needs running by hand: start the new build and the schema catches up.

---

## 7. Reports page fixes (both business types)

Found by screenshotting the page at desktop and phone widths:

| Problem | Fix |
|---|---|
| Single-section tabs (Sales, Payments, Staff, Kitchen, Tables) squeezed into one narrow column | `.rp-span-12` was never defined in `Reports.css`; added |
| Gaps beside cards in Overview (card widths didn't add up to full rows); worse for salons | Each tab and each business type has an explicit layout where every row adds up to 12 (`TAB_LAYOUTS` / `OVERVIEW_LAYOUT` in `Reports.js`) |
| Top Selling Items "Share" column cut off | Card is wider in the new layout; cards may shrink (`min-width: 0`) and wide tables scroll inside their box |
| "Today" sales chart was a single dot | A one-day range is charted **hour by hour** (09:00–21:00, stretched to any bill outside that) |
| Every admin page ~680px wide on a phone | `.admin-main` gets `min-width: 0` (flex items don't shrink below their content by default); the header now collapses on small screens (no clock, icon-only logout, no profile text) |
| Salon wording | Total/Average **Bills**, **Top Services**, **Services Not Booked**, **Stylist Report**; no kitchen-timing insight ("orders finished later than expected") |
| **Excel / CSV export** listed *Order Types → Takeaway*, *Tables* and restaurant labels for a salon | A salon export has: Summary (Business: Salon, Bills), Hourly/Daily Sales, Payments, Top Services, **Stylists** (with customers), Services Not Booked, Charges & Tax. No Order Types or Tables. File name `inwallz-salon-report_<from>_to_<to>` |

### Other places a salon saw restaurant words (fixed)

| Screen | Was | Now |
|---|---|---|
| Bill details popup (Admin → Bills → view) | "Order #", **Order Type: Takeaway**, Created → Preparing → Ready → Served → Completed, "Items" | "Bill #", no order type, **Created → Paid**, "Unpaid" / "Paid" badge, "Services" |
| Charges page | *Menu Pricing* section (Dine-in / Takeaway / Delivery prices) | Hidden for salons (one price per service, set in Services) |
| Bill correction popup (till → Bills → View / Edit) | "Counter", "Add a missed item", "Loading menu…" | Customer · Stylist, "Add a missed service", "Loading services…" |
| Settings | "restaurant settings" messages, "Cancel Completed Orders" | "salon settings", **Cancel Bills** (owner's approval before a receptionist cancels) |
| Bill Format | "Order Information & Staff", "Show Order / Bill #", `billing@restaurant.com` | "Bill Information & Staff", "Show Bill #", `billing@salon.com` |

Every salon bill is still stored as a counter `Takeaway` order internally —
that is what charges and totals key on — it is just never shown to a salon.

---

## 8. Deploying

1. **Cloud first.** Pull, restart the backend (columns and tables are created on
   boot), then deploy the frontend build. Remember
   `git checkout -- *package-lock.json` before pulling on the server.
2. **Then the exe.** Rebuild `InWallzSetup.exe` and reinstall on tills. As usual,
   data syncs in seconds but code only arrives with a reinstall.
3. **Restaurants are unaffected.** Their type defaults to `restaurant`, and
   existing logins keep working.
4. **New salon till:**
   1. Super admin creates the salon.
   2. On the cloud panel, the owner adds services, GST, **stylists** and a receptionist.
   3. Install and activate the exe with the salon's activation key.
   4. The receptionist logs in on the till.

---

## 9. Files

**Backend: new**
- `utils/businessType.js`
- `middleware/businessTypeMiddleware.js`
- `models/inventoryModel.js`, `controllers/inventoryController.js`, `routes/inventoryRoutes.js`
- `migrations/013_business_type_inventory.sql`, `migrations/014_order_stylist.sql`
- **Discounts:** `utils/discountRules.js`, `migrations/016_salon_discounts.sql`, `tests/discountRules.test.js`

**Backend: changed**
- **Discounts:** `utils/billing.js`, `models/orderModel.js`, `controllers/orderController.js`, `models/settingsModel.js`, `controllers/settingsController.js`, `routes/settingsRoutes.js`, `server.js`, `tests/billing.test.js`
- **Login, super admin, staff:** `models/authModel.js`, `controllers/superAdminController.js`, `controllers/employeeController.js`, `models/employeeModel.js`, `routes/employeeRoutes.js`
- **Customers and orders:** `models/customerModel.js`, `controllers/customerController.js`, `routes/customerRoutes.js`, `controllers/orderController.js`, `models/orderModel.js`
- **Dashboard and reports:** `models/dashboardModel.js`, `controllers/dashboardController.js`, `routes/dashboardRoutes.js`, `models/reportModel.js`, `controllers/reportController.js`
- **Route guards:** `routes/orderRoutes.js`, `routes/tableRoutes.js`, `routes/kitchenRoutes.js`, `routes/kitchenFormatRoutes.js`, `routes/reportRoutes.js`
- **Schema and sync:** `migrations/syncColumns.js`, `sync/syncTables.js`, `server.js`

**Frontend: new**
- `utils/businessType.js`, `utils/salesChartSeries.js`
- `services/customerService.js`, `services/inventoryService.js`, `services/stylistService.js`
- `pages/Salon/Dashboard.js`, `Services.js`, `Inventory.js`, `Pos.js`
- `pages/Admin/Customers.js` (was an empty file; now used by both business types)
- `styles/pages/Salon/Salon.css`

**Frontend: changed**
- **Routing and shell:** `routes/AppRoutes.js`, `components/ProtectedRoute.js`, `pages/Auth/Login.js`, `components/Admin/Sidebar.js`, `Header.js`, `pages/SuperAdmin/Dashboard.js`
- **Staff:** `pages/Admin/Employee.js`, `components/Admin/EmployeeModal.js`, `EmployeeFilters.js`, `EmployeeCards.js`, `EmployeeTable.js`
- **Charges:** `pages/Admin/Charges.js`, `components/Admin/Charges/ChargeModal.js`, `ChargeFilters.js`, `ChargeTable.js`
- **Admin pages and widgets:** `pages/Admin/Orders.js`, `Reports.js`, `Settings.js`, `Billing.js`, `Categories.js`, `Dashboard.js`, `components/Admin/OrderDetailsModal.js`, `RecentOrders.js`, `TopSelling.js`, `DashboardCard.js`
- **Till components and printing:** `components/Cashier/BillModal.js`, `BillsHistory.js`, `MenuAvailability.js`, `PrinterSetup.js`, `utils/billPrinter.js`, `utils/receiptText.js`
- **Styles:** `styles/pages/Admin/Reports.css`, `styles/Admin/Header.css`, `styles/Layouts/AdminLayout.css`
- **WhatsApp bill:** `utils/whatsappBill.js` (new), `tests/whatsappBill.test.mjs` (new), `pages/Salon/Pos.js`, `components/Cashier/BillModal.js`, `components/Cashier/BillsHistory.js`, `pages/Admin/Settings.js`, `services/settingsService.js`, `styles/pages/Salon/Salon.css`, `styles/pages/Admin/Settings.css`; backend `models/settingsModel.js`, `controllers/settingsController.js`, `routes/settingsRoutes.js`, `server.js`, `migrations/017_salon_whatsapp_bills.sql` (new)
- **Discounts:** `utils/rates.js`, `services/settingsService.js`, `pages/Admin/Settings.js` (Discounts tab), `pages/Salon/Pos.js`, `components/Cashier/BillModal.js`, `BillEditModal.js`, `pages/Cashier/Dashboard.js`, `utils/billPrinter.js`, `utils/receiptText.js`, `utils/printBill.js`, `styles/pages/Salon/Salon.css`, `tests/discount.test.mjs` (new)

---

## 10. Tested

| Check | Result |
|---|---|
| API end-to-end: type guards, locked type, receptionist accounts, customer search/resolve/history, cross-tenant rejection, forced counter bills with GST, payments, visit stats, stock In/Out/Adjust, restaurant flows unchanged | **58 / 58 pass** |
| Stylist flow: `orders.stylist_id` added on boot, stylists added without credentials, stylist can't sign in, receptionist can list stylists (but not employees), role can't change on edit, bill refused without stylist or customer, non-stylist or other-business stylist refused, stylist saved and shown on bills / bill header / customer history, board counts and ordering and idle stylists, receptionist blocked from the board, salon Staff report by stylist, hourly "today" series | **27 / 27 pass** |
| Customer search (`q=98` → none, `987` → 3, full number → 1, `an` → Anita, `a_%` → none) | Pass |
| UI smoke tests with a mocked API (billing a new customer, reusing an unpaid bill, customer history, stock-out preview, services form) | **4 / 4 pass** (before the stylist change) |
| Screenshots in headless Edge: salon Reports (Overview, Staff) and dashboard at 1440px; salon Reports, dashboard and Customers at 420px (no horizontal overflow, no console errors); billing screen; restaurant Reports | Pass |
| Discount rule unit tests (`backend/tests/discountRules.test.js`) and discount maths in `billing.test.js` (backend `npm test`) | **52 / 52 pass** (whole backend suite) |
| Discount maths mirror (`tests/discount.test.mjs`, in `npm run test:logic`) | **35 / 35 pass** (whole logic suite) |
| Discount API end-to-end: off by default, receptionist refused while off (incl. legacy `discount`), receptionist can't change the rule, invalid rules refused, owner saves 10% / ₹100, saving main settings keeps it, 10% and ₹100 bills totalled with GST after the discount, 15% / ₹150 / junk refused, bill header + today's bills return it, quantity correction re-takes the %, off again refuses | **25 / 25 pass** |
| WhatsApp bill message (`tests/whatsappBill.test.mjs`: number formatting, service grouping, default message with shop number, missing lines left out, owner's template, blank template → default, template rules, every Settings tag filled, saved bill by bucket, delivery values, URL encoding) | **47 / 47 pass** (whole logic suite) |
| Bills & WhatsApp API: columns added on boot, defaults, `shop_mobile` = mobile given at creation, receptionist refused, bad delivery / >2000 chars / non-text refused, owner saves no printer + own message (CRLF normalised), desk reads it back, salon and discount saves keep it, blank → default with the discount rule untouched | **12 / 12 pass** |
| Production build (`npm run build`, `CI=true`) | Compiles, no warnings |

**Not yet done:** a hands-on click-through by a person and a run on the exe till.

---

## 11. Out of scope (agreed)

Not built for salons: appointment booking, stylist commission,
memberships / packages, and selling products from stock on the bill. Inventory is
stock tracking only. One stylist per bill (not per service).

**Possible follow-ups**
- A stylist per service line, for bills where two stylists work on one customer.
- Stylist commission from the stylist report.
- Deduct stock automatically when a service is billed.
- Customer birthday reminders.
