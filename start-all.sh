#!/usr/bin/env bash

# =============================================================================
# SOUKHYA TECH — UNIFIED START SCRIPT
# Auto-detects | Auto-builds | Auto-launches Node.js and Java backends
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment configuration if available
if [ -f "$SCRIPT_DIR/.env" ]; then
    # shellcheck disable=SC1091
    set -a
    . "$SCRIPT_DIR/.env"
    set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Ports
NODE_PORT=${NODE_PORT:-${PORT:-3000}}
JAVA_PORT=${JAVA_PORT:-3001}

# Admin Credentials
ADMIN_USER=${ADMIN_USER:-${ADMIN_USERNAME:-admin}}
ADMIN_PASS=${ADMIN_PASS:-${ADMIN_PASSWORD:-admin123}}

# PIDs tracking
PIDS_FILE=".soukhya-pids"
NODE_STARTED=false
JAVA_STARTED=false
NODE_PID=""
JAVA_PID=""

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         SOUKHYA TECH  —  Backend Launcher (V2)             ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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
        log_warn "Stopping existing $pname on port $port (PID(s): $pids)"
        kill -9 $pids 2>/dev/null || true
        sleep 0.5
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=${3:-30}
    local waited=0
    while ! (nc -z localhost "$port" 2>/dev/null || (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null || curl -sS -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null); do
        sleep 1
        waited=$((waited + 1))
        if [ "$waited" -ge "$max_wait" ]; then
            log_error "$name failed to start on port $port within ${max_wait}s"
            return 1
        fi
    done
    log_ok "$name is live on port $port (${waited}s)"
}

service_healthy() {
    local port=$1
    local payload
    payload=$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USER" "$ADMIN_PASS")
    local code
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
        -X POST "http://localhost:${port}/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d "$payload" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
        return 0
    fi

    if [ "$ADMIN_PASS" != "admin123" ] || [ "$ADMIN_USER" != "admin" ]; then
        code=$(curl -sS -o /dev/null -w '%{http_code}' \
            -X POST "http://localhost:${port}/api/auth/login" \
            -H 'Content-Type: application/json' \
            -d '{"username":"admin","password":"admin123"}' 2>/dev/null || echo "000")
        [ "$code" = "200" ] && return 0
    fi
    return 1
}

cleanup() {
    local exit_code=${1:-0}
    echo ""
    log_warn "Shutting down managed backends..."
    if [ -f "$SCRIPT_DIR/$PIDS_FILE" ]; then
        while read -r pid name; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
                log_info "Stopped $name (PID: $pid)"
            fi
        done < "$SCRIPT_DIR/$PIDS_FILE"
        rm -f "$SCRIPT_DIR/$PIDS_FILE"
    fi

    # Ensure ports are freed
    [ "$NODE_STARTED" = true ] && kill_port "$NODE_PORT" "Node.js"
    [ "$JAVA_STARTED" = true ] && kill_port "$JAVA_PORT" "Java"

    log_ok "All backends stopped."
    exit "$exit_code"
}

trap 'cleanup 0' SIGINT SIGTERM EXIT

# ─────────────────────────────────────────────────────────────────────────────
# Detect Project Layout
# ─────────────────────────────────────────────────────────────────────────────

print_header

NODE_DIR=""
JAVA_DIR=""

# Try common directory names
for d in "node-backend" "soukhya-tech" "backend-node" "node"; do
    [ -f "$d/server.js" ] && NODE_DIR="$d" && break
done

for d in "java-backend" "backend-java" "java" "faceattendance"; do
    [ -f "$d/pom.xml" ] && JAVA_DIR="$d" && break
done

# If not found, try current directory
[ -z "$NODE_DIR" ] && [ -f "server.js" ] && NODE_DIR="."
[ -z "$JAVA_DIR" ] && [ -f "pom.xml" ] && JAVA_DIR="."

# Fallback to recursive project discovery for nested layouts
if [ -z "$NODE_DIR" ]; then
    found=$(find . -maxdepth 3 -name 'server.js' | head -n 1 || true)
    [ -n "$found" ] && NODE_DIR="$(dirname "$found")"
fi
if [ -z "$JAVA_DIR" ]; then
    found=$(find . -maxdepth 3 -name 'pom.xml' | head -n 1 || true)
    [ -n "$found" ] && JAVA_DIR="$(dirname "$found")"
fi

log_info "Detected layout:"
[ -n "$NODE_DIR" ] && echo -e "  ${CYAN}Node.js${NC}  → $NODE_DIR/ (Port: $NODE_PORT)"
[ -n "$JAVA_DIR" ] && echo -e "  ${CYAN}Java${NC}     → $JAVA_DIR/ (Port: $JAVA_PORT)"

if [ -z "$NODE_DIR" ] && [ -z "$JAVA_DIR" ]; then
    log_error "No backend projects found in current directory."
    log_info "Expected: server.js or pom.xml"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Port Pre-Checks
# ─────────────────────────────────────────────────────────────────────────────

log_info "Checking ports before startup..."
rm -f "$SCRIPT_DIR/$PIDS_FILE"

if service_healthy "$NODE_PORT"; then
    log_warn "Node.js already responding correctly on port $NODE_PORT; reusing running instance."
    NODE_STARTED=true
else
    kill_port "$NODE_PORT" "Node.js"
fi

if service_healthy "$JAVA_PORT"; then
    log_warn "Java already responding correctly on port $JAVA_PORT; reusing running instance."
    JAVA_STARTED=true
else
    kill_port "$JAVA_PORT" "Java"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Node.js Backend Startup
# ─────────────────────────────────────────────────────────────────────────────

if [ -n "$NODE_DIR" ] && [ "$NODE_STARTED" = false ]; then
    echo ""
    log_info "═══ Node.js Backend ═══"

    if ! command -v node &> /dev/null; then
        log_error "Node.js not installed. Skipping Node backend."
    else
        cd "$NODE_DIR"

        if [ ! -d "node_modules" ]; then
            log_info "node_modules missing. Running npm install..."
            npm install --silent
        fi

        log_info "Starting Node.js on port $NODE_PORT..."
        PORT="$NODE_PORT" node server.js > "$SCRIPT_DIR/.soukhya-node.log" 2>&1 &
        NODE_PID=$!
        echo "$NODE_PID node" >> "$SCRIPT_DIR/$PIDS_FILE"
        cd "$SCRIPT_DIR"

        if wait_for_port "$NODE_PORT" "Node.js" 15 && service_healthy "$NODE_PORT"; then
            NODE_STARTED=true
            log_ok "Node.js backend started successfully (PID: $NODE_PID)."
        else
            log_error "Node.js did not become healthy on port $NODE_PORT. Check $SCRIPT_DIR/.soukhya-node.log"
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Java Spring Boot Backend Startup
# ─────────────────────────────────────────────────────────────────────────────

if [ -n "$JAVA_DIR" ] && [ "$JAVA_STARTED" = false ]; then
    echo ""
    log_info "═══ Java Spring Boot Backend ═══"

    if ! command -v java &> /dev/null || ! command -v mvn &> /dev/null; then
        log_error "Java or Maven not found. Skipping Java backend."
    else
        cd "$JAVA_DIR"

        JAR_FILE=$(find target -name 'faceattendance-*.jar' ! -name '*.original' 2>/dev/null | head -n 1 || true)
        if [ -z "$JAR_FILE" ] || [ ! -f "$JAR_FILE" ]; then
            log_info "Java package missing. Building faceattendance jar (mvn clean package -DskipTests)..."
            mvn clean package -q -DskipTests
            JAR_FILE=$(find target -name 'faceattendance-*.jar' ! -name '*.original' 2>/dev/null | head -n 1 || true)
        fi

        log_info "Starting Java backend on port $JAVA_PORT..."
        if [ -n "$JAR_FILE" ] && [ -f "$JAR_FILE" ]; then
            java -jar "$JAR_FILE" --server.port="$JAVA_PORT" > "$SCRIPT_DIR/.soukhya-java.log" 2>&1 &
            JAVA_PID=$!
        else
            log_info "Running via mvn spring-boot:run..."
            mvn spring-boot:run -q -Dspring-boot.run.arguments="--server.port=$JAVA_PORT" > "$SCRIPT_DIR/.soukhya-java.log" 2>&1 &
            JAVA_PID=$!
        fi

        echo "$JAVA_PID java" >> "$SCRIPT_DIR/$PIDS_FILE"
        cd "$SCRIPT_DIR"

        if wait_for_port "$JAVA_PORT" "Java" 45 && service_healthy "$JAVA_PORT"; then
            JAVA_STARTED=true
            log_ok "Java Spring Boot backend started successfully (PID: $JAVA_PID)."
        else
            log_error "Java backend did not become healthy on port $JAVA_PORT. Check $SCRIPT_DIR/.soukhya-java.log"
        fi
    fi
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   BACKEND LAUNCH COMPLETE                  ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
[ "$NODE_STARTED" = true ] && echo -e "  ${CYAN}Node.js${NC}  http://localhost:$NODE_PORT   ($ADMIN_USER / $ADMIN_PASS)"
[ "$JAVA_STARTED" = true ] && echo -e "  ${CYAN}Java${NC}     http://localhost:$JAVA_PORT   ($ADMIN_USER / $ADMIN_PASS)"
[ "$NODE_STARTED" = false ] && log_warn "Node.js backend is not running."
[ "$JAVA_STARTED" = false ] && log_warn "Java backend is not running."
echo ""

if [ -x "$SCRIPT_DIR/test.sh" ]; then
    log_info "Running post-launch endpoint verification..."
    if ! NODE_PORT="$NODE_PORT" JAVA_PORT="$JAVA_PORT" bash "$SCRIPT_DIR/test.sh"; then
        log_error "Endpoint verification failed. Shutting down backends."
        cleanup 1
    fi
    log_ok "Endpoint verification completed successfully."
else
    log_warn "test.sh not executable or not found; skipping verification."
fi

echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all running backends${NC}"
echo ""

# Keep script alive to monitor background processes
while true; do
    sleep 5
    all_dead=true
    if [ -f "$SCRIPT_DIR/$PIDS_FILE" ]; then
        while read -r pid name; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                all_dead=false
                break
            fi
        done < "$SCRIPT_DIR/$PIDS_FILE"
    fi

    if $all_dead && [ -s "$SCRIPT_DIR/$PIDS_FILE" ]; then
        log_warn "All launched backends have exited."
        exit 1
    fi
done

