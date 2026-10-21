# Run InWallz Billing locally (developer setup)

This runs the whole app on one PC for development/testing: the Node + Express
backend, the React (CRA) frontend, and a local MySQL database. **No cloud
account or activation key is needed** — the sync worker just stays idle, and
billing works fully offline.

> Heads-up: this talks to a **local** database only. Nothing you do here touches
> any live shop or the cloud.

---

## 1. Install the prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20 LTS | https://nodejs.org — gives `node` and `npm` |
| **MySQL** | 8.x | MySQL Community Server. Remember the **root password** you set |
| **Git** | any | to clone the repo |

Check they're on your PATH:

```bash
node -v        # v20.x
npm -v
mysql --version
```

---

## 2. Clone the repo

The repo is public, so no access or login is needed:

```bash
git clone https://github.com/arun260505/billing-software.git
cd billing-software
```

---

## 3. Create the database

Create an empty database and load the base schema. (The backend also creates
any missing tables/columns on boot, but importing the schema first is the clean,
known-good start.)

```bash
# Windows PowerShell / Git Bash / macOS — enter your MySQL root password when asked
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS inwallz_billing;"
mysql -u root -p inwallz_billing < backend/setup/01_schema.sql
```

---

## 4. Configure the backend

Copy the template and put your own MySQL password in it:

```bash
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Open `backend/.env` and set:

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<your MySQL root password>
DB_NAME=inwallz_billing
DB_PORT=3306
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=8h
```

> The frontend expects the backend on **port 5000** — keep `PORT=5000`.
> You do **not** need any `ACTIVATION_KEY`, `SYNC_ROLE`, or `CLOUD_SYNC_URL` for
> a local run. Leave them out and the app runs offline.

---

## 5. Install dependencies

Two `package.json`s — one for the frontend (repo root) and one for the backend:

```bash
# from the repo root
npm install

# backend
cd backend
npm install
```

---

## 6. Seed the first login

Create the super-admin account (safe to run once):

```bash
# in backend/
npm run seed
```

It prints the login:

```
Username : inwallz
Password : Admin@123
```

(Optional: `npm run seed:menu` adds sample menu items to play with.)

---

## 7. Run it (two terminals)

**Terminal A — backend** (from `backend/`):

```bash
npm run dev        # nodemon, auto-restarts on changes   (or: npm start)
# -> 🚀 Server Running on Port 5000
```

**Terminal B — frontend** (from the repo root):

```bash
npm start
# -> opens http://localhost:3000
```

Leave both running. The browser opens `http://localhost:3000`; the frontend
calls the backend at `http://localhost:5000`.

---

## 8. Log in and explore

1. Open **http://localhost:3000**.
2. Log in as the super admin — **inwallz / Admin@123**.
3. As super admin you create a **restaurant** (or salon) and its admin user.
4. Log in as that restaurant's admin to set up the **menu, tables and staff**,
   then open the **cashier** screen to take bills.

---

## Notes & troubleshooting

- **"Access denied for user 'root'"** → the `DB_PASSWORD` in `backend/.env`
  doesn't match your MySQL root password. (On Windows, if Node can't connect,
  use `DB_HOST=127.0.0.1` instead of `localhost`.)
- **Frontend loads but every call fails** → the backend isn't running, or it's
  not on port 5000. Check Terminal A.
- **"Sync worker: not activated…"** in the backend log is **normal** here — it
  just means there's no cloud to sync to. Billing is unaffected.
- **Ports in use** → stop whatever is on 3000/5000, or change `PORT` in
  `backend/.env` (and set `REACT_APP_API_URL=http://localhost:<port>` for the
  frontend before `npm start`).
- This is a dev setup, not the packaged till. The Windows `.exe` installer
  (bundled Node + MySQL, runs as a service) is a separate, production artifact.
