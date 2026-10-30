#!/usr/bin/env bash
# ==============================================================================
# SilverPoint OrderFlow - Automated MySQL Database & Permissions Setup
# ==============================================================================
set -e

echo ">>> [1/4] Configuring MySQL Database and User Privileges..."
sudo mysql <<'EOF'
CREATE DATABASE IF NOT EXISTS OrderFlow_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS orderflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'CustomCRM_SP'@'127.0.0.1' IDENTIFIED BY 'CustomCRM_SP@#$2026';
ALTER USER 'CustomCRM_SP'@'127.0.0.1' IDENTIFIED BY 'CustomCRM_SP@#$2026';
GRANT ALL PRIVILEGES ON `OrderFlow_DB`.* TO 'CustomCRM_SP'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `orderflow_db`.* TO 'CustomCRM_SP'@'127.0.0.1';

CREATE USER IF NOT EXISTS 'CustomCRM_SP'@'localhost' IDENTIFIED BY 'CustomCRM_SP@#$2026';
ALTER USER 'CustomCRM_SP'@'localhost' IDENTIFIED BY 'CustomCRM_SP@#$2026';
GRANT ALL PRIVILEGES ON `OrderFlow_DB`.* TO 'CustomCRM_SP'@'localhost';
GRANT ALL PRIVILEGES ON `orderflow_db`.* TO 'CustomCRM_SP'@'localhost';

CREATE USER IF NOT EXISTS 'CustomCRM_SP'@'%' IDENTIFIED BY 'CustomCRM_SP@#$2026';
ALTER USER 'CustomCRM_SP'@'%' IDENTIFIED BY 'CustomCRM_SP@#$2026';
GRANT ALL PRIVILEGES ON `OrderFlow_DB`.* TO 'CustomCRM_SP'@'%';
GRANT ALL PRIVILEGES ON `orderflow_db`.* TO 'CustomCRM_SP'@'%';

FLUSH PRIVILEGES;
EOF

echo ">>> [2/4] Testing MySQL connection with user CustomCRM_SP..."
mysql -u CustomCRM_SP -p'CustomCRM_SP@#$2026' -h 127.0.0.1 OrderFlow_DB -e "SELECT 'DATABASE CONNECTION SUCCESSFUL' AS Status;"

echo ">>> [3/4] Running Django Database Migrations..."
if [ -d ".venv" ]; then
    .venv/bin/python manage.py migrate
elif [ -d "/var/www/SP_Order_Flow/backend/.venv" ]; then
    /var/www/SP_Order_Flow/backend/.venv/bin/python /var/www/SP_Order_Flow/backend/manage.py migrate
else
    python3 manage.py migrate
fi

echo ">>> [4/4] Restarting SilverPoint Backend Service..."
if systemctl list-unit-files | grep -q "silverpoint-backend"; then
    sudo systemctl restart silverpoint-backend
    echo "Service silverpoint-backend restarted successfully."
fi

echo "=========================================================="
echo "  MySQL Setup & Migrations Completed Successfully!        "
echo "=========================================================="
