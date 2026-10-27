# Production Deployment Guide: SilverPoint OrderFlow

This guide provides step-by-step instructions for deploying the **SilverPoint OrderFlow** application to a live Linux server (Ubuntu / Debian on AWS EC2, DigitalOcean, Hetzner, GCP, or Linode) using **Docker**, **Docker Compose**, **Nginx**, and **PostgreSQL**.

---

## Architecture Overview

```
                      Internet Traffic (Ports 80 & 443)
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Nginx (Reverse Proxy)      │
                      └───────────────┬───────────────┘
                                      │
             ┌────────────────────────┴────────────────────────┐
             ▼                                                 ▼
   Paths: /api/*, /admin/*                               Path: /*
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       Django + Gunicorn       │               │      Next.js (Standalone)     │
│       Backend (Port 8000)     │               │      Frontend (Port 3000)     │
└───────────────┬───────────────┘               └───────────────────────────────┘
                │
     ┌──────────┴──────────┐
     ▼                     ▼
┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │     │    Redis     │
│ Database 16  │     │ Broker 7     │
└──────────────┘     └──────┬───────┘
                            │
                     ┌──────┴───────┐
                     ▼              ▼
              ┌───────────────────────────┐
              │   Celery Background Worker│
              │   (Printify & Peecho Sync)│
              └───────────────────────────┘
```

---

## Prerequisites on the Live Server

- A Linux VPS (Ubuntu 22.04 LTS or 24.04 LTS recommended)
- Minimum Specs: **2 vCPU, 4GB RAM, 20GB+ SSD storage**
- A Domain Name pointing to your Server's Public IP (e.g., `orders.yourdomain.com`)

---

## Step 1: Install Docker and Git on the Live Server

SSH into your remote server:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages and install Docker with Docker Compose plugin:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release git

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## Step 2: Clone the GitHub Repository

Clone the project from GitHub into your deployment directory:
```bash
git clone https://github.com/MintoThomasP/SP_Order_Flow.git /opt/silverpoint-pod
cd /opt/silverpoint-pod
```

---

## Step 3: Configure Production Environment Variables

Copy the production environment template:
```bash
cp .env.production.example .env
```

Edit `.env` with `nano` or `vim`:
```bash
nano .env
```

Configure your live credentials:
```env
# 1. Generate a strong 64-character secret key:
# python3 -c 'import secrets; print(secrets.token_urlsafe(50))'
DJANGO_SECRET_KEY=paste_generated_secret_key_here

# 2. Add your domain and server IP
ALLOWED_HOSTS=orders.yourdomain.com,YOUR_SERVER_IP,localhost,backend
CORS_ALLOWED_ORIGINS=https://orders.yourdomain.com

# 3. Database Credentials
DB_NAME=silverpoint_pod
DB_USER=silverpoint_admin
DB_PASSWORD=YOUR_STRONG_POSTGRES_PASSWORD_HERE

# 4. Printify Credentials (from https://printify.com)
PRINTIFY_API_TOKEN=your_live_printify_token
PRINTIFY_SHOP_ID=your_printify_shop_id
PRINTIFY_WEBHOOK_SECRET=your_printify_webhook_signing_secret

# 5. Peecho Credentials (if using live Peecho integration)
PEECHO_API_KEY=your_peecho_api_key
PEECHO_WEBHOOK_SECRET=your_peecho_webhook_secret

# 6. Public Frontend API Base URL
NEXT_PUBLIC_API_URL=/api/v1
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Step 4: Build and Launch All Services

Run Docker Compose to build images, execute migrations, collect static files, and start all containers:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check running container status:
```bash
docker compose -f docker-compose.prod.yml ps
```
You should see all 6 services running:
- `silverpoint-pod-nginx-1` (Port 80)
- `silverpoint-pod-frontend-1`
- `silverpoint-pod-backend-1`
- `silverpoint-pod-celery_worker-1`
- `silverpoint-pod-postgres-1`
- `silverpoint-pod-redis-1`

---

## Step 5: Create a Superadmin User

Create your Django administrative account:
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```
Follow the interactive prompts to enter email and password.

---

## Step 6: Enable HTTPS / SSL with Certbot (Let's Encrypt)

Install Certbot on the host:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain a free SSL certificate for your domain:
```bash
sudo certbot certonly --standalone -d orders.yourdomain.com
```

Certbot will store your certificates in:
`/etc/letsencrypt/live/orders.yourdomain.com/fullchain.pem`
`/etc/letsencrypt/live/orders.yourdomain.com/privkey.pem`

Mount the certificates into Nginx or configure host Nginx to proxy port 80/443 directly to Docker.

---

## Step 7: How to Deploy Future Updates

Whenever you push new code to GitHub (`git push origin main`), update the live server with one single command:

```bash
cd /opt/silverpoint-pod
./deploy.sh
```

The script automatically:
1. Pulls new commits from GitHub (`git pull origin main`)
2. Builds updated Docker containers
3. Runs database migrations (`python manage.py migrate`)
4. Collects static assets (`python manage.py collectstatic`)
5. Restarts containers seamlessly with zero manual intervention.

---

## Useful Diagnostic Commands

| Action | Command |
| :--- | :--- |
| **View Backend Logs** | `docker compose -f docker-compose.prod.yml logs -f backend` |
| **View Celery Logs** | `docker compose -f docker-compose.prod.yml logs -f celery_worker` |
| **View Frontend Logs** | `docker compose -f docker-compose.prod.yml logs -f frontend` |
| **Restart All Services** | `docker compose -f docker-compose.prod.yml restart` |
| **Stop All Services** | `docker compose -f docker-compose.prod.yml down` |
| **Open Django Shell** | `docker compose -f docker-compose.prod.yml exec backend python manage.py shell` |
| **Database Backup** | `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U silverpoint_admin silverpoint_pod > backup.sql` |
