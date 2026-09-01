# Dev machine setup (no exe, no port fights)

Run the app from source with your **own** backend on port 5000 and MySQL on
3306. The cleanest setup for a coding machine — do NOT install the exe here (it
would grab 5000/3306). If the exe is already installed, either uninstall it
(Settings → Apps → InWallz Billing → Uninstall) or run `dev-mode.ps1` before you
start.

## 0) Prerequisites (once)
- **Node.js 18+** (`node -v`)
- **MySQL 8** running locally, and you know the **root password**
  (the service is usually `MySQL80`)
- **Git**

## 1) Get the code
```
git clone https://github.com/arun260505/billing-software.git
cd billing-software
git checkout main
```
(Already have it? `git pull origin main`.)

## 2) Create the database (once)
```
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS inwallz_billing;"
mysql -u root -p inwallz_billing < backend/setup/01_schema.sql
mysql -u root -p inwallz_billing < backend/setup/02_seed.sql
```
The seed creates the "InWallz" restaurant with sample menu/tables and these logins:

| Username          | Password     | Role        |
|-------------------|--------------|-------------|
| inwallz           | Admin@123    | super admin |
| admin@inwallz     | Admin@123    | admin       |
| cashier@inwallz   | Cashier@123  | cashier     |
| waiter@inwallz    | Waiter@123   | waiter      |
| kitchen@inwallz   | Kitchen@123  | kitchen     |

## 3) Backend config
Edit **`backend/.env`** — set your MySQL root password (leave the rest):
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_ROOT_PASSWORD
DB_NAME=inwallz_billing
DB_PORT=3306
JWT_SECRET=any-long-random-string
JWT_EXPIRES_IN=8h
```

## 4) Install dependencies (once)
```
cd backend && npm install && cd ..
npm install
```

## 5) Run it (two terminals)
Terminal 1 — backend:
```
cd backend
npm run dev            # http://localhost:5000  (auto-restarts on change)
```
Terminal 2 — frontend:
```
npm start              # http://localhost:3000
```
The root `.env` already points the frontend at `http://localhost:5000/api`.

## 6) Log in
Open http://localhost:3000 → `cashier@inwallz` / `Cashier@123`.

---

### If the exe is on this machine and you must keep it
Use the toggles instead of uninstalling:
- `dev-tools/dev-mode.ps1` → frees 5000/3306 for development
- `dev-tools/exe-mode.ps1` → runs the packaged exe again

See `dev-tools/README.md`.
