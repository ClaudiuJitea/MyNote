#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASS="${ADMIN_PASS:-$(openssl rand -base64 18 2>/dev/null || php -r 'echo bin2hex(random_bytes(12));')}"

load_db_config_from_file() {
    mapfile -t _cfg < <(php -r '$c = require "api/config.local.php"; echo ($c["db_name"] ?? "")."\n".($c["db_user"] ?? "")."\n".($c["db_pass"] ?? "");')
    DB_NAME="${_cfg[0]}"
    DB_USER="${_cfg[1]}"
    DB_PASS="${_cfg[2]}"
    if [[ -z "$DB_NAME" || -z "$DB_USER" || -z "$DB_PASS" ]]; then
        echo "ERROR: api/config.local.php is missing db_name, db_user, or db_pass." >&2
        exit 1
    fi
}

if [[ -f api/config.local.php ]]; then
    load_db_config_from_file
    echo "Using database settings from api/config.local.php (${DB_USER}@${DB_NAME})"
else
    DB_NAME="${DB_NAME:-mynote_local}"
    DB_USER="${DB_USER:-mynote_local}"
    DB_PASS="${DB_PASS:-$(openssl rand -base64 24 2>/dev/null || php -r 'echo bin2hex(random_bytes(16));')}"
    APP_SECRET="$(openssl rand -hex 32 2>/dev/null || php -r 'echo bin2hex(random_bytes(32));')"
    cat > api/config.local.php <<PHP
<?php
return [
    'db_host' => 'localhost',
    'db_name' => '${DB_NAME}',
    'db_user' => '${DB_USER}',
    'db_pass' => '${DB_PASS}',
    'app_secret' => '${APP_SECRET}',
];
PHP
    echo "Created api/config.local.php"
fi

# Check if database and admin user already exist
DB_EXISTS=$(sudo mysql -N -B -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${DB_NAME}'" 2>/dev/null || true)
CREATE_ADMIN=true

if [[ -n "$DB_EXISTS" ]]; then
    echo "Database '${DB_NAME}' already exists."
    # Check if admin user exists in the database
    ADMIN_EMAIL_DB=$(sudo mysql -N -B -e "SELECT email FROM users WHERE role = 'admin' LIMIT 1" "${DB_NAME}" 2>/dev/null || true)
    if [[ -n "$ADMIN_EMAIL_DB" ]]; then
        echo "Detected existing admin user: ${ADMIN_EMAIL_DB}"
        ADMIN_EMAIL="${ADMIN_EMAIL_DB}"
        ADMIN_PASS="(Retained from previous deployment)"
        CREATE_ADMIN=false
    fi
fi

echo "Creating MySQL database, user, and tables..."
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;

USE ${DB_NAME};

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  openrouter_api_key TEXT NULL,
  openrouter_model VARCHAR(128) NULL DEFAULT 'google/gemma-4-26b-a4b-it',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notebooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notebook_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT,
  is_favorite TINYINT(1) DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  ocr_text LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
SQL

echo "Preparing uploads directory..."
mkdir -p uploads data/rate_limits
chmod 775 uploads
chmod 700 data data/rate_limits

if ! php -m | grep -qi '^zip$'; then
    echo "WARNING: PHP zip extension not found. Install it for export/import (e.g. sudo apt install php-zip)."
fi

if [[ "$CREATE_ADMIN" = true ]]; then
    echo "Creating admin user..."
    php scripts/setup_admin_cli.php "${ADMIN_EMAIL}" "${ADMIN_PASS}"
else
    echo "Existing admin user detected. Keeping current credentials."
fi

echo
echo "Setup complete."
echo "Admin email: ${ADMIN_EMAIL}"
echo "Admin password: ${ADMIN_PASS}"
echo "Start the app with: php -S localhost:8000"
echo "Then open: http://localhost:8000"
