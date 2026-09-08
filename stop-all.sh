#!/usr/bin/env bash
# =============================================================================
# SOUKHYA TECH — UNIFIED STOP SCRIPT
# Stops all running Node.js and Java Spring Boot services
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$SCRIPT_DIR/.env"
    set +a
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NODE_PORT=${NODE_PORT:-${PORT:-3000}}
JAVA_PORT=${JAVA_PORT:-3001}
PIDS_FILE=".soukhya-pids"

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }

kill_port() {
    local port=$1
    local pname=$2
    local pids=""
    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti :"$port" 2>/dev/null || true)
    elif command -v fuser >/dev/null 2>&1; then
        pids=$(fuser "$port"/tcp 2>/dev/null || true)
    elif command -v ss >/dev/null 2>&1; then
        pids=$(ss -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2 | xargs || true)
    fi

    if [ -n "$pids" ]; then
        log_info "Stopping $pname on port $port (PID(s): $pids)"
        kill -9 $pids 2>/dev/null || true
        sleep 0.5
    else
        log_info "No active process listening on port $port ($pname)"
    fi
}

log_info "Stopping all Soukhya Tech background services..."

if [ -f "$SCRIPT_DIR/$PIDS_FILE" ]; then
    while read -r pid name; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
            log_info "Terminated tracked process $name (PID: $pid)"
        fi
    done < "$SCRIPT_DIR/$PIDS_FILE"
    rm -f "$SCRIPT_DIR/$PIDS_FILE"
fi

kill_port "$NODE_PORT" "Node.js"
kill_port "$JAVA_PORT" "Java Spring Boot"

log_ok "All Soukhya Tech services stopped."
