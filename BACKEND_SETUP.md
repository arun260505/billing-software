# Backend setup — start here

The frontend already runs after `git pull` + `npm install`. The backend needs
four things: **Node packages, a `.env` file, a database, and a running server.**
Follow these five steps in order and it will work.

> ## ⚠️ Do NOT run `inwallz_setup.sql`
>
> That file contains `CREATE DATABASE inwallz_billing;` and `USE inwallz_billing;`
> followed by `DROP TABLE IF EXISTS` for every table. It **ignores whichever
> database you select** and always targets `inwallz_billing` — destroying it.
> It has already wiped a working database once.
>
> It is also missing the `order_items.served` column, so even a "successful" run
> leaves the app broken.
>
> **Use `backend/setup/01_schema.sql` + `backend/setup/02_seed.sql` instead.**
> Those contain no `CREATE DATABASE`, no `USE`, and no `DROP TABLE`, so they
> cannot destroy anything, and they are safe to re-run.

---

## 1. Install the backend packages

```bash
cd "billing-software/backend"
npm install
```

## 2. Create your `.env`

```powershell
# from billing-software/backend
Copy-Item .env.example .env
```

Then open `.env` and set `DB_PASSWORD` to your own MySQL root password.

**The variable is `DB_PASSWORD`, not `DB_PASS`.** `config/db.js` reads
`process.env.DB_PASSWORD`; naming it `DB_PASS` fails silently with
"Database Connection Failed".

## 3. Create the database

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS inwallz_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

## 4. Load the schema, then the starter data

Order matters — schema first.

```bash
# from the billing-software folder
mysql -u root -p inwallz_billing < backend/setup/01_schema.sql
mysql -u root -p inwallz_billing < backend/setup/02_seed.sql
```

Check it landed:

```bash
mysql -u root -p inwallz_billing -e "SELECT username, role, restaurant_id FROM users; SELECT COUNT(*) FROM menu_items; SELECT COUNT(*) FROM dining_tables;"
```

Expect 5 users, 8 menu items, 3 tables.

## 5. Start the backend

```bash
cd "billing-software/backend"
node server.js
```

You should see:

```
✅ MySQL Connected Successfully
🚀 Server Running on Port 5000
```

Confirm from a browser or another terminal:

```bash
curl http://localhost:5000/
# {"message":"InWallz Billing Backend Running"}
```

**Leave this terminal open.** The backend does not hot-reload — after changing
any file in `backend/`, stop it with `Ctrl+C` and run `node server.js` again.

---

## Logins

| Username | Password | Role | Lands on |
|---|---|---|---|
| `inwallz` | `Admin@123` | super_admin | `/super_admin` |
| `admin@inwallz` | `Admin@123` | admin | `/admin/dashboard` |
| `cashier@inwallz` | `Cashier@123` | cashier | `/cashier` |
| `waiter@inwallz` | `Waiter@123` | waiter | `/waiter` |
| `kitchen@inwallz` | `Kitchen@123` | kitchen | `/kitchen` |

Change these before using the system for anything real.

---

## Troubleshooting — the exact problems people hit

### "Nothing shows on any screen" / tables and menu are empty

The backend is not running, or the frontend cannot reach it. Check
`http://localhost:5000/` responds. Every list on every screen comes from the
API, so with the backend down they all render empty — it looks like the data
was deleted when it wasn't.

### "Invalid username or password"

The `users` table has no such user. `inwallz_setup.sql` seeds **only** the
`inwallz` super_admin — no admin, cashier, waiter or kitchen login exists.
Load `backend/setup/02_seed.sql`, which creates all five.

### "A table is created but it does not show in the list"

`order_items` is missing the `served` column. `models/tableModel.js` does
`AND oi.served = 1`, so the `INSERT` succeeds but `GET /api/tables` fails with
`Unknown column 'oi.served' in 'where clause'` and the list comes back empty.

Fix on an existing database:

```sql
ALTER TABLE order_items ADD COLUMN served TINYINT(1) NOT NULL DEFAULT 0;
```

`01_schema.sql` already includes this column.

### "Cannot create a table"

`dining_tables.restaurant_id` is `NOT NULL`, and a `super_admin` has
`restaurant_id = NULL`. Creating a table while logged in as `inwallz` always
fails. **Log in as `admin@inwallz` instead** — an admin belongs to restaurant 1.

The same applies to menu items, categories and employees: they are all
tenant-scoped and cannot be created by the super_admin.

### "Database Connection Failed" on startup

- `DB_PASSWORD` is misspelled as `DB_PASS` in `.env`
- Wrong MySQL password
- MySQL service is not running
- `DB_NAME` does not match the database you created

Note the server **still starts** after a failed DB connection and reports
"Server Running" — but every request then returns a 500. Always check for
`✅ MySQL Connected Successfully` in the startup output.

### Port 5000 already in use

Another copy of the backend is already running.

```powershell
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```

---

## Moving a real database between machines

Do **not** hand someone `inwallz_setup.sql`. Export the live database properly:

```bash
mysqldump -u root -p --databases inwallz_billing --result-file=inwallz_backup.sql
```

`--result-file` writes UTF-8. Using PowerShell's `>` redirect produces a
**UTF-16** file that `mysql <` cannot read — that is why the existing
`inwallz_billing_dump.sql` fails to import.

Restore on the other machine:

```bash
mysql -u root -p < inwallz_backup.sql
```
