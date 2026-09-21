# Cloud server migration (billing.inwallz.in)

How to move the InWallz cloud tier to a **fresh EC2 instance** with **zero data
loss** and keep every till syncing. Done once end‑to‑end (Sep 2026); this is the
exact, repeatable procedure.

The cloud is: **Node backend (pm2) + MySQL 8.4 + nginx (HTTPS)** on Amazon Linux
2023, serving the React build and the `/api`. Tills reach it at
`https://billing.inwallz.in` and authenticate sync with keys stored **in the
database**, so migrating the DB is what keeps them working.

> **Golden rule:** leave the OLD server running and untouched until the new one
> is verified and DNS has cut over. It's your rollback.

---

## 0. Before you start — gather

- The **new instance**: public IP, and its SSH key (e.g. `Key7.pem`).
- The **old instance**: IP + key (e.g. `key6.pem`).
- New instance **Security Group** must allow inbound **22, 80, 443** (443/80 for
  browsers + tills). Set this in the AWS console — it can't be done over SSH.
- Confirm the OS matches (both Amazon Linux 2023) so versions line up.

Set these once in your shell (Git Bash):
```bash
OLD=ec2-user@<OLD_IP>;  OLDKEY="D:/.../key6.pem"
NEW=ec2-user@<NEW_IP>;  NEWKEY="D:/.../Key7.pem"
SSH_OLD="ssh -i $OLDKEY -o StrictHostKeyChecking=no $OLD"
SSH_NEW="ssh -i $NEWKEY -o StrictHostKeyChecking=no $NEW"
```

---

## 1. Inventory the OLD server (so you replicate it)
```bash
$SSH_OLD 'cat /etc/os-release | grep PRETTY; node -v; mysql --version; nginx -v; pm2 list | grep inwallz; \
  grep -E "^PORT|^DB_|^DB_TIMEZONE|^JWT" ~/billing-software/backend/.env | sed -E "s/(PASSWORD=|SECRET=).*/\1***/"; \
  sudo ls /etc/letsencrypt/live/'
```
Note the Node version, MySQL version, DB name/user, `DB_TIMEZONE`, and the cert
domain. (Ours: Node 20, MySQL 8.4.11, DB `inwallz_billing`, `DB_TIMEZONE=+05:30`,
cert `billing.inwallz.in`.)

---

## 2. Pull DB dump + config + certs from OLD → your machine
```bash
MIG=./mig; mkdir -p $MIG
# DB dump (reads creds from the server's own .env — no secrets typed)
$SSH_OLD 'cd ~/billing-software && set -a; . backend/.env; set +a; \
  mysqldump -u"$DB_USER" -p"$DB_PASSWORD" --single-transaction --routines --triggers --events "$DB_NAME" | gzip > /tmp/db.sql.gz'
# stage config + certs on the old box, then copy down
$SSH_OLD 'sudo cp /etc/nginx/conf.d/inwallz.conf /tmp/; sudo tar czf /tmp/letsencrypt.tgz -C /etc letsencrypt; \
  cp ~/billing-software/backend/.env /tmp/backend.env; cp ~/billing-software/.env.production /tmp/frontend.env.production; \
  sudo chown ec2-user:ec2-user /tmp/{inwallz.conf,letsencrypt.tgz,backend.env,frontend.env.production}'
scp -i $OLDKEY $OLD:/tmp/{db.sql.gz,inwallz.conf,letsencrypt.tgz,backend.env,frontend.env.production} $MIG/
```
`backend.env` carries the **DB password, JWT secret, and DB_TIMEZONE** — copying
it verbatim means logins and the timezone behave identically on the new server.

---

## 3. Provision the NEW server
```bash
# base tools + Node 20 (match the old major version) + pm2
$SSH_NEW 'sudo dnf install -y git nginx tar gzip; \
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -; sudo dnf install -y nodejs; \
  sudo npm install -g pm2; node -v; pm2 -v'
# MySQL 8.4 community
$SSH_NEW 'sudo dnf install -y https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm; \
  sudo dnf install -y mysql-community-server; sudo systemctl enable --now mysqld; mysql --version'
```
Keep the OS timezone as **UTC** (same as old) — `DB_TIMEZONE=+05:30` in `.env`
handles IST display.

---

## 4. Deploy the app on NEW
```bash
$SSH_NEW 'git clone https://github.com/arun260505/billing-software.git ~/billing-software'
scp -i $NEWKEY $MIG/backend.env            $NEW:~/billing-software/backend/.env
scp -i $NEWKEY $MIG/frontend.env.production $NEW:~/billing-software/.env.production
scp -i $NEWKEY $MIG/db.sql.gz              $NEW:/tmp/db.sql.gz
scp -i $NEWKEY $MIG/letsencrypt.tgz        $NEW:/tmp/letsencrypt.tgz
scp -i $NEWKEY $MIG/inwallz.conf           $NEW:/tmp/inwallz.conf
```

---

## 5. MySQL: create DB + user (same creds as old) and restore
```bash
$SSH_NEW 'cd ~/billing-software && set -a; . backend/.env; set +a
TEMP=$(sudo grep "temporary password" /var/log/mysqld.log | tail -1 | sed -e "s/.*root@localhost: //")
ROOTPW="Root#$(openssl rand -hex 10)Aa1"
mysql --connect-expired-password -uroot -p"$TEMP" -e "ALTER USER \x27root\x27@\x27localhost\x27 IDENTIFIED BY \x27${ROOTPW}\x27;"
mysql -uroot -p"$ROOTPW" <<SQL
SET GLOBAL validate_password.policy = LOW;
SET GLOBAL validate_password.length = 6;
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS \x27${DB_USER}\x27@\x27localhost\x27 IDENTIFIED BY \x27${DB_PASSWORD}\x27;
ALTER USER \x27${DB_USER}\x27@\x27localhost\x27 IDENTIFIED BY \x27${DB_PASSWORD}\x27;
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO \x27${DB_USER}\x27@\x27localhost\x27; FLUSH PRIVILEGES;
SQL
gunzip -c /tmp/db.sql.gz | mysql -uroot -p"$ROOTPW" "${DB_NAME}"
echo "$ROOTPW" | sudo tee /root/.mysql_root_pw >/dev/null   # keep for later admin
# sanity check
mysql -u"$DB_USER" -p"$DB_PASSWORD" -N -e "SELECT COUNT(*) FROM ${DB_NAME}.restaurants; SELECT COUNT(*) FROM ${DB_NAME}.restaurant_activations;"'
```
The `restaurant_activations` rows carry each till's **sync key** — migrating them
is what lets the tills keep syncing without re‑activation.

---

## 6. Build + run + web server
```bash
# deps + build (uses .env.production -> REACT_APP_API_URL=/api)
$SSH_NEW 'cd ~/billing-software && npm install --no-audit --no-fund && (cd backend && npm install --no-audit --no-fund) && npm run build'
# backend under pm2, from the backend dir, auto-start on boot
$SSH_NEW 'cd ~/billing-software/backend && pm2 start server.js --name inwallz && pm2 save && \
  sudo env PATH=$PATH:/usr/bin $(npm root -g)/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user'
# SSL certs + nginx
$SSH_NEW 'sudo tar xzf /tmp/letsencrypt.tgz -C /etc; sudo cp /tmp/inwallz.conf /etc/nginx/conf.d/inwallz.conf; \
  sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx'
# CRITICAL: let nginx traverse into the home dir (default 700 blocks it -> 500 on the app)
$SSH_NEW 'chmod o+x /home/ec2-user && sudo systemctl reload nginx'
```

---

## 7. Verify NEW before DNS (simulate the domain with --resolve)
```bash
curl -s -o /dev/null -w "app  %{http_code}\n"  --resolve billing.inwallz.in:443:<NEW_IP> https://billing.inwallz.in/
curl -s -o /dev/null -w "api  %{http_code}\n"  --resolve billing.inwallz.in:443:<NEW_IP> https://billing.inwallz.in/api/health
# a real login proves DB + JWT secret + bcrypt all migrated
curl -s --resolve billing.inwallz.in:443:<NEW_IP> -X POST https://billing.inwallz.in/api/auth/login \
  -H "Content-Type: application/json" -d '{"username":"<admin_user>","password":"<pw>"}' -o /dev/null -w "login %{http_code}\n"
```
All three must be **200**. If the app is **500**, it's almost always the home‑dir
permission (step 6, `chmod o+x`).

---

## 8. Cutover (minimise the data gap)
1. **Refresh the DB one last time** so the new server has the latest rows created
   during setup (repeat step 2's dump + step 5's `gunzip | mysql`), then
   `pm2 restart inwallz` on NEW.
2. Confirm **no gap**: order/payment counts and latest `created_at` match on OLD
   and NEW.
3. **Point DNS** `billing.inwallz.in` (A record) → **NEW_IP**. (Lower the TTL
   first if you can, for faster propagation.)
4. Watch it flip:
   ```bash
   nslookup billing.inwallz.in 8.8.8.8
   curl -s -o /dev/null -w "%{http_code} %{remote_ip}\n" https://billing.inwallz.in/api/health
   ```
   `remote_ip` should be NEW_IP. Tills reconnect and resume syncing automatically.

---

## 9. After cutover
- **SSL auto‑renew** on NEW (the renewal config came over with the certs):
  ```bash
  $SSH_NEW 'sudo dnf install -y certbot python3-certbot-nginx; sudo certbot renew --dry-run; \
    sudo systemctl enable --now certbot-renew.timer'
  ```
  The dry‑run must say "renewals succeeded".
- **Reconcile stragglers** (only if bills hit the OLD server between the final
  dump and full DNS propagation): compare OLD vs NEW and copy any orders/payments
  present on OLD but missing on NEW **by `uuid`** (never re‑import the whole dump
  after cutover — it would clobber new data).
- Keep the OLD server up **1–2 days** as rollback. Once tills have billed and
  synced to NEW and figures look right, terminate OLD.

---

## Gotchas learned the hard way
- **App returns 500, API is 200:** nginx can't read the build — `chmod o+x
  /home/ec2-user` (home is `700` by default; it must be `711`).
- **Security group:** if 443 times out from outside, the new instance's SG isn't
  allowing 80/443. Fix in the AWS console.
- **Keep `.env` verbatim:** a new `JWT_SECRET` logs everyone out; a wrong
  `DB_TIMEZONE` shifts all displayed times. Copy the old `.env`, then create the
  MySQL user with the password it already contains.
- **Tills sync via the DB, not config:** because `restaurant_activations`
  (activation + sync keys) is migrated and the domain is unchanged, no till needs
  re‑activation — they just follow DNS to the new server.
- **One DNS switch, no split‑brain:** DNS is the single cutover point. During
  propagation some tills still hit OLD; that's why step 8/9 covers the final
  refresh + reconcile.
