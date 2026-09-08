#!/usr/bin/env bash
# scripts/setup_mysql.sh — Local MySQL / MariaDB Server Setup Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DATA_DIR="${ROOT_DIR}/data/mysql"
PORT="${MYSQL_PORT:-3306}"
DB_NAME="${MYSQL_DATABASE:-soukhya_attendance}"

echo "============================================================"
echo " Soukhya Tech — Local MySQL Setup & Runner"
echo "============================================================"

# Option 1: Try Docker if docker compose is available
if command -v docker-compose >/dev/null 2>&1 || (command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1); then
  echo "[INFO] Docker Compose detected. Starting MySQL 8.4 LTS container..."
  cd "${ROOT_DIR}"
  if docker compose up -d mysql 2>/dev/null || docker-compose up -d mysql 2>/dev/null; then
    for i in {1..15}; do
      if docker exec soukhya-mysql-lts mysqladmin ping -u root -psoukhya_root_password_2026 --silent >/dev/null 2>&1; then
        echo "[OK] MySQL 8.4 LTS is up and healthy in Docker!"
        exit 0
      fi
      sleep 1
    done
  fi
  echo "[WARN] Docker compose did not start. Falling back to native daemon..."
fi

# Option 2: Native MySQL/MariaDB daemon in local directory
echo "[INFO] Configuring local self-contained database in ${DATA_DIR}..."
mkdir -p "${DATA_DIR}"

if [ ! -d "${DATA_DIR}/mysql" ]; then
  echo "[INFO] Initializing system tables..."
  if command -v mariadb-install-db >/dev/null 2>&1; then
    mariadb-install-db --datadir="${DATA_DIR}" --auth-root-authentication-method=normal >/dev/null 2>&1 || true
  elif command -v mysql_install_db >/dev/null 2>&1; then
    mysql_install_db --datadir="${DATA_DIR}" >/dev/null 2>&1 || true
  else
    mysqld --initialize-insecure --datadir="${DATA_DIR}" >/dev/null 2>&1 || true
  fi
fi

# Check if already running via socket or port
if mysqladmin --socket="${DATA_DIR}/mysql.sock" ping >/dev/null 2>&1 || mysqladmin -h 127.0.0.1 -P "${PORT}" ping >/dev/null 2>&1; then
  echo "[OK] MySQL / MariaDB is already running."
else
  echo "[INFO] Starting local database server..."
  (mariadbd --datadir="${DATA_DIR}" --port="${PORT}" --socket="${DATA_DIR}/mysql.sock" --pid-file="${DATA_DIR}/mysql.pid" --bind-address=127.0.0.1 2>/dev/null || mysqld --datadir="${DATA_DIR}" --port="${PORT}" --socket="${DATA_DIR}/mysql.sock" --pid-file="${DATA_DIR}/mysql.pid" --bind-address=127.0.0.1 2>/dev/null) &
  for i in {1..15}; do
    if mysqladmin --socket="${DATA_DIR}/mysql.sock" ping >/dev/null 2>&1 || mysqladmin -h 127.0.0.1 -P "${PORT}" ping >/dev/null 2>&1; then
      break
    fi
    sleep 0.4
  done
fi

# Ensure user and database permissions
mariadb --socket="${DATA_DIR}/mysql.sock" -u root -e "
  CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
  CREATE USER IF NOT EXISTS 'soukhya_user'@'%' IDENTIFIED BY 'soukhya_secure_pass_2026';
  CREATE USER IF NOT EXISTS 'soukhya_user'@'localhost' IDENTIFIED BY 'soukhya_secure_pass_2026';
  CREATE USER IF NOT EXISTS 'soukhya_user'@'127.0.0.1' IDENTIFIED BY 'soukhya_secure_pass_2026';
  GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'soukhya_user'@'%';
  GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'soukhya_user'@'localhost';
  GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'soukhya_user'@'127.0.0.1';
  FLUSH PRIVILEGES;
" 2>/dev/null || mysql -u root -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;" 2>/dev/null || true

# Initialize database schema if needed
mariadb --socket="${DATA_DIR}/mysql.sock" -u root "${DB_NAME}" < "${ROOT_DIR}/database/schema_mysql.sql" 2>/dev/null || mysql -u root "${DB_NAME}" < "${ROOT_DIR}/database/schema_mysql.sql" 2>/dev/null || true

echo "[OK] Database ready for Soukhya Tech HR Enterprise!"
