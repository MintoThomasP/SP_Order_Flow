#!/usr/bin/env bash
# ==============================================================================
# SILVERPOINT POD ORDERFLOW - 1-CLICK SERVER PROVISIONING & DEPLOYMENT SCRIPT
# File: init_deploy.sh
# ==============================================================================
# Target OS:      AWS / Cloud Ubuntu Linux (20.04 / 22.04 / 24.04 LTS)
# Description:    Zero-failure, fully automated bootstrap script for OrderFlow
#                 (Django/Python Backend + Celery + Next.js/PM2 Frontend + MySQL + Nginx)
#
# Capabilities:
#   1. Automatic Dependency Detection & Silent Installation
#      (Node.js 20 LTS, npm, PM2, Python3-venv, MySQL Server, Redis, Nginx, Certbot)
#   2. Low-Memory Guard & 2GB Swap Space Provisioning (Prevents OOM Killer 137)
#   3. Dynamic Port Discovery & Conflict Auto-Incrementation
#      (Auto-checks 8000/3000; if occupied by workhub/monday, increments to 8001/3001)
#   4. Automated MySQL Database Provisioning (OrderFlow_DB, CustomCRM_SP)
#   5. Environment Configuration (.env, backend/.env, frontend/.env.local)
#   6. Virtualenv, Django Migrations, Seeding & Static Asset Collection
#   7. Next.js Production Build with Memory Optimization
#   8. Systemd Services for Backend & Celery Worker
#   9. PM2 Process Manager for Next.js Frontend
#  10. Nginx Reverse Proxy Virtual Host Configuration
#  11. Automated Health Probe Verification
#  12. Optional Automated Let's Encrypt SSL via Certbot (HTTPS)
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ------------------------------------------------------------------------------
# 0. Global Setup & Terminal Formatting
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
VENV_DIR="${PROJECT_ROOT}/backend/.venv"
LOGS_DIR="${PROJECT_ROOT}/logs"
mkdir -p "${LOGS_DIR}"
INIT_LOG="${LOGS_DIR}/init_deploy_$(date +"%Y%m%d_%H%M%S").log"

if [[ -t 1 ]]; then
    BOLD="$(printf '\033[1m')"
    RESET="$(printf '\033[0m')"
    GREEN="$(printf '\033[38;5;46m')"
    BLUE="$(printf '\033[38;5;39m')"
    YELLOW="$(printf '\033[38;5;220m')"
    RED="$(printf '\033[38;5;196m')"
    CYAN="$(printf '\033[38;5;51m')"
    MAGENTA="$(printf '\033[38;5;201m')"
else
    BOLD="" RESET="" GREEN="" BLUE="" YELLOW="" RED="" CYAN="" MAGENTA=""
fi

log_msg() {
    local level="$1"
    local color="$2"
    shift 2
    local message="$*"
    local log_time
    log_time="$(date +"%Y-%m-%d %H:%M:%S")"
    echo -e "${color}[${log_time}] [${level}] ${message}${RESET}" | tee -a "${INIT_LOG}"
}

log_info()    { log_msg "INFO"    "${CYAN}"         "$@"; }
log_step()    { log_msg "STEP"    "${BLUE}${BOLD}"  "$@"; }
log_success() { log_msg "SUCCESS" "${GREEN}${BOLD}" "$@"; }
log_warn()    { log_msg "WARN"    "${YELLOW}"       "$@"; }
log_error()   { log_msg "ERROR"   "${RED}${BOLD}"   "$@"; }

# ------------------------------------------------------------------------------
# 1. Privileges & Sudo Elevation
# ------------------------------------------------------------------------------
CURRENT_USER="$(id -un)"
if [[ "${CURRENT_USER}" == "root" ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

ensure_sudo() {
    if [[ "${CURRENT_USER}" != "root" ]]; then
        if ! sudo -n true 2>/dev/null; then
            log_info "Prompting for sudo password to permit system service and package configurations..."
            sudo -v
        fi
    fi
}
ensure_sudo

# ------------------------------------------------------------------------------
# 1.1 Swap Space Configuration (Prevents OOM Killer Exit Code 137 on AWS/Ubuntu)
# ------------------------------------------------------------------------------
configure_swap() {
    if [[ "$(uname -s)" == "Linux" ]]; then
        local total_ram_kb="$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")"
        local total_swap_kb="$(grep SwapTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")"
        local total_mem_kb=$((total_ram_kb + total_swap_kb))

        if [[ ${total_mem_kb} -lt 3670016 && ${total_swap_kb} -lt 1048576 ]]; then
            log_warn "Low system memory detected (RAM: $((total_ram_kb / 1024))MB, Swap: $((total_swap_kb / 1024))MB)."
            log_info "Configuring automated 2GB swap space to prevent Out-Of-Memory (OOM 137) during Next.js build..."

            if [[ ! -f /swapfile ]]; then
                ${SUDO} fallocate -l 2G /swapfile 2>/dev/null || ${SUDO} dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
                ${SUDO} chmod 600 /swapfile
                ${SUDO} mkswap /swapfile >/dev/null 2>&1
                ${SUDO} swapon /swapfile >/dev/null 2>&1
                if ! grep -q "/swapfile" /etc/fstab 2>/dev/null; then
                    echo "/swapfile none swap sw 0 0" | ${SUDO} tee -a /etc/fstab >/dev/null 2>&1 || true
                fi
                log_success "Automated 2GB swap space provisioned and activated."
            else
                ${SUDO} swapon /swapfile 2>/dev/null || true
                log_success "Existing /swapfile activated."
            fi
        else
            log_info "System memory & swap space audit passed."
        fi
    fi
}
configure_swap

# ------------------------------------------------------------------------------
# 2. Dynamic Port Discovery & Auto-Incrementation
# ------------------------------------------------------------------------------
is_port_in_use() {
    local port="$1"
    if (echo >/dev/tcp/127.0.0.1/"${port}") 2>/dev/null; then
        return 0 # in use
    fi
    if command -v ss >/dev/null 2>&1; then
        if ss -tuln 2>/dev/null | grep -qE "(:${port}\b|\[::\]:${port}\b)"; then
            return 0 # in use
        fi
    fi
    if command -v lsof >/dev/null 2>&1; then
        if lsof -i :"${port}" >/dev/null 2>&1; then
            return 0 # in use
        fi
    fi
    return 1 # free
}

find_next_free_port() {
    local candidate="$1"
    while is_port_in_use "${candidate}"; do
        log_warn "Port ${candidate} is already in use by another service. Checking $((candidate + 1))..."
        candidate=$((candidate + 1))
    done
    echo "${candidate}"
}

# ------------------------------------------------------------------------------
# 3. System Dependency Auto-Detection & Self-Healing Installer
# ------------------------------------------------------------------------------
log_step "[1/8] Auditing and auto-installing required system utilities..."

NEEDED_APT_PKGS=()

check_apt_pkg() {
    local pkg="$1"
    if ! dpkg -s "${pkg}" >/dev/null 2>&1; then
        NEEDED_APT_PKGS+=("${pkg}")
    fi
}

check_apt_pkg curl
check_apt_pkg git
check_apt_pkg ufw
check_apt_pkg net-tools
check_apt_pkg build-essential
check_apt_pkg pkg-config
check_apt_pkg python3
check_apt_pkg python3-venv
check_apt_pkg python3-pip
check_apt_pkg python3-dev
check_apt_pkg default-libmysqlclient-dev
check_apt_pkg mysql-server
check_apt_pkg redis-server
check_apt_pkg nginx
check_apt_pkg certbot
check_apt_pkg python3-certbot-nginx

if [[ ${#NEEDED_APT_PKGS[@]} -gt 0 ]]; then
    log_info "Missing OS packages detected: ${NEEDED_APT_PKGS[*]}. Installing automatically via apt..."
    ${SUDO} apt-get update -y -qq
    ${SUDO} DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${NEEDED_APT_PKGS[@]}"
    log_success "System OS packages installed."
else
    log_success "All prerequisite system OS packages are installed."
fi

# Ensure MySQL, Redis, and Nginx are running
${SUDO} systemctl enable --now mysql
${SUDO} systemctl enable --now redis-server
${SUDO} systemctl enable --now nginx

# Detect or Install Node.js (Node 20 LTS)
NODE_INSTALLED=false
if command -v node >/dev/null 2>&1; then
    NODE_VER="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "${NODE_VER}" -ge 18 ]]; then
        NODE_INSTALLED=true
        log_success "Node.js $(node -v) is already installed."
    else
        log_warn "Installed Node.js version (${NODE_VER}) is older than required 18/20 LTS. Upgrading..."
    fi
fi

if [[ "${NODE_INSTALLED}" == "false" ]]; then
    log_info "Installing Node.js 20.x LTS repository via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | ${SUDO} -E bash -
    ${SUDO} apt-get install -y -qq nodejs
    log_success "Node.js $(node -v) and npm $(npm -v) successfully installed."
fi

# Detect or Install PM2
if ! command -v pm2 >/dev/null 2>&1; then
    log_info "Installing PM2 process manager globally..."
    ${SUDO} npm install -g pm2
    log_success "PM2 installed successfully."
else
    log_success "PM2 is already installed ($(pm2 -v))."
fi

# ------------------------------------------------------------------------------
# 4. Interactive Configuration Questionnaire (with Intelligent Defaults)
# ------------------------------------------------------------------------------
echo ""
echo -e "${MAGENTA}${BOLD}======================================================================${RESET}"
echo -e "${MAGENTA}${BOLD}       SILVERPOINT POD ORDERFLOW - 1-CLICK DEPLOYMENT CONFIGURATOR    ${RESET}"
echo -e "${MAGENTA}${BOLD}======================================================================${RESET}"
echo -e "Press [ENTER] to accept recommended default values shown in brackets."
echo ""

# 4.1 Project Identifier
DEFAULT_APP_NAME="orderflow"
read -r -p "${BOLD}Application / Service Prefix [${DEFAULT_APP_NAME}]: ${RESET}" INPUT_APP_NAME
APP_NAME="${INPUT_APP_NAME:-${DEFAULT_APP_NAME}}"

# 4.2 Domain Name
DEFAULT_DOMAIN="orderflow.silverpointprint.com"
read -r -p "${BOLD}Domain Name for Nginx [${DEFAULT_DOMAIN}]: ${RESET}" INPUT_DOMAIN
DOMAIN="${INPUT_DOMAIN:-${DEFAULT_DOMAIN}}"

# 4.3 Port Auto-Discovery (Avoids conflict with workhub or other apps)
log_info "Scanning for available ports..."
SUGGESTED_BACKEND_PORT="$(find_next_free_port 8000)"
read -r -p "${BOLD}Backend API Port (Gunicorn/Django) [${SUGGESTED_BACKEND_PORT}]: ${RESET}" INPUT_B_PORT
BACKEND_PORT="${INPUT_B_PORT:-${SUGGESTED_BACKEND_PORT}}"
while is_port_in_use "${BACKEND_PORT}"; do
    log_error "Port ${BACKEND_PORT} is currently in use! Please select an open port."
    SUGGESTED_BACKEND_PORT="$(find_next_free_port $((BACKEND_PORT + 1)))"
    read -r -p "${BOLD}Backend API Port [${SUGGESTED_BACKEND_PORT}]: ${RESET}" INPUT_B_PORT
    BACKEND_PORT="${INPUT_B_PORT:-${SUGGESTED_BACKEND_PORT}}"
done

SUGGESTED_FRONTEND_PORT="$(find_next_free_port 3000)"
read -r -p "${BOLD}Frontend Port (Next.js/Node) [${SUGGESTED_FRONTEND_PORT}]: ${RESET}" INPUT_F_PORT
FRONTEND_PORT="${INPUT_F_PORT:-${SUGGESTED_FRONTEND_PORT}}"
while is_port_in_use "${FRONTEND_PORT}"; do
    log_error "Port ${FRONTEND_PORT} is currently in use! Please select an open port."
    SUGGESTED_FRONTEND_PORT="$(find_next_free_port $((FRONTEND_PORT + 1)))"
    read -r -p "${BOLD}Frontend Port [${SUGGESTED_FRONTEND_PORT}]: ${RESET}" INPUT_F_PORT
    FRONTEND_PORT="${INPUT_F_PORT:-${SUGGESTED_FRONTEND_PORT}}"
done

# 4.4 Database Credentials
DEFAULT_DB_NAME="OrderFlow_DB"
read -r -p "${BOLD}MySQL Database Name [${DEFAULT_DB_NAME}]: ${RESET}" INPUT_DB_NAME
DB_NAME="${INPUT_DB_NAME:-${DEFAULT_DB_NAME}}"

DEFAULT_DB_USER="CustomCRM_SP"
read -r -p "${BOLD}MySQL Database User [${DEFAULT_DB_USER}]: ${RESET}" INPUT_DB_USER
DB_USER="${INPUT_DB_USER:-${DEFAULT_DB_USER}}"

DEFAULT_DB_PASS='CustomCRM_SP@#$2026'
read -r -p "${BOLD}MySQL Password [${DEFAULT_DB_PASS}]: ${RESET}" INPUT_DB_PASS
DB_PASS="${INPUT_DB_PASS:-${DEFAULT_DB_PASS}}"

echo ""
log_info "Configuration Parameters Locked:"
log_info "  Project Name:  ${APP_NAME}"
log_info "  Domain:        ${DOMAIN}"
log_info "  Backend Port:  ${BACKEND_PORT}"
log_info "  Frontend Port: ${FRONTEND_PORT}"
log_info "  Database Name: ${DB_NAME}"
log_info "  Database User: ${DB_USER}"
echo ""

# ------------------------------------------------------------------------------
# 5. Automated Database Setup (MySQL)
# ------------------------------------------------------------------------------
log_step "[2/8] Provisioning MySQL database '${DB_NAME}' and user '${DB_USER}'..."

${SUDO} mysql <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
EOF

log_info "Verifying database connection..."
if mysql -u "${DB_USER}" "-p${DB_PASS}" -h 127.0.0.1 "${DB_NAME}" -e "SELECT 1;" >/dev/null 2>&1; then
    log_success "Database '${DB_NAME}' authenticated and verified."
else
    log_error "Could not authenticate to MySQL with the provided credentials. Please check MySQL root access."
    exit 1
fi

# ------------------------------------------------------------------------------
# 6. Environment Files Creation / Update
# ------------------------------------------------------------------------------
log_step "[3/8] Generating secured environment files..."

DJANGO_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"

ENV_FILE="${PROJECT_ROOT}/.env"
cat > "${ENV_FILE}" <<EOF
# ==============================================================================
# ENVIRONMENT CONFIGURATION - GENERATED BY INIT_DEPLOY.SH
# Project: ${APP_NAME} | Timestamp: $(date)
# ==============================================================================

# Application Meta & Port Mapping
APP_NAME=${APP_NAME}
DOMAIN=${DOMAIN}
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
GUNICORN_SERVICE=${APP_NAME}-backend.service
CELERY_SERVICE=${APP_NAME}-celery.service
PM2_APP_NAME=${APP_NAME}-frontend

# Django Core & Security
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=${DJANGO_KEY}
DEBUG=False
ALLOWED_HOSTS=${DOMAIN},127.0.0.1,localhost,0.0.0.0

# CORS & CSRF Security
CORS_ALLOWED_ORIGINS=https://${DOMAIN},http://${DOMAIN},http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}
CSRF_TRUSTED_ORIGINS=https://${DOMAIN},http://${DOMAIN}

# MySQL Database Configuration
DB_ENGINE=django.db.backends.mysql
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_HOST=127.0.0.1
DB_PORT=3306

# Celery & Redis Background Worker
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
CELERY_ALWAYS_EAGER=False

# Peecho Integration Defaults
PEECHO_API_BASE_URL=https://api.peecho.com
PEECHO_API_KEY=sandbox_peecho_live_key_99812
PEECHO_WEBHOOK_SECRET=secret_peecho_sha256_hash_9012
EOF

chmod 600 "${ENV_FILE}"
${SUDO} chown "${CURRENT_USER}:${CURRENT_USER}" "${ENV_FILE}" 2>/dev/null || true
log_success "Root .env generated."

# Inject into backend/.env
cp "${ENV_FILE}" "${BACKEND_DIR}/.env" 2>/dev/null || true
chmod 600 "${BACKEND_DIR}/.env" 2>/dev/null || true
log_success "backend/.env generated."

# Generate Frontend Environment (frontend/.env.local)
mkdir -p "${FRONTEND_DIR}"
cat > "${FRONTEND_DIR}/.env.local" <<EOF
NEXT_PUBLIC_API_URL=/api/v1
PORT=${FRONTEND_PORT}
EOF
log_success "frontend/.env.local created."

# ------------------------------------------------------------------------------
# 7. Backend Build: Virtualenv, Requirements, Migrations & Collectstatic
# ------------------------------------------------------------------------------
log_step "[4/8] Setting up backend virtual environment, migrations, and static assets..."

if [[ ! -d "${VENV_DIR}" ]]; then
    log_info "Creating Python virtual environment at ${VENV_DIR}..."
    python3 -m venv "${VENV_DIR}"
fi

PYTHON_BIN="${VENV_DIR}/bin/python"
PIP_BIN="${VENV_DIR}/bin/pip"

"${PIP_BIN}" install --upgrade pip setuptools wheel --quiet
"${PIP_BIN}" install -r "${BACKEND_DIR}/requirements.txt" gunicorn --quiet
log_success "Python dependencies installed."

# Run Django Migrations & Collectstatic
cd "${BACKEND_DIR}"
"${PYTHON_BIN}" manage.py check
"${PYTHON_BIN}" manage.py migrate --noinput
"${PYTHON_BIN}" manage.py seed_initial_data || true
"${PYTHON_BIN}" manage.py collectstatic --noinput --clear
chmod -R 755 "${BACKEND_DIR}/staticfiles" 2>/dev/null || true
log_success "Django schema migrated and static assets collected."

# ------------------------------------------------------------------------------
# 8. Frontend Build: Node Packages & Production Bundle
# ------------------------------------------------------------------------------
log_step "[5/8] Building Next.js frontend production bundle..."

cd "${FRONTEND_DIR}"
${SUDO} chown -R "${CURRENT_USER}:${CURRENT_USER}" "${FRONTEND_DIR}" 2>/dev/null || true
rm -rf .next

log_info "Installing npm packages..."
npm install --prefer-offline --no-audit --quiet

log_info "Compiling Next.js bundle for domain https://${DOMAIN}..."
NODE_OPTIONS="--max-old-space-size=2048" NODE_ENV=production npm run build
log_success "Next.js frontend compiled successfully."

# ------------------------------------------------------------------------------
# 9. Automated Systemd Backend & Celery Services
# ------------------------------------------------------------------------------
log_step "[6/8] Configuring Systemd services (${APP_NAME}-backend & ${APP_NAME}-celery)..."

# Backend Gunicorn Service
SYSTEMD_BACKEND_FILE="/etc/systemd/system/${APP_NAME}-backend.service"
${SUDO} bash -c "cat > ${SYSTEMD_BACKEND_FILE}" <<EOF
[Unit]
Description=SilverPoint OrderFlow Gunicorn Backend (${APP_NAME})
After=network.target mysql.service redis-server.service

[Service]
User=${CURRENT_USER}
Group=www-data
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${VENV_DIR}/bin/gunicorn \\
          --workers 3 \\
          --bind 127.0.0.1:${BACKEND_PORT} \\
          --timeout 120 \\
          --access-logfile ${LOGS_DIR}/gunicorn_access.log \\
          --error-logfile ${LOGS_DIR}/gunicorn_error.log \\
          config.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Celery Background Worker Service
SYSTEMD_CELERY_FILE="/etc/systemd/system/${APP_NAME}-celery.service"
${SUDO} bash -c "cat > ${SYSTEMD_CELERY_FILE}" <<EOF
[Unit]
Description=SilverPoint OrderFlow Celery Worker (${APP_NAME})
After=network.target redis-server.service mysql.service ${APP_NAME}-backend.service

[Service]
User=${CURRENT_USER}
Group=www-data
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${VENV_DIR}/bin/celery -A config worker --loglevel=info --concurrency=2
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

${SUDO} systemctl daemon-reload
${SUDO} systemctl enable --now "${APP_NAME}-backend.service"
${SUDO} systemctl enable --now "${APP_NAME}-celery.service"
${SUDO} systemctl restart "${APP_NAME}-backend.service"
${SUDO} systemctl restart "${APP_NAME}-celery.service"
log_success "Backend & Celery services active on port ${BACKEND_PORT}."

# ------------------------------------------------------------------------------
# 10. Automated PM2 Frontend Process
# ------------------------------------------------------------------------------
log_step "[7/8] Configuring PM2 process manager for Next.js frontend..."

cd "${FRONTEND_DIR}"
if pm2 describe "${APP_NAME}-frontend" >/dev/null 2>&1; then
    log_info "Restarting existing PM2 application '${APP_NAME}-frontend'..."
    PORT="${FRONTEND_PORT}" pm2 restart "${APP_NAME}-frontend" --update-env
else
    log_info "Starting new PM2 application '${APP_NAME}-frontend' on port ${FRONTEND_PORT}..."
    PORT="${FRONTEND_PORT}" pm2 start npm --name "${APP_NAME}-frontend" -- start
fi
pm2 save >/dev/null 2>&1 || true

# Enable PM2 on system boot
${SUDO} env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${CURRENT_USER}" --hp "/home/${CURRENT_USER}" 2>/dev/null || true
log_success "PM2 frontend running on port ${FRONTEND_PORT}."

# ------------------------------------------------------------------------------
# 11. Automated Nginx Reverse Proxy Configuration
# ------------------------------------------------------------------------------
log_step "[8/8] Configuring Nginx reverse proxy for '${DOMAIN}'..."

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

${SUDO} bash -c "cat > ${NGINX_CONF}" <<EOF
# Unified Reverse Proxy for ${APP_NAME} (${DOMAIN})

upstream ${APP_NAME}_backend {
    server 127.0.0.1:${BACKEND_PORT};
    keepalive 32;
}

upstream ${APP_NAME}_frontend {
    server 127.0.0.1:${FRONTEND_PORT};
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 64M;

    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Django Static Assets
    location /static/ {
        alias ${BACKEND_DIR}/staticfiles/;
        expires 30d;
        access_log off;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # Django Media / Uploads
    location /media/ {
        alias ${BACKEND_DIR}/media/;
        expires 7d;
        access_log off;
    }

    # Django REST Framework, Admin & Peecho Webhooks
    location ~ ^/(api|admin|peecho)/ {
        proxy_pass http://${APP_NAME}_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
    }

    # Next.js Frontend Application
    location / {
        proxy_pass http://${APP_NAME}_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Symlink to sites-enabled
${SUDO} ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/"

# Test Nginx syntax
if ${SUDO} nginx -t; then
    ${SUDO} systemctl reload nginx
    log_success "Nginx virtual host configured and reloaded."
else
    log_error "Nginx syntax error encountered! Please inspect ${NGINX_CONF}."
    exit 1
fi

# ------------------------------------------------------------------------------
# 12. Health Probe Verification
# ------------------------------------------------------------------------------
log_info "Verifying service health..."
sleep 2

if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/api/v1/health/" | grep -q "200"; then
    log_success "Local Backend Health Probe (Port ${BACKEND_PORT}): PASSED (HTTP 200 OK)"
else
    log_warn "Local Backend probe returned non-200. Check logs at ${LOGS_DIR}/gunicorn_error.log."
fi

if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${FRONTEND_PORT}/" | grep -q "200"; then
    log_success "Local Frontend Health Probe (Port ${FRONTEND_PORT}): PASSED (HTTP 200 OK)"
else
    log_warn "Local Frontend probe returned non-200. Check 'pm2 logs ${APP_NAME}-frontend'."
fi

# ------------------------------------------------------------------------------
# 13. Optional SSL Automation (Let's Encrypt / Certbot)
# ------------------------------------------------------------------------------
echo ""
read -r -p "${BOLD}Would you like to automatically configure free SSL (HTTPS) for ${DOMAIN} right now? [y/N]: ${RESET}" CONFIGURE_SSL
if [[ "${CONFIGURE_SSL}" =~ ^[Yy]$ ]]; then
    read -r -p "Enter contact email for Let's Encrypt notices: " SSL_EMAIL
    if [[ -n "${SSL_EMAIL}" ]]; then
        ${SUDO} certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect || log_warn "Certbot encountered an issue. Ensure your DNS A-record points to this server IP."
    else
        ${SUDO} certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect || log_warn "Certbot encountered an issue. Ensure your DNS A-record points to this server IP."
    fi
fi

# ------------------------------------------------------------------------------
# 14. Completion Summary & Dashboard
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo -e "${GREEN}${BOLD}      🎉 INITIAL PROVISIONING & DEPLOYMENT COMPLETED SUCCESSFULLY!    ${RESET}"
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo -e "  🌐 Public URL:         ${BOLD}http://${DOMAIN}${RESET} (or https if SSL enabled)"
echo -e "  🔌 Backend Port:       ${BOLD}${BACKEND_PORT}${RESET} (Service: ${APP_NAME}-backend.service)"
echo -e "  ⚙️  Celery Service:     ${BOLD}${APP_NAME}-celery.service${RESET}"
echo -e "  💻 Frontend Port:      ${BOLD}${FRONTEND_PORT}${RESET} (PM2: ${APP_NAME}-frontend)"
echo -e "  🗄️  MySQL Database:     ${BOLD}${DB_NAME}${RESET}"
echo -e "  👤 MySQL User:         ${BOLD}${DB_USER}${RESET}"
echo -e "  📄 Environment File:   ${PROJECT_ROOT}/.env & ${BACKEND_DIR}/.env"
echo -e "  📋 Deployment Log:     ${INIT_LOG}"
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo -e "For all future daily zero-downtime updates, simply run:"
echo -e "  ${BOLD}./deploy.sh${RESET}"
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo ""

exit 0
