#!/usr/bin/env bash
# =============================================================================
# SOUKHYA TECH — COMPREHENSIVE ENDPOINT TEST SUITE
# Verifies Node.js & Java Spring Boot APIs for HR-Enterprise-Dev-V2
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/.env"
  set +a
fi

NODE_PORT=${NODE_PORT:-${PORT:-3000}}
JAVA_PORT=${JAVA_PORT:-3001}
TARGET=${1:-all}

ADMIN_USER=${ADMIN_USER:-${ADMIN_USERNAME:-admin}}
ADMIN_PASS=${ADMIN_PASS:-${ADMIN_PASSWORD:-admin123}}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED_TESTS=0
FAILED_TESTS=0

function log_info()  { echo -e "${CYAN}[INFO]${NC}  $1" >&2; }
function log_ok()    { echo -e "${GREEN}[OK]${NC}    $1" >&2; PASSED_TESTS=$((PASSED_TESTS + 1)); }
function log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1" >&2; }
function log_fail()  { echo -e "${RED}[FAIL]${NC}  $1" >&2; FAILED_TESTS=$((FAILED_TESTS + 1)); exit 1; }

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

function assert_status() {
  local actual=$1
  local expected=$2
  local description=$3
  if [ "$actual" != "$expected" ]; then
    log_fail "$description returned HTTP $actual (expected $expected)"
  fi
  log_ok "$description returned HTTP $actual"
}

function assert_service_ready() {
  local port=$1
  local name=$2
  local url="http://127.0.0.1:$port/"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)
  if [ "$code" = "000" ] || [ -z "$code" ]; then
    log_fail "$name did not respond on port $port"
  fi
  log_ok "$name is reachable on port $port (HTTP $code)"
}

function get_auth_tokens() {
  local port=$1
  local name=$2
  local url="http://127.0.0.1:$port/api/auth/login"
  log_info "Authenticating against $name at $url"

  local response
  response=$(curl -sS -w '\n%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" "$url")

  local code
  code=$(printf '%s\n' "$response" | tail -n1)
  local body
  body=$(printf '%s\n' "$response" | sed '$d')

  if [ "$code" != "200" ]; then
    log_fail "$name authentication failed with HTTP $code"
  fi

  local access_token
  access_token=$(printf '%s' "$body" | "$PYTHON" -c 'import json,sys; d=json.load(sys.stdin); print(d.get("access_token",""))')
  local refresh_token
  refresh_token=$(printf '%s' "$body" | "$PYTHON" -c 'import json,sys; d=json.load(sys.stdin); print(d.get("refresh_token",""))')

  if [ -z "$access_token" ]; then
    log_fail "$name login succeeded but access_token was missing in payload"
  fi

  log_ok "$name login successful (Access token acquired)"
  printf '%s\n%s' "$access_token" "$refresh_token"
}

function test_auth_refresh() {
  local port=$1
  local name=$2
  local refresh_token=$3
  local url="http://127.0.0.1:$port/api/auth/refresh"

  log_info "Testing token refresh on $name"
  local response
  response=$(curl -sS -w '\n%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"refresh_token\":\"$refresh_token\"}" "$url")

  local code
  code=$(printf '%s\n' "$response" | tail -n1)
  assert_status "$code" "200" "$name token refresh"
}

function test_auth_invalid() {
  local port=$1
  local name=$2
  local url="http://127.0.0.1:$port/api/auth/login"

  log_info "Testing invalid login rejection on $name"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"wrong-password-xyz"}' "$url")

  assert_status "$code" "401" "$name invalid login rejection"
}

function assert_api_get() {
  local port=$1
  local path=$2
  local token=$3
  local name=$4
  local url="http://127.0.0.1:$port$path"

  log_info "Testing $name $path"
  local response
  response=$(curl -sS -w '\n%{http_code}' \
    -H 'Accept: application/json' \
    -H "Authorization: Bearer $token" "$url" || true)

  local code
  code=$(printf '%s\n' "$response" | tail -n1)
  if [ "$code" != "200" ]; then
    log_fail "$name $path returned HTTP $code"
  fi
  log_ok "$name $path returned HTTP $code"
}

function run_service_tests() {
  local port=$1
  local name=$2

  echo ""
  log_info "══════════════════════════════════════════"
  log_info " Running Tests for: $name (Port $port)"
  log_info "══════════════════════════════════════════"

  assert_service_ready "$port" "$name"

  # Auth tests
  local tokens
  tokens=$(get_auth_tokens "$port" "$name")
  local access_token
  access_token=$(echo "$tokens" | head -n1)
  local refresh_token
  refresh_token=$(echo "$tokens" | tail -n1)

  if [ -n "$refresh_token" ]; then
    test_auth_refresh "$port" "$name" "$refresh_token"
  fi

  test_auth_invalid "$port" "$name"

  # Data & Metrics APIs
  assert_api_get "$port" "/api/employees" "$access_token" "$name"
  assert_api_get "$port" "/api/attendance" "$access_token" "$name"
  assert_api_get "$port" "/api/stats" "$access_token" "$name"

  # Java-specific checks
  if [ "$name" = "Java Spring Boot" ]; then
    log_info "Testing Actuator health on $name"
    local act_code
    act_code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/actuator/health" || true)
    assert_status "$act_code" "200" "$name Actuator health"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Execution
# ─────────────────────────────────────────────────────────────────────────────

log_info "Starting Soukhya Tech test suite for target: $TARGET"

case "$TARGET" in
  node)
    run_service_tests "$NODE_PORT" "Node.js"
    ;;
  java)
    run_service_tests "$JAVA_PORT" "Java Spring Boot"
    ;;
  all|*)
    run_service_tests "$NODE_PORT" "Node.js"
    run_service_tests "$JAVA_PORT" "Java Spring Boot"
    ;;
esac

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   ALL ENDPOINT TESTS PASSED ($PASSED_TESTS passed)    ${NC}"
echo -e "${GREEN}============================================${NC}"

