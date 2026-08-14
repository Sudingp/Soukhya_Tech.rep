#!/bin/bash

# Use user-installed .NET 8 SDK
export DOTNET_ROOT="$HOME/.dotnet"
export PATH="$DOTNET_ROOT:$PATH"
# =============================================================================
# SOUKHYA TECH ‚Äî UNIFIED START SCRIPT
# Auto-detects | Auto-installs | Auto-launches all 3 backends
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Ports
NODE_PORT=3000
JAVA_PORT=3001
DOTNET_PORT=3002

# PIDs file
PIDS_FILE=".soukhya-pids"
NODE_STARTED=false
JAVA_STARTED=false
DOTNET_STARTED=false

# Safe integration mode: do not kill the primary app blindly.
# If a service is already listening on its expected port, skip starting it.

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# Helper Functions
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

print_header() {
    echo ""
    echo -e "${CYAN}‚ïî‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïó${NC}"
    echo -e "${CYAN}‚ïë   SOUKHYA TECH  ‚Äî  Secure Backend Launcher   ‚ïë${NC}"
    echo -e "${CYAN}‚ïö‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïù${NC}"
    echo ""
}

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

kill_port() {
    local port=$1
    local pname=$2
    local pids=$(lsof -ti :$port 2>/dev/null || ss -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2 | xargs)
    if [ -n "$pids" ]; then
        log_warn "Killing existing $pname on port $port (PIDs: $pids)"
        kill -9 $pids 2>/dev/null || true
        sleep 0.5
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=${3:-30}
    local waited=0
    while ! nc -z localhost $port 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
        if [ $waited -ge $max_wait ]; then
            log_error "$name failed to start on port $port within ${max_wait}s"
            return 1
        fi
    done
    log_ok "$name is live on port $port (${waited}s)"
}

service_healthy() {
    local port=$1
    local name=$2
    local username="admin"
    local password="admin123"

    if [ -f "$SCRIPT_DIR/.env" ]; then
        # shellcheck disable=SC1091
        set -a
        . "$SCRIPT_DIR/.env"
        set +a
        if [ -n "${ADMIN_USERNAME:-}" ]; then
            username="$ADMIN_USERNAME"
        fi
        if [ -n "${ADMIN_PASSWORD:-}" ]; then
            password="$ADMIN_PASSWORD"
        fi
    fi

    local payload
    payload=$(printf '{"username":"%s","password":"%s"}' "$username" "$password")
    local code
    code=$(curl -sS -o /tmp/${name//[^A-Za-z0-9]/_}.health.$$ -w '%{http_code}' \
        -X POST "http://localhost:${port}/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d "$payload" || true)
    if [ "$code" = "200" ]; then
        return 0
    fi

    if [ "$password" != "admin123" ] && [ "$username" = "admin" ]; then
        code=$(curl -sS -o /tmp/${name//[^A-Za-z0-9]/_}.health.legacy.$$ -w '%{http_code}' \
            -X POST "http://localhost:${port}/api/auth/login" \
            -H 'Content-Type: application/json' \
            -d '{"username":"admin","password":"admin123"}' || true)
        [ "$code" = "200" ] && return 0
    fi
    return 1
}

cleanup() {
    local exit_code=${1:-0}
    echo ""
    log_warn "Shutting down all backends..."
    if [ -f "$PIDS_FILE" ]; then
        while read -r pid name; do
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
                log_info "Stopped $name (PID: $pid)"
            fi
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi
    log_ok "All backends stopped."
    exit "$exit_code"
}

trap 'cleanup 0' SIGINT SIGTERM EXIT

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# Detect Project Layout
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

print_header

NODE_DIR=""
JAVA_DIR=""
DOTNET_DIR=""

# Try common directory names
for d in "node-backend" "soukhya-tech" "backend-node" "node"; do
    [ -f "$d/server.js" ] && NODE_DIR="$d" && break
done

for d in "java-backend" "backend-java" "java" "faceattendance"; do
    [ -f "$d/pom.xml" ] && JAVA_DIR="$d" && break
done

for d in "dotnet-backend" "backend-dotnet" "dotnet" "SoukhyaTech.FaceAttendance"; do
    [ -f "$d/SoukhyaTech.FaceAttendance.csproj" ] && DOTNET_DIR="$d" && break
done

# If not found, try current directory
[ -z "$NODE_DIR" ] && [ -f "server.js" ] && NODE_DIR="."
[ -z "$JAVA_DIR" ] && [ -f "pom.xml" ] && JAVA_DIR="."
[ -z "$DOTNET_DIR" ] && [ -f "SoukhyaTech.FaceAttendance.csproj" ] && DOTNET_DIR="."

# Fallback to recursive project discovery for nested layouts
if [ -z "$NODE_DIR" ]; then
    found=$(find . -maxdepth 3 -name 'server.js' | head -n 1 || true)
    [ -n "$found" ] && NODE_DIR="$(dirname "$found")"
fi
if [ -z "$JAVA_DIR" ]; then
    found=$(find . -maxdepth 3 -name 'pom.xml' | head -n 1 || true)
    [ -n "$found" ] && JAVA_DIR="$(dirname "$found")"
fi
if [ -z "$DOTNET_DIR" ]; then
    found=$(find . -maxdepth 4 -name '*.csproj' | head -n 1 || true)
    [ -n "$found" ] && DOTNET_DIR="$(dirname "$found")"
fi

log_info "Detected layout:"
[ -n "$NODE_DIR" ]   && echo "  Node.js  ‚Üí $NODE_DIR/"
[ -n "$JAVA_DIR" ]   && echo "  Java     ‚Üí $JAVA_DIR/"
[ -n "$DOTNET_DIR" ] && echo "  .NET     ‚Üí $DOTNET_DIR/"

if [ -z "$NODE_DIR" ] && [ -z "$JAVA_DIR" ] && [ -z "$DOTNET_DIR" ]; then
    log_error "No backend projects found in current directory."
    log_info "Expected: node-backend/server.js, java-backend/pom.xml, or dotnet-backend/*.csproj"
    exit 1
fi

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# Kill Existing
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

log_info "Checking for existing processes before startup..."
# Keep the main app alive only when it is actually healthy.
if service_healthy "$NODE_PORT" "node"; then
    log_warn "Node.js already responding correctly on port $NODE_PORT; skipping forced restart."
    NODE_STARTED=true
else
    log_warn "Node.js health check failed on port $NODE_PORT; checking for stale process."
    kill_port $NODE_PORT "Node.js"
fi

# Allow explicit cleanup only for secondary services.
if [ "${FORCE_CLEANUP:-false}" = "true" ]; then
    kill_port $JAVA_PORT   "Java"
    kill_port $DOTNET_PORT ".NET"
fi
rm -f "$PIDS_FILE"
if [ "$NODE_STARTED" = true ]; then
    echo "$NODE_PID node" >> "$SCRIPT_DIR/$PIDS_FILE"
fi

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# NODE.JS
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

if [ -n "$NODE_DIR" ]; then
    echo ""
    log_info "‚ïê‚ïê‚ïê Node.js Backend ‚ïê‚ïê‚ïê"

    if ! command -v node &> /dev/null; then
        log_error "Node.js not installed. Skipping."
    else
        cd "$NODE_DIR"

        if [ ! -d "node_modules" ]; then
            log_info "node_modules missing. Running npm install..."
            npm install --silent
        fi

        if [ ! -f "database/db.js" ]; then
            log_warn "database/db.js not found. Node backend may fail."
        fi
        if [ ! -f "server.js" ]; then
            log_warn "server.js not found. Node backend may fail."
        fi

        if service_healthy "$NODE_PORT" "node"; then
            log_warn "Node.js already responding correctly on port $NODE_PORT; skipping startup."
            NODE_STARTED=true
        else
            log_warn "Node.js health check failed; restarting service on port $NODE_PORT..."
            kill_port $NODE_PORT "Node.js"
            log_info "Starting Node.js on port $NODE_PORT..."
            node server.js > "$SCRIPT_DIR/.soukhya-node.log" 2>&1 &
            NODE_PID=$!
            echo "$NODE_PID node" >> "$SCRIPT_DIR/$PIDS_FILE"
            cd "$SCRIPT_DIR"
            if wait_for_port $NODE_PORT "Node.js" 15 && service_healthy "$NODE_PORT" "node"; then
                NODE_STARTED=true
            else
                log_error "Node.js did not become healthy on port $NODE_PORT."
            fi
        fi
    fi
fi

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# JAVA
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

if [ -n "$JAVA_DIR" ]; then
    echo ""
    log_info "‚ïê‚ïê‚ïê Java Spring Boot Backend ‚ïê‚ïê‚ïê"

    if ! command -v mvn &> /dev/null; then
        log_error "Maven not installed. Skipping."
    else
        cd "$JAVA_DIR"

        if service_healthy "$JAVA_PORT" "java"; then
            log_warn "Java already responding correctly on port $JAVA_PORT; skipping startup."
            JAVA_STARTED=true
        else
            log_warn "Java health check failed; restarting service on port $JAVA_PORT..."
            kill_port $JAVA_PORT "Java"
            if [ ! -d "target" ] || [ ! -f "target/classes/com/soukhyatech/faceattendance/FaceAttendanceApplication.class" ]; then
                log_info "Target not built. Running mvn clean install..."
                mvn clean install -q -DskipTests
            fi

            log_info "Starting Java on port $JAVA_PORT..."
            mvn spring-boot:run -q -Dspring-boot.run.jvmArguments="-Dserver.port=$JAVA_PORT" > "$SCRIPT_DIR/.soukhya-java.log" 2>&1 &
            JAVA_PID=$!
            echo "$JAVA_PID java" >> "$SCRIPT_DIR/$PIDS_FILE"
            cd "$SCRIPT_DIR"

            if wait_for_port $JAVA_PORT "Java" 60 && service_healthy "$JAVA_PORT" "java"; then
                JAVA_STARTED=true
            else
                log_error "Java did not become healthy on port $JAVA_PORT."
            fi
        fi
    fi
fi

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# .NET
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

if [ -n "$DOTNET_DIR" ]; then
    echo ""
    log_info "‚ïê‚ïê‚ïê .NET 8 Backend ‚ïê‚ïê‚ïê"

    if ! command -v "$HOME/.dotnet/dotnet" &> /dev/null; then
        log_warn ".NET SDK not installed. Skipping .NET backend."
    else
        export DOTNET_ROOT="$HOME/.dotnet"
        export PATH="$DOTNET_ROOT:$PATH"
        cd "$DOTNET_DIR"
        DOTNET_READY=true

        if service_healthy "$DOTNET_PORT" "dotnet"; then
            log_warn ".NET already responding correctly on port $DOTNET_PORT; skipping startup."
            DOTNET_STARTED=true
        else
            log_warn ".NET health check failed; restarting service on port $DOTNET_PORT..."
            kill_port $DOTNET_PORT ".NET"
            log_info "Restoring .NET dependencies..."
            if ! "$HOME/.dotnet/dotnet" restore --verbosity minimal; then
                log_warn "dotnet restore failed. Skipping .NET backend."
                DOTNET_READY=false
            fi

            if [ "$DOTNET_READY" = true ]; then
                log_info "Building .NET project..."
                if ! "$HOME/.dotnet/dotnet" build --configuration Release --no-restore --verbosity minimal; then
                    log_warn "dotnet build failed. Skipping .NET backend."
                    DOTNET_READY=false
                fi
            fi

            if [ "$DOTNET_READY" = true ]; then
                log_info "Starting .NET on port $DOTNET_PORT..."
                "$HOME/.dotnet/dotnet" run --urls "http://localhost:$DOTNET_PORT" --verbosity quiet > "$SCRIPT_DIR/.soukhya-dotnet.log" 2>&1 &
                DOTNET_PID=$!
                echo "$DOTNET_PID dotnet" >> "$SCRIPT_DIR/$PIDS_FILE"
                cd "$SCRIPT_DIR"
                if wait_for_port $DOTNET_PORT ".NET" 30 && service_healthy "$DOTNET_PORT" "dotnet"; then
                    DOTNET_STARTED=true
                else
                    log_warn ".NET backend did not become healthy in time. See $SCRIPT_DIR/.soukhya-dotnet.log for details."
                    DOTNET_READY=false
                fi
            fi
        fi

        if [ "$DOTNET_READY" != true ]; then
            log_warn "Skipping .NET backend due to startup issues."
            cd "$SCRIPT_DIR"
        fi
    fi
fi

# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ
# Summary
# ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ‚îÄ

echo ""
echo -e "${GREEN}‚ïî‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïó${NC}"
echo -e "${GREEN}‚ïë   BACKEND LAUNCH COMPLETE                        ‚ïë${NC}"
echo -e "${GREEN}‚ïö‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïê‚ïù${NC}"
echo ""
[ "$NODE_STARTED" = true ]   && echo -e "  ${CYAN}Node.js${NC}  http://localhost:$NODE_PORT   (admin / admin123)"
[ "$JAVA_STARTED" = true ]   && echo -e "  ${CYAN}Java${NC}     http://localhost:$JAVA_PORT   (admin / admin123)"
[ "$DOTNET_STARTED" = true ] && echo -e "  ${CYAN}.NET${NC}      http://localhost:$DOTNET_PORT (admin / admin123)"
[ "$NODE_STARTED" = false ] && log_warn "Node.js backend did not start."
[ "$JAVA_STARTED" = false ] && log_warn "Java backend did not start."
[ "$DOTNET_STARTED" = false ] && [ -n "$DOTNET_DIR" ] && log_warn ".NET backend did not start."
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all running backends${NC}"
echo ""

if [ -x "$SCRIPT_DIR/test.sh" ]; then
    log_info "Running post-launch endpoint verification..."
    if ! bash "$SCRIPT_DIR/test.sh"; then
        log_error "Endpoint verification failed. Shutting down all backends."
        cleanup 1
    fi
    log_ok "Endpoint verification completed successfully."
else
    log_warn "test.sh not found or not executable; skipping endpoint verification."
fi

# Keep script alive to catch Ctrl+C
while true; do
    sleep 5
    # Health check: if all processes died, exit
    all_dead=true
    if [ -f "$PIDS_FILE" ]; then
        while read -r pid name; do
            if kill -0 "$pid" 2>/dev/null; then
                all_dead=false
                break
            fi
        done < "$PIDS_FILE"
    fi

    if $all_dead && [ -s "$PIDS_FILE" ]; then
        log_warn "All backends have exited."
        exit 1
    fi
done

