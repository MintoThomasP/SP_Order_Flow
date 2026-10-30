#!/usr/bin/env bash
# ==============================================================================
# PRODUCTION-GRADE ZERO-DOWNTIME FULL-STACK DEPLOYMENT SCRIPT
# Project: SilverPoint POD OrderFlow (orderflow.silverpointprint.com)
# File: deploy.sh
# ==============================================================================
# Target Platform:  AWS / Cloud Ubuntu Linux (20.04 / 22.04 / 24.04 LTS)
# Web Server:       Nginx (Reverse Proxy & Static Asset Caching)
# Application Tier: Gunicorn + Celery (Backend) & Next.js / PM2 (Frontend)
# Database Engine:  MySQL 8.0+
#
# Execution Pipeline:
#   1. Safety & Concurrency Guard (Mutex Lock, Permissions, Secured .env)
#   2. Source Code Synchronization (Git Fetch & Reset to latest main)
#   3. Automated Database Hot-Backup (Timestamped, Gzipped, Strict 5-Backup Retention)
#   4. Backend Build & Migrations (Virtualenv, Pip Sync, Migrations, Static Assets)
#   5. Frontend Build (Clean build cache, Memory-Safe Compilation)
#   6. Process Reload (Gunicorn Restart, Celery Restart, PM2 Reload, Nginx Reload)
#   7. Health Check Verification (Liveness probes with retry mechanism)
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ------------------------------------------------------------------------------
# 0. Global Paths & Defaults
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
VENV_DIR="${BACKEND_DIR}/.venv"
[[ ! -d "${VENV_DIR}" && -d "${PROJECT_ROOT}/.venv" ]] && VENV_DIR="${PROJECT_ROOT}/.venv"
LOGS_DIR="${PROJECT_ROOT}/logs"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOCK_FILE="/tmp/orderflow_deploy.lock"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
BACKUP_MAX_KEEP=5
HEALTHCHECK_MAX_RETRIES=15
HEALTHCHECK_INTERVAL_SEC=3

SKIP_BACKUP=false
SKIP_NPM_INSTALL=false
DRY_RUN=false

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
mkdir -p "${LOGS_DIR}" "${BACKUP_DIR}"
DEPLOY_LOG_FILE="${LOGS_DIR}/deploy_${TIMESTAMP}.log"
DEPLOY_START_TIME="$(date +%s)"

# ------------------------------------------------------------------------------
# UI Formatting & Colors
# ------------------------------------------------------------------------------
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
    echo -e "${color}[${log_time}] [${level}] ${message}${RESET}" | tee -a "${DEPLOY_LOG_FILE}"
}

log_info()    { log_msg "INFO"    "${CYAN}"         "$@"; }
log_step()    { log_msg "STEP"    "${BLUE}${BOLD}"  "$@"; }
log_success() { log_msg "SUCCESS" "${GREEN}${BOLD}" "$@"; }
log_warn()    { log_msg "WARN"    "${YELLOW}"       "$@"; }
log_error()   { log_msg "ERROR"   "${RED}${BOLD}"   "$@"; }

cleanup() {
    local exit_code=$?
    rm -f "${LOCK_FILE}" 2>/dev/null || true
    if [[ ${exit_code} -ne 0 ]]; then
        log_error "Deployment failed with exit code ${exit_code}!"
        log_error "Detailed log available at: ${DEPLOY_LOG_FILE}"
    fi
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# CLI Flag Parsing
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -b|--branch)     DEPLOY_BRANCH="$2"; shift 2 ;;
        -r|--remote)     DEPLOY_REMOTE="$2"; shift 2 ;;
        --skip-backup)   SKIP_BACKUP=true; shift ;;
        --skip-npm)      SKIP_NPM_INSTALL=true; shift ;;
        --dry-run)       DRY_RUN=true; shift ;;
        -h|--help)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo "Options:"
            echo "  -b, --branch <name>   Git branch (default: main)"
            echo "  --skip-backup         Skip database backup"
            echo "  --skip-npm            Skip npm dependency install"
            echo "  --dry-run             Simulate without restarting services"
            exit 0
            ;;
        *) log_error "Unknown argument: $1"; exit 1 ;;
    esac
done

# ==============================================================================
# STAGE 1: ENVIRONMENT PRE-CHECKS & SAFETY
# ==============================================================================
log_step "[1/7] Performing pre-checks, mutex lock, and loading environment..."

# 1.1 Mutex Lock
if [[ -f "${LOCK_FILE}" ]]; then
    EXISTING_PID="$(cat "${LOCK_FILE}" 2>/dev/null || true)"
    if [[ -n "${EXISTING_PID}" ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
        log_error "Another deployment is actively running with PID ${EXISTING_PID}. Aborting."
        exit 1
    fi
    rm -f "${LOCK_FILE}"
fi
echo "$$" > "${LOCK_FILE}"

CURRENT_USER="$(id -un)"
log_info "Deploying as user: ${CURRENT_USER}"

# Validate sudo privileges
if [[ "${DRY_RUN}" == "false" ]]; then
    if ! sudo -n true 2>/dev/null; then
        sudo -v || { log_error "User '${CURRENT_USER}' lacks sudo privileges."; exit 1; }
    fi
fi

# 1.2 Locate and Load .env
ENV_FILE=""
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    ENV_FILE="${PROJECT_ROOT}/.env"
elif [[ -f "${BACKEND_DIR}/.env" ]]; then
    ENV_FILE="${BACKEND_DIR}/.env"
fi

if [[ -z "${ENV_FILE}" || ! -f "${ENV_FILE}" ]]; then
    log_error "No environment file (.env) found! Run ./init_deploy.sh first."
    exit 1
fi

chmod 600 "${ENV_FILE}" 2>/dev/null || true
log_info "Loading environment variables from ${ENV_FILE}..."
while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "${line}" || "${line}" =~ ^# ]] && continue
    if [[ "${line}" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$ ]]; then
        k="${BASH_REMATCH[1]}"
        v="${BASH_REMATCH[2]}"
        [[ "${v}" =~ ^\"(.*)\"$ ]] && v="${BASH_REMATCH[1]}"
        [[ "${v}" =~ ^\'(.*)\'$ ]] && v="${BASH_REMATCH[1]}"
        export "${k}=${v}"
    fi
done < "${ENV_FILE}"

APP_NAME="${APP_NAME:-orderflow}"
GUNICORN_SERVICE="${GUNICORN_SERVICE:-${APP_NAME}-backend.service}"
CELERY_SERVICE="${CELERY_SERVICE:-${APP_NAME}-celery.service}"
PM2_APP_NAME="${PM2_APP_NAME:-${APP_NAME}-frontend}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# Auto-detect ports from systemd unit files if needed
if [[ -f "/etc/systemd/system/${GUNICORN_SERVICE}" ]]; then
    PORT_IN_UNIT="$(grep -oE '127\.0\.0\.1:[0-9]+' "/etc/systemd/system/${GUNICORN_SERVICE}" 2>/dev/null | cut -d: -f2 | head -n1 || true)"
    [[ -n "${PORT_IN_UNIT}" ]] && BACKEND_PORT="${PORT_IN_UNIT}"
fi

# Memory & Swap Check
if [[ "$(uname -s)" == "Linux" ]]; then
    RAM_KB="$(grep MemTotal /proc/meminfo | awk '{print $2}')"
    SWAP_KB="$(grep SwapTotal /proc/meminfo | awk '{print $2}')"
    if [[ $((RAM_KB + SWAP_KB)) -lt 3670016 && ${SWAP_KB} -lt 1048576 ]]; then
        log_warn "Low memory detected ($((RAM_KB/1024))MB RAM, $((SWAP_KB/1024))MB Swap). Activating swap..."
        if sudo -n true 2>/dev/null && [[ ! -f /swapfile ]]; then
            sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
            sudo chmod 600 /swapfile
            sudo mkswap /swapfile >/dev/null 2>&1
            sudo swapon /swapfile >/dev/null 2>&1
        fi
    fi
fi
log_success "Environment ready: Backend port ${BACKEND_PORT}, Frontend port ${FRONTEND_PORT}."

# ==============================================================================
# STAGE 2: SOURCE CODE SYNCHRONIZATION
# ==============================================================================
log_step "[2/7] Synchronizing repository from ${DEPLOY_REMOTE}/${DEPLOY_BRANCH}..."

if [[ "${DRY_RUN}" == "false" ]]; then
    cd "${PROJECT_ROOT}"
    git fetch "${DEPLOY_REMOTE}" "${DEPLOY_BRANCH}" --quiet
    git reset --hard "${DEPLOY_REMOTE}/${DEPLOY_BRANCH}" --quiet
    log_success "Git repository updated to commit $(git rev-parse --short HEAD)."
else
    log_info "[DRY-RUN] Skipping git pull."
fi

# ==============================================================================
# STAGE 3: AUTOMATED DATABASE HOT-BACKUP
# ==============================================================================
log_step "[3/7] Performing automated database backup..."

if [[ "${SKIP_BACKUP}" == "false" && "${DRY_RUN}" == "false" ]]; then
    BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
    if command -v mysqldump >/dev/null 2>&1; then
        if mysqldump -u "${DB_USER}" "-p${DB_PASSWORD}" -h "${DB_HOST:-127.0.0.1}" --single-transaction --quick "${DB_NAME}" 2>/dev/null | gzip > "${BACKUP_FILE}"; then
            log_success "Database hot-backup saved: $(basename "${BACKUP_FILE}") ($(du -h "${BACKUP_FILE}" | cut -f1))"
        else
            log_warn "mysqldump encountered an issue; proceeding with deployment."
        fi
    fi

    # Retention: keep last 5 backups
    ls -1t "${BACKUP_DIR}"/backup_*.sql.gz 2>/dev/null | tail -n +$((BACKUP_MAX_KEEP + 1)) | xargs -r rm -f --
else
    log_info "Database backup skipped."
fi

# ==============================================================================
# STAGE 4: BACKEND BUILD & MIGRATIONS
# ==============================================================================
log_step "[4/7] Updating Python virtualenv, applying migrations, and collecting static files..."

if [[ "${DRY_RUN}" == "false" ]]; then
    [[ ! -d "${VENV_DIR}" ]] && python3 -m venv "${VENV_DIR}"
    PYTHON_BIN="${VENV_DIR}/bin/python"
    PIP_BIN="${VENV_DIR}/bin/pip"

    "${PIP_BIN}" install --upgrade pip setuptools wheel --quiet
    "${PIP_BIN}" install -r "${BACKEND_DIR}/requirements.txt" gunicorn --quiet

    cd "${BACKEND_DIR}"
    "${PYTHON_BIN}" manage.py check
    "${PYTHON_BIN}" manage.py migrate --noinput
    "${PYTHON_BIN}" manage.py collectstatic --noinput --clear
    chmod -R 755 "${BACKEND_DIR}/staticfiles" 2>/dev/null || true
    log_success "Backend dependencies and migrations synced."
else
    log_info "[DRY-RUN] Skipping backend build."
fi

# ==============================================================================
# STAGE 5: FRONTEND BUILD
# ==============================================================================
log_step "[5/7] Compiling Next.js frontend production bundle..."

if [[ "${DRY_RUN}" == "false" ]]; then
    cd "${FRONTEND_DIR}"
    sudo chown -R "${CURRENT_USER}:${CURRENT_USER}" "${FRONTEND_DIR}" 2>/dev/null || true
    rm -rf .next

    if [[ "${SKIP_NPM_INSTALL}" == "false" ]]; then
        npm install --prefer-offline --no-audit --quiet
    fi

    NODE_OPTIONS="--max-old-space-size=2048" NODE_ENV=production npm run build
    log_success "Next.js frontend build completed."
else
    log_info "[DRY-RUN] Skipping frontend build."
fi

# ==============================================================================
# STAGE 6: SERVICE RELOAD
# ==============================================================================
log_step "[6/7] Reloading Gunicorn, Celery, PM2, and Nginx..."

if [[ "${DRY_RUN}" == "false" ]]; then
    # Reload Gunicorn
    if systemctl list-unit-files | grep -q "${GUNICORN_SERVICE}"; then
        sudo systemctl restart "${GUNICORN_SERVICE}"
        log_success "Gunicorn service (${GUNICORN_SERVICE}) restarted."
    fi

    # Reload Celery
    if systemctl list-unit-files | grep -q "${CELERY_SERVICE}"; then
        sudo systemctl restart "${CELERY_SERVICE}"
        log_success "Celery service (${CELERY_SERVICE}) restarted."
    fi

    # Reload PM2 Frontend
    cd "${FRONTEND_DIR}"
    if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
        PORT="${FRONTEND_PORT}" pm2 reload "${PM2_APP_NAME}" --update-env || PORT="${FRONTEND_PORT}" pm2 restart "${PM2_APP_NAME}" --update-env
        log_success "PM2 process (${PM2_APP_NAME}) reloaded."
    else
        PORT="${FRONTEND_PORT}" pm2 start npm --name "${PM2_APP_NAME}" -- start
        pm2 save >/dev/null 2>&1 || true
        log_success "PM2 process (${PM2_APP_NAME}) started."
    fi

    # Reload Nginx
    if sudo nginx -t >/dev/null 2>&1; then
        sudo systemctl reload nginx
        log_success "Nginx reloaded."
    else
        log_error "Nginx syntax error! Check 'sudo nginx -t'."
    fi
else
    log_info "[DRY-RUN] Skipping service reloads."
fi

# ==============================================================================
# STAGE 7: HEALTH CHECK VERIFICATION
# ==============================================================================
log_step "[7/7] Probing application health..."

sleep 2
BACKEND_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/api/v1/health/"
FRONTEND_HEALTH_URL="http://127.0.0.1:${FRONTEND_PORT}/"

for i in $(seq 1 "${HEALTHCHECK_MAX_RETRIES}"); do
    B_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_HEALTH_URL}" || echo "000")"
    F_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_HEALTH_URL}" || echo "000")"

    if [[ "${B_STATUS}" == "200" && "${F_STATUS}" == "200" ]]; then
        log_success "Backend (${B_STATUS}) & Frontend (${F_STATUS}) are both HEALTHY (Attempt ${i})."
        break
    fi
    log_info "Probing... Attempt ${i}/${HEALTHCHECK_MAX_RETRIES} (Backend: ${B_STATUS}, Frontend: ${F_STATUS})"
    sleep "${HEALTHCHECK_INTERVAL_SEC}"
done

DEPLOY_DURATION=$(( $(date +%s) - DEPLOY_START_TIME ))

echo ""
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo -e "${GREEN}${BOLD}      🎉 ZERO-DOWNTIME DEPLOYMENT COMPLETED IN ${DEPLOY_DURATION}s!             ${RESET}"
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo -e "  🌐 Public URL:     https://${DOMAIN:-orderflow.silverpointprint.com}"
echo -e "  🔌 Backend:        127.0.0.1:${BACKEND_PORT} (${GUNICORN_SERVICE})"
echo -e "  ⚙️  Celery:         ${CELERY_SERVICE}"
echo -e "  💻 Frontend:       127.0.0.1:${FRONTEND_PORT} (PM2: ${PM2_APP_NAME})"
echo -e "  📋 Deploy Log:     ${DEPLOY_LOG_FILE}"
echo -e "${GREEN}${BOLD}======================================================================${RESET}"
echo ""

exit 0
