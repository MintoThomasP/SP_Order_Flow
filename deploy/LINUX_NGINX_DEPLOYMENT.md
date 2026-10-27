# Deploying to a Linux Server with Nginx (Native / Non-Docker)

This guide walks you through deploying **SilverPoint OrderFlow** directly on an **Ubuntu / Debian Linux server** running **Nginx**, **Systemd**, **PostgreSQL**, **Redis**, and **Node.js**.

---

## Architecture

```
Internet (Port 80/443)
       │
       ▼
Nginx (Host Web Server)
 ├── /static/  ──────> /var/www/SP_Order_Flow/backend/staticfiles/
 ├── /media/   ──────> /var/www/SP_Order_Flow/backend/media/
 ├── /api/ & /admin/ > Gunicorn (127.0.0.1:8000) [Systemd: silverpoint-backend]
 └── /         ──────> Next.js (127.0.0.1:3000)  [Systemd: silverpoint-frontend]
```

---

## 1. Install System Dependencies on Linux

SSH into your Linux server and run:

```bash
sudo apt update && sudo apt upgrade -y

# Install Python 3.12, PostgreSQL, Redis, Nginx, Git, build tools
sudo apt install -y python3 python3-pip python3-venv \
    postgresql postgresql-contrib \
    redis-server nginx git curl build-essential \
    libpq-dev libjpeg-dev zlib1g-dev libfreetype6-dev
```

Install **Node.js 20 LTS**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Set Up the PostgreSQL Database

Log into PostgreSQL and create the production user and database:
```bash
sudo -u postgres psql
```

Run these SQL queries:
```sql
CREATE DATABASE silverpoint_pod;
CREATE USER silverpoint_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
ALTER ROLE silverpoint_user SET client_encoding TO 'utf8';
ALTER ROLE silverpoint_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE silverpoint_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE silverpoint_pod TO silverpoint_user;
\q
```

---

## 3. Clone Repository to `/var/www/SP_Order_Flow`

```bash
sudo mkdir -p /var/www/SP_Order_Flow
sudo chown -R $USER:www-data /var/www/SP_Order_Flow

git clone https://github.com/MintoThomasP/SP_Order_Flow.git /var/www/SP_Order_Flow
cd /var/www/SP_Order_Flow
```

---

## 4. Set Up Backend (Python Virtualenv & Database)

```bash
cd /var/www/SP_Order_Flow/backend

# Create virtualenv and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
nano .env
```

Paste and customize your backend `.env`:
```env
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=generate_a_random_64_character_string_here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,YOUR_SERVER_IP,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://yourdomain.com

# PostgreSQL Connection
DB_ENGINE=django.db.backends.postgresql
DB_NAME=silverpoint_pod
DB_USER=silverpoint_user
DB_PASSWORD=YOUR_STRONG_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=5432

# Redis & Celery
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
CELERY_ALWAYS_EAGER=False

# POD API Credentials (Optional)
PRINTIFY_API_TOKEN=your_token
PRINTIFY_SHOP_ID=your_shop_id
PRINTIFY_WEBHOOK_SECRET=your_secret
PEECHO_API_KEY=your_key
PEECHO_WEBHOOK_SECRET=your_secret
```

Apply migrations and collect static files:
```bash
python manage.py migrate
python manage.py collectstatic --noinput

# Create your superadmin login
python manage.py createsuperuser
```

---

## 5. Set Up Frontend (Next.js Production Build)

```bash
cd /var/www/SP_Order_Flow/frontend

# Install dependencies and build optimized bundle
npm ci
npm run build
```

---

## 6. Configure Systemd Services

Copy the provided systemd service files to `/etc/systemd/system/`:

```bash
sudo cp /var/www/SP_Order_Flow/deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

Start and enable all three services:
```bash
# Enable on system reboot
sudo systemctl enable silverpoint-backend
sudo systemctl enable silverpoint-celery
sudo systemctl enable silverpoint-frontend

# Start services now
sudo systemctl start silverpoint-backend
sudo systemctl start silverpoint-celery
sudo systemctl start silverpoint-frontend
```

Verify they are running:
```bash
sudo systemctl status silverpoint-backend
sudo systemctl status silverpoint-frontend
```

---

## 7. Configure Nginx

Copy the Nginx configuration:
```bash
sudo cp /var/www/SP_Order_Flow/deploy/nginx/silverpoint.conf /etc/nginx/sites-available/silverpoint
```

Edit the file to put your domain name:
```bash
sudo nano /etc/nginx/sites-available/silverpoint
# Replace "yourdomain.com" with your actual domain or server IP
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/silverpoint /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default # Remove default Nginx welcome page
sudo nginx -t                              # Test configuration
sudo systemctl restart nginx
```

---

## 8. Add Free HTTPS / SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot automatically configures SSL in `/etc/nginx/sites-available/silverpoint` and sets up automatic certificate renewal.

---

## 9. Updating Code in the Future

To pull new code and restart services:
```bash
cd /var/www/SP_Order_Flow
git pull origin main

# Backend update
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart silverpoint-backend silverpoint-celery

# Frontend update
cd ../frontend
npm ci
npm run build
sudo systemctl restart silverpoint-frontend
```
