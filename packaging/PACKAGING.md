# Building the InWallz cashier `.exe`

Produces `InWallzSetup.exe` — one installer that turns a Windows PC into an
unattended local-first till (MySQL + backend + UI as auto-starting services),
which syncs to the cloud. The backend is **pure JS** (bcrypt → bcryptjs), so no
native compilation and no `pkg` — we ship a portable Node runtime and run it.

---

## What the installer does on the restaurant PC

1. Copies everything to `C:\Program Files\InWallz\`.
2. Technician enters **one activation key** (`INWZ-XXXX-XXXX`).
3. `install-services.ps1` runs: generates a per-machine DB password + JWT secret,
   initialises MySQL, creates the DB/user, imports the schema, writes
   `backend\.env`, registers two auto-start services (**InWallzMySQL** then
   **InWallzServer**), opens firewall port 5000 (Private).
4. First boot: the backend **activates** with the key (→ restaurant identity +
   sync key) and **pulls the whole catalog** from the cloud. The till is ready.

Daily: power on → ~40s → till on screen. No commands, ever.

---

## One-time: install build tools on YOUR machine

- **Node 20 LTS** — use the same major version for building the payload and for
  the bundled runtime, so `node_modules` matches. (Pure-JS deps are lenient, but
  keep them aligned.)
- **Inno Setup 6** — https://jrsoftware.org/isdl.php (gives you `iscc`).

## One-time: gather the bundled binaries into `packaging\staging\`

```
packaging\staging\
  node\        ← Node "Windows Binary (.zip)" from nodejs.org, extracted so node\node.exe exists
  mysql\       ← MySQL Community "Windows ZIP Archive" from dev.mysql.com, extracted so mysql\bin\mysqld.exe exists
  nssm.exe     ← from https://nssm.cc (win64\nssm.exe)
  install-services.ps1   ← copy of packaging\install-services.ps1
```

> Licensing: MySQL Community is GPL — check redistribution terms, or use MariaDB
> (drop-in for the `mysql2` driver; same steps, `mariadbd.exe`).

---

## Build steps (each release)

```powershell
# 1) Assemble the app payload (React build + backend + prod node_modules)
powershell -ExecutionPolicy Bypass -File packaging\build-app.ps1
#    -> dist\InWallzApp\app\   (verified: runs standalone, serves UI + /api)

# 2) Produce the schema-only SQL the installer imports (from a dev DB that has
#    all the sync columns/tables created — i.e. after the backend has booted once)
mysqldump -u root -p --no-data --routines inwallz_billing > packaging\staging\app\inwallz_schema.sql

# 3) Copy the payload into staging
Copy-Item dist\InWallzApp\app packaging\staging\app -Recurse -Force

# 4) Copy the service script into staging
Copy-Item packaging\install-services.ps1 packaging\staging\ -Force

# 5) Compile the installer
iscc packaging\installer.iss
#    -> packaging\Output\InWallzSetup.exe
```

---

## Per restaurant (you, before going on site)

1. In the cloud admin, create the restaurant.
2. Generate its activation key:
   `POST /api/activate/generate` (super_admin) `{ "restaurant_id": N }` → `INWZ-XXXX-XXXX`.
3. Load the menu/staff/prices in the cloud (the install pulls them down).

## On site (the technician)

1. Set a **static IP / DHCP reservation** for this PC on the router (so waiter
   phones don't lose it after a reboot).
2. Run `InWallzSetup.exe`, enter the activation key, finish.
3. Reboot — confirm the till comes up on its own (this is the real test).
4. Install the printer driver, print a test bill.
5. Waiter phones: same WiFi → the universal APK → enter this PC's IP.

---

## Verified so far (in development)

- **App payload runs standalone** — `dist\InWallzApp\app\backend` boots on the
  copied `node_modules`, serves the cashier UI (200) and login (200).
- **First-run flow** — a blank DB activates and pulls the full catalog + staff;
  a pulled cashier logs in. (Tested with two local databases.)
- **bcryptjs** verifies the existing `$2b$` hashes — logins unchanged.

## Not yet validated (needs a clean Windows target)

- MySQL ZIP init + service under NSSM
- The Inno Setup compile + a real install/reboot cycle
- The kiosk shortcut on the target's browser

These are the `install-services.ps1` / `installer.iss` paths — straightforward
but they need admin rights, the downloaded binaries, and ideally a spare PC or VM
to prove the reboot-comes-up-clean behaviour. Do this on the target and iterate.

---

## Operational hardening (do on the PC)

- UPS (clean shutdown, not uptime) — MySQL corruption on power loss is the risk.
- Nightly `mysqldump` scheduled task (the cloud sync is your offsite copy).
- Disable sleep/hibernate; auto-login Windows; pin Windows Update to off-hours.
