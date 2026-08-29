# Deploying the cloud tier to EC2

Sets up the **cloud/admin tier** on an EC2 instance behind your domain with HTTPS.

> **This is not the restaurant's billing server.** Restaurants run their own local
> install so billing survives an internet outage. This box serves the admin panel,
> the sync endpoint restaurants push to, cross-branch reports, and demos.

Assumes **Ubuntu 22.04/24.04**. For Amazon Linux swap `apt` → `dnf` and
`www-data` → `nginx`.

---

## Before you start

- [ ] **Allocate an Elastic IP** and attach it to the instance.
      Without one the public IP changes every stop/start and your DNS silently breaks.
- [ ] **Security group inbound:** `22` from *your IP only*, `80` and `443` from anywhere.
      **Do not open 5000** — nginx reaches Node locally.
- [ ] **DNS:** an `A` record for your domain → the Elastic IP. Do this first; DNS
      propagation takes time and certbot needs it resolving.
- [ ] If the GitHub repo is **private**, generate a deploy key or a personal access
      token — `git clone` will otherwise hang on a password prompt.

---

## 1. Connect and update

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx
```

## 2. Add swap  ← do not skip on a t2/t3.micro

`react-scripts build` needs ~2 GB. On a 1 GB instance it dies with a bare
`Killed` message that looks like a code error but is the kernel OOM killer.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 3. Node 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

## 4. MySQL

Fine to run on the instance to start; move to RDS later by changing `.env` only.

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation
```

Create the database and an app user (**not** root):

```bash
sudo mysql
```
```sql
CREATE DATABASE inwallz_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'inwallz'@'localhost' IDENTIFIED BY 'PUT_A_LONG_RANDOM_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON inwallz_billing.* TO 'inwallz'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 5. Get the code

```bash
cd /var/www
sudo git clone https://github.com/arun260505/billing-software.git
sudo chown -R $USER:$USER billing-software
cd billing-software
git checkout main
```

## 6. Backend config

`.env` is gitignored, so it never arrives via `git pull` — create it here by hand.
These values are **different** from your local ones.

```bash
nano backend/.env
```
```ini
PORT=5000
DB_HOST=localhost
DB_USER=inwallz
DB_PASSWORD=the_password_from_step_4
DB_NAME=inwallz_billing
DB_PORT=3306
JWT_SECRET=paste_output_of_the_command_below
JWT_EXPIRES_IN=8h
```

Generate a secret unique to this server:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 7. Import the schema

```bash
mysql -u inwallz -p inwallz_billing < inwallz_billing.sql
```

## 8. Build the frontend

The API is same-origin behind nginx, so the path is just `/api`:

```bash
npm ci
echo "REACT_APP_API_URL=/api" > .env.production
npm run build
```

## 9. Run the backend under pm2

```bash
sudo npm install -g pm2
cd backend && npm ci && cd ..
pm2 start backend/server.js --name inwallz
pm2 save
pm2 startup          # run the sudo command it prints — this survives reboots
pm2 logs inwallz --lines 30
```

Expect `Server Running on Port 5000` and `MySQL Connected Successfully`.

## 10. nginx

```bash
sudo nano /etc/nginx/sites-available/inwallz
```
```nginx
server {
    listen 80;
    server_name YOURDOMAIN.com www.YOURDOMAIN.com;

    root /var/www/billing-software/build;
    index index.html;

    client_max_body_size 12M;   # matches the 10mb express.json limit

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        'upgrade';
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React Router: serve index.html for unknown paths so refresh doesn't 404
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/inwallz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Check `http://YOURDOMAIN.com` loads before moving on.

## 11. HTTPS

```bash
sudo apt install -y certbot python3-nginx || sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOURDOMAIN.com -d www.YOURDOMAIN.com
sudo systemctl status certbot.timer     # auto-renewal
```

Certbot rewrites the nginx config for TLS and adds the 80→443 redirect.

---

## Deploying an update

```bash
cd /var/www/billing-software
git pull
npm ci && npm run build
cd backend && npm ci && cd ..
pm2 restart inwallz
```

---

## Before this is safe to call production

The LAN version was protected by private IPs. This one is on the public internet,
so that protection is gone:

- [ ] `helmet` on the Express app
- [ ] rate limit `/api/auth/login` (see `WAITER_MOBILE_TASKS.md` 5.4)
- [ ] CORS: `backend/server.js` currently allows `localhost:3000-3002` and the
      Capacitor origins. Add your domain, drop the localhost entries in production.
- [ ] `backend/config/db.js` uses a **single connection** with no retry — it gives up
      permanently if MySQL is slow to start, which on a reboot means a dead site.
      Switch to `createPool()`.
- [ ] Automated `mysqldump` to S3
- [ ] Never point local development at this database
