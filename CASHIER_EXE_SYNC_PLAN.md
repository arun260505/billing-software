# Cashier `.exe` + Offline/Online Sync — Plan

Goal: ship the cashier as a Windows `.exe` that runs a **local backend + MySQL**,
so **billing never stops when the internet drops**, and **syncs to the AWS cloud**
whenever it's online so the admin dashboard (and other branches) stay current.

This is the **local-first** architecture. The cloud is a mirror for reporting,
not the source of truth for billing.

---

## Part A — What the codebase already has (and what blocks sync)

**Already done (good):**
- The backend now serves the built React app (`express.static` + SPA fallback in
  `backend/server.js`), so one machine can host cashier UI + API on
  `http://<lan-ip>:5000`. This is the foundation for the `.exe`.
- `created_at` / `updated_at` exist on most tables (change-detection is possible).
- Per-restaurant scoping (`restaurant_id`) on every table.

**Blockers that must be fixed before sync works:**

| Blocker | Where | Why it breaks sync |
|---|---|---|
| **`INT AUTO_INCREMENT` primary keys** | every table (`inwallz_setup.sql`) | Restaurant creates order `id=5`, cloud already has `id=5` → **collision**. The #1 problem. |
| **Foreign keys on those int IDs** | orders→order_items→menu_items, orders→customers/tables, etc. | When an ID is remapped on sync, every FK pointing at it must be remapped too. |
| **No `deleted_at` anywhere** | all tables | A hard `DELETE` leaves no row to tell the cloud "this was removed" → deletions never sync. |
| **Single DB connection** | `backend/config/db.js` (`createConnection`) | Serializes all queries; `wait_timeout` drops the idle connection overnight with no reconnect → dead till at 9am. Independent bug, worse under sync load. |
| **`order_sequences` transaction on shared connection** | `backend/utils/orderNumber.js` | `FOR UPDATE` on the single shared connection interleaves concurrent orders → corrupt sequence. |
| **Base64 logos in `LONGTEXT`** | `restaurants.logo` | Bloats every sync payload and backup. Belongs in object storage / a URL. |

---

## Part B — Target architecture

```
   RESTAURANT (cashier PC = the .exe)              AWS CLOUD
   ┌───────────────────────────────┐        ┌────────────────────┐
   │  Node backend  ─ serves UI+API │        │  Node + MySQL (RDS)│
   │  Local MySQL   ← SOURCE OF     │◄──────►│  ← mirror for admin│
   │                  TRUTH for     │  sync  │    + reports       │
   │                  today's shift │  when  └────────────────────┘
   │  Waiter phones ── LAN ──┐      │  online         ▲ internet
   └─────────────────────────┼──────┘                 │
                             ▼                    ADMIN (anywhere)
                    http://<lan-ip>:5000
```

**Degradation ladder (the whole point):**

| Failure | Cashier | Waiters | Admin |
|---|---|---|---|
| Internet down | ✅ works (localhost) | ✅ works (LAN) | ❌ stale until reconnect |
| AWS/RDS down | ✅ works | ✅ works | ❌ down |
| Router down | ✅ works | ❌ | ❌ |
| Cashier PC down | ❌ | ❌ | ⚠️ sees data up to last sync |

**Single-writer rule (this is what makes sync tractable — avoid two-way edit conflicts):**

- **Admin owns → syncs DOWN (cloud → restaurant):** `menu_items`, `categories`,
  `charges`, `users`, `roles`, `settings`, `bill_formats`, `kitchen_formats`,
  `restaurants`. Admin edits in the cloud; restaurant pulls. Restaurant treats
  these read-only.
- **Restaurant owns → syncs UP (restaurant → cloud):** `orders`, `order_items`,
  `payments`, `dining_tables`, `customers`, `order_sequences`. Cloud is read-only
  for these; admin can look, not touch.

With that split there are **zero merge conflicts** by construction.

---

## Part C — The ID strategy (the key design decision)

Two options. **Recommend Option 2** (least invasive).

**Option 1 — UUID primary keys everywhere.** Cleanest long-term, but rewrites
every PK and FK, every `insertId` usage, and every query. Big, risky migration.

**Option 2 — Keep local `INT` PKs, add a `uuid` column (recommended).**
- Add `uuid CHAR(36) UNIQUE` (or `BINARY(16)`) to every syncable table, generated
  app-side on insert (`crypto.randomUUID()`).
- **Sync keys on `uuid`; the app keeps using int PKs locally.** FKs stay int
  inside one database; the sync layer translates parent `uuid` → local child FK on
  the receiving side.
- No query rewrites, no FK churn. The `uuid` is purely the cross-database identity.

This means the sync engine does uuid↔local-id mapping per node, but the app code
barely changes.

---

## Part D — Schema changes for sync

For every **syncable** table:
1. `uuid CHAR(36) NOT NULL UNIQUE` — cross-DB identity (Option 2 above).
2. `updated_at TIMESTAMP … ON UPDATE CURRENT_TIMESTAMP` — add where missing
   (`order_items`, `users`, `activity_logs` lack it).
3. `deleted_at TIMESTAMP NULL` — soft delete; replace hard `DELETE`s with a flag.
4. `synced_at TIMESTAMP NULL` (up-tables only) — NULL = not yet pushed.

Plus two new infra tables (local side):
- **`sync_outbox`** `(id, table_name, row_uuid, op[insert|update|delete], payload JSON, created_at, attempts, last_error)` — every syncable write appends a row here. The worker drains it in order with retry/backoff. Survives restarts; makes "what's unsynced" a query, not a guess.
- **`sync_state`** `(table_name, last_pulled_at)` — high-water mark for pulls.

---

## Part E — The sync engine

**Push (restaurant → cloud), every N seconds when online:**
1. Read `sync_outbox` oldest-first.
2. POST a batch to `POST /api/sync/push` on the cloud with an **idempotency key**
   per row (the `uuid` + op) so a retry after a flaky connection can't double-apply.
3. Cloud upserts by `uuid`, remaps parent FKs via its own uuid→id map, returns acks.
4. On ack, delete the outbox row / stamp `synced_at`. On failure, bump `attempts`,
   back off, keep going.

**Pull (cloud → restaurant), every N seconds when online:**
1. `GET /api/sync/pull?since=<sync_state.last_pulled_at>` for admin-owned tables.
2. Cloud returns rows changed since then (including `deleted_at`).
3. Restaurant upserts by `uuid` (translating FKs), applies soft-deletes, advances
   `last_pulled_at`.

**Order numbers must be globally unique:** `orderNumber.js` currently makes
`ORD-YYYYMMDD-0001` scoped to `restaurant_id + date` — unique per restaurant, but
two restaurants collide on the same day in the cloud. Add a restaurant prefix for
the cloud identity.

**Auth for the sync channel:** a per-install **machine credential** (not a staff
login), issued at activation. The restaurant→cloud calls use that, so a leaked
waiter token can't push sync data.

---

## Part F — Packaging the `.exe`

Recommend the **Windows-service + installer** route (not Electron — no need to ship
Chromium; the UI is already a web app the browser opens).

1. **Local MySQL — keep MySQL, don't switch to SQLite.** Same engine as the cloud →
   identical schema and queries, no second SQL dialect to maintain. Ship the
   **MySQL ZIP** (not the MSI wizard) so it installs into *your* folder as *your*
   service (`InWallzMySQL`), can't collide with anything, and the owner never sees
   a root-password prompt. (Check the GPL redistribution terms, or use **MariaDB**,
   a drop-in for `mysql2`, if that's simpler to ship.)
2. **Node backend → single `.exe`** via `pkg` or `nexe`, so Node isn't installed on
   the machine and can't be broken by an OS update.
3. **Register two Windows services** with **NSSM**, auto-start + auto-restart:
   `InWallzMySQL` and `InWallzServer`, with `InWallzServer depends-on InWallzMySQL`.
4. **Retry the DB connect on boot** (see Part A) — service "started" ≠ MySQL
   "accepting connections", especially after a power cut when InnoDB recovers.
   Without this the till is dead every morning.
5. **Installer** with **Inno Setup** → one `InWallzSetup.exe` that:
   - extracts MySQL + backend, generates a **random per-machine** `DB_PASSWORD`
     and `JWT_SECRET` (never a shipped constant),
   - creates the DB, imports the schema,
   - opens firewall port 5000 (Private profile only),
   - registers the services + a nightly `mysqldump` task,
   - takes **one input: an Activation Key** → calls AWS once to fetch
     `restaurant_id` + the machine sync credential, then pulls the initial catalog.
   - drops a desktop shortcut: browser in `--kiosk http://localhost:5000`.

Owner's daily routine becomes: **press power, wait ~40s, bill.** No terminal.

---

## Part G — Phased task list

**Phase 1 — DB hardening (do first; some are independent wins)**
- [ ] `createPool()` + retry-on-boot in `config/db.js`.
- [ ] Give `orderNumber.js` its own pooled connection for the `FOR UPDATE` txn.
- [ ] Add `uuid`, `deleted_at`, missing `updated_at`, `synced_at` columns.
- [ ] Replace hard `DELETE`s with `deleted_at` in the models.
- [ ] Move `restaurants.logo` (and any images) out of the DB to files/S3.

**Phase 2 — Outbox + local sync worker**
- [ ] `sync_outbox` + `sync_state` tables.
- [ ] Append to outbox on every syncable write (thin wrapper in the models).
- [ ] Background worker: drain outbox (push) + poll (pull), with backoff; no-op
      cleanly when offline.

**Phase 3 — Cloud sync endpoints**
- [ ] `POST /api/sync/push` (idempotent upsert by uuid, FK remap).
- [ ] `GET /api/sync/pull?since=…` for admin-owned tables.
- [ ] Machine-credential auth for the sync channel.
- [ ] Global order-number prefix.

**Phase 4 — `.exe` packaging**
- [ ] `pkg` the backend; bundle MySQL ZIP; NSSM services; Inno Setup installer;
      activation flow.

**Phase 5 — Operational hardening**
- [ ] UPS on the cashier PC (clean shutdown, not uptime).
- [ ] Nightly `mysqldump` + the cloud as the offsite copy.
- [ ] Disable Windows auto-restart in service hours; disable sleep; auto-login.
- [ ] Offline licensing (machine-bound key) — LAN-only means no online licence check.

---

## Risks / decisions you need to make

1. **ID strategy** — confirm Option 2 (uuid column) vs Option 1 (full UUID PKs).
2. **Local DB engine** — MySQL (recommended) vs MariaDB (simpler to redistribute).
3. **What syncs vs stays local** — e.g. `activity_logs` should NOT sync (grows
   unbounded); `order_sequences` is a local counter, no cloud value.
4. **Sync cadence + cost** — how fresh must the admin dashboard be? Drives RDS size
   and whether Multi-AZ is worth it.
5. **First-run needs internet once** (activation + initial catalog pull). After
   that, offline indefinitely.

The sync engine (Phases 2–3) is the hardest part of the whole product; Phase 1 is
worth doing regardless because it fixes live bugs (pool, boot retry, sequence race).
