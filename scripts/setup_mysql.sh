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

# Option 1: Try Docker if running
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "[INFO] Docker detected. Starting MySQL 8.4 LTS container..."
  cd "${ROOT_DIR}"
  docker compose up -d mysql || docker-compose up -d mysql
  echo "[INFO] Waiting for MySQL 8.4 LTS container to be healthy..."
  for i in {1..30}; do
    if docker exec soukhya-mysql-lts mysqladmin ping -u root -psoukhya_root_password_2026 --silent >/dev/null 2>&1; then
      echo "[OK] MySQL 8.4 LTS is up and healthy in Docker!"
      exit 0
    fi
    sleep 1
  done
  echo "[WARN] Docker container did not become ready within 30s. Falling back to native daemon..."
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

# Check if already running on port
if nc -z 127.0.0.1 "${PORT}" 2>/dev/null; then
  echo "[OK] MySQL / MariaDB is already running on port ${PORT}."
else
  echo "[INFO] Starting local database server on port ${PORT}..."
  (mariadbd --datadir="${DATA_DIR}" --port="${PORT}" --socket="${DATA_DIR}/mysql.sock" --pid-file="${DATA_DIR}/mysql.pid" --bind-address=127.0.0.1 2>/dev/null || mysqld --datadir="${DATA_DIR}" --port="${PORT}" --socket="${DATA_DIR}/mysql.sock" --pid-file="${DATA_DIR}/mysql.pid" --bind-address=127.0.0.1 2>/dev/null) &
  sleep 2
fi

# Initialize database schema
echo "[INFO] Applying MySQL 8.4 schema..."
mysql --port="${PORT}" --socket="${DATA_DIR}/mysql.sock" -u root -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;" 2>/dev/null || true
mysql --port="${PORT}" --socket="${DATA_DIR}/mysql.sock" -u root "${DB_NAME}" < "${ROOT_DIR}/database/schema_mysql.sql" 2>/dev/null || true

echo "[OK] Database setup complete and ready for Soukhya Tech HR Enterprise!"
