#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PORT=${NODE_PORT:-3000}
JAVA_PORT=${JAVA_PORT:-3001}
DOTNET_PORT=${DOTNET_PORT:-3002}

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/.env"
  set +a
fi

ADMIN_USER=${ADMIN_USER:-${ADMIN_USERNAME:-admin}}
ADMIN_PASS=${ADMIN_PASS:-${ADMIN_PASSWORD:-admin123}}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

function log_info() { echo -e "${GREEN}[INFO]${NC}  $1" >&2; }
function log_ok() { echo -e "${GREEN}[OK]${NC}    $1" >&2; }
function log_warn() { echo -e "${YELLOW}[WARN]${NC}  $1" >&2; }
function log_fail() { echo -e "${RED}[FAIL]${NC}  $1" >&2; exit 1; }

function require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_fail "Required command '$1' is not installed."
  fi
}

require_cmd curl
PYTHON=python3
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  PYTHON=python
fi
require_cmd "$PYTHON"

function curl_json() {
  local method=$1
  local url=$2
  local token=${3:-}
  local payload=${4:-}

  local headers=(-H 'Accept: application/json')
  [ -n "$token" ] && headers+=( -H "Authorization: Bearer $token" )
  if [ -n "$payload" ]; then
    headers+=( -H 'Content-Type: application/json' -d "$payload" )
  fi

  local response
  response=$(curl -sS -w '\n%{http_code}' -X "$method" "${headers[@]}" "$url")
  local body
  body=$(printf '%s\n' "$response" | sed '$d')
  local code
  code=$(printf '%s\n' "$response" | tail -n1)

  printf '%s\n' "$code"
  printf '%s\n' "$body"
}

function assert_ok() {
  local code=$1
  local description=$2
  if [ "$code" != "200" ] && [ "$code" != "201" ]; then
    log_fail "$description returned HTTP $code"
  fi
  log_ok "$description returned HTTP $code"
}

function get_token() {
  local port=$1
  local name=$2
  local url="http://localhost:$port/api/auth/login"
  log_info "Authenticating against $name at $url"
  local response
  response=$(curl -sS -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' \
    -d '{"username":"'$ADMIN_USER'","password":"'$ADMIN_PASS'"}' "$url")
  local code
  code=$(printf '%s\n' "$response" | tail -n1)
  local body
  body=$(printf '%s\n' "$response" | sed '$d')
  assert_ok "$code" "$name auth login"

  local token
  token=$(printf '%s' "$body" | "$PYTHON" -c 'import json,sys; d=json.load(sys.stdin); print(d.get("access_token",""))')
  if [ -z "$token" ]; then
    log_fail "$name auth login succeeded but access_token was missing"
  fi

  log_ok "$name authentication succeeded"
  printf '%s' "$token"
}

function assert_service_ready() {
  local port=$1
  local name=$2
  local url="http://localhost:$port/"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)
  if [ "$code" = "000" ]; then
    log_fail "$name did not respond on port $port"
  fi
  log_ok "$name responded on port $port"
}

function assert_api() {
  local port=$1
  local path=$2
  local token=$3
  local name=$4
  local url="http://localhost:$port$path"
  log_info "Checking $name $path"
  response=$(curl -sS -w '\n%{http_code}' -H 'Accept: application/json' -H "Authorization: Bearer $token" "$url" || true)
  local code
  code=$(printf '%s\n' "$response" | tail -n1)
  assert_ok "$code" "$name $path"
}

function run_service_tests() {
  local port=$1
  local name=$2
  assert_service_ready "$port" "$name"
  local token
  token=$(get_token "$port" "$name")

  assert_api "$port" "/api/employees" "$token" "$name"
  assert_api "$port" "/api/attendance" "$token" "$name"
  assert_api "$port" "/api/stats" "$token" "$name"
}

log_info "Starting endpoint validation for running backends"

# Node.js frontend and API tests
assert_service_ready "$NODE_PORT" "Node.js frontend"
run_service_tests "$NODE_PORT" "Node.js backend"

# Java backend API tests
run_service_tests "$JAVA_PORT" "Java backend"

log_ok "All configured backend verification tests passed."
