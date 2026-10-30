#!/usr/bin/env bash
# ==============================================================================
# SilverPoint OrderFlow - Frontend Build & Deployment Script
# ==============================================================================
set -e

echo ">>> [1/5] Checking Memory and Swap Space..."
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
echo "Server RAM: ${TOTAL_RAM_MB}MB | Swap: ${TOTAL_SWAP_MB}MB"

if [ "$TOTAL_SWAP_MB" -lt 1024 ] && [ "$TOTAL_RAM_MB" -lt 3000 ]; then
    echo "------------------------------------------------------------------"
    echo "WARNING: Low memory detected without sufficient swap space."
    echo "If 'next build' exits with 'Killed', run these commands to add swap:"
    echo "  sudo fallocate -l 2G /swapfile"
    echo "  sudo chmod 600 /swapfile"
    echo "  sudo mkswap /swapfile"
    echo "  sudo swapon /swapfile"
    echo "------------------------------------------------------------------"
fi

echo ">>> [2/5] Ensuring directory permissions..."
sudo chown -R $USER:www-data /var/www/SP_Order_Flow/frontend 2>/dev/null || true

echo ">>> [3/5] Installing dependencies..."
npm install

echo ">>> [4/5] Building Next.js production bundle..."
# Limit heap to avoid OOM killing on 1GB/2GB VPS instances
NODE_OPTIONS="--max-old-space-size=2048" npm run build

echo ">>> [5/5] Restarting frontend service..."
if command -v systemctl >/dev/null && systemctl list-unit-files | grep -q "silverpoint-frontend"; then
    sudo systemctl restart silverpoint-frontend
    echo "silverpoint-frontend restarted successfully."
    sudo systemctl status silverpoint-frontend --no-pager
fi

echo "=========================================================="
echo "  Frontend Successfully Built & Deployed!                 "
echo "=========================================================="
