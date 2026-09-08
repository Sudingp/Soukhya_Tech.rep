#!/usr/bin/env python3
"""
Soukhya Tech — Unified Backend Launcher (Windows & Linux)
Auto-detects | Auto-builds | Auto-launches Node.js and Java backends.
Pure Python standard library (no external packages needed).
"""

import os
import sys
import time
import signal
import subprocess
import urllib.request
import urllib.error
import json
import glob
import re


# Enable ANSI colors on Windows
if sys.platform.startswith('win'):
    os.system('')

RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
RESET = '\033[0m'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIDS_FILE = os.path.join(SCRIPT_DIR, '.soukhya-pids')

def log_info(msg):
    print(f"{BLUE}[INFO]{RESET}  {msg}")

def log_ok(msg):
    print(f"{GREEN}[OK]{RESET}    {msg}")

def log_warn(msg):
    print(f"{YELLOW}[WARN]{RESET}  {msg}")

def log_error(msg):
    print(f"{RED}[ERROR]{RESET} {msg}", file=sys.stderr)

def print_header():
    print()
    print(f"{CYAN}╔════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{CYAN}║         SOUKHYA TECH  —  Backend Launcher (Python)         ║{RESET}")
    print(f"{CYAN}╚════════════════════════════════════════════════════════════╝{RESET}")
    print()

def load_env():
    env_path = os.path.join(SCRIPT_DIR, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('\'"')
                    if k not in os.environ:
                        os.environ[k] = v

load_env()

NODE_PORT = int(os.environ.get('NODE_PORT') or os.environ.get('PORT') or 3000)
JAVA_PORT = int(os.environ.get('JAVA_PORT') or 3001)

ADMIN_USER = os.environ.get('ADMIN_USER') or os.environ.get('ADMIN_USERNAME') or 'admin'
ADMIN_PASS = os.environ.get('ADMIN_PASS') or os.environ.get('ADMIN_PASSWORD') or 'admin123'

PROCESSES = []

def kill_port_windows(port, name="Service"):
    try:
        out = subprocess.check_output(f"netstat -ano -p tcp | findstr :{port}", shell=True, text=True)
        pids = set()
        for line in out.strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and 'LISTENING' in parts:
                pids.add(parts[-1])
        for p in pids:
            log_warn(f"Stopping existing {name} on port {port} (PID: {p})")
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(p)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def kill_port_posix(port, name="Service"):
    pids = set()
    try:
        out = subprocess.check_output(['lsof', '-ti', f':{port}'], text=True, stderr=subprocess.DEVNULL)
        pids.update([int(p) for p in out.strip().split() if p.isdigit()])
    except Exception:
        pass

    try:
        subprocess.run(['fuser', '-k', f'{port}/tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    try:
        out = subprocess.check_output(['ss', '-tlnp'], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            if f':{port} ' in line:
                for match in re.findall(r'pid=(\d+)', line):
                    pids.add(int(match))
    except Exception:
        pass

    for p in pids:
        try:
            log_warn(f"Stopping existing {name} on port {port} (PID: {p})")
            os.kill(p, signal.SIGKILL)
        except Exception:
            pass

    if pids:
        time.sleep(0.5)

def kill_port(port, name="Service"):
    if sys.platform.startswith('win'):
        kill_port_windows(port, name)
    else:
        kill_port_posix(port, name)

def service_healthy(port):
    url = f"http://127.0.0.1:{port}/api/auth/login"
    payload = json.dumps({"username": ADMIN_USER, "password": ADMIN_PASS}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False

def wait_for_port(port, name, max_wait=35):
    waited = 0
    while waited < max_wait:
        try:
            url = f"http://127.0.0.1:{port}/"
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status in (200, 401, 403):
                    log_ok(f"{name} is live on port {port} ({waited}s)")
                    return True
        except urllib.error.HTTPError as e:
            if e.code in (200, 401, 403):
                log_ok(f"{name} is live on port {port} ({waited}s)")
                return True
        except Exception:
            pass
        time.sleep(1)
        waited += 1

    log_error(f"{name} failed to respond on port {port} within {max_wait}s")
    return False

def cleanup():
    print()
    log_warn("Shutting down managed backends...")
    for proc, name in PROCESSES:
        if proc and proc.poll() is None:
            try:
                if sys.platform.startswith('win'):
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    proc.kill()
                log_info(f"Stopped {name} (PID: {proc.pid})")
            except Exception:
                pass

    if os.path.exists(PIDS_FILE):
        try:
            os.remove(PIDS_FILE)
        except Exception:
            pass

    kill_port(NODE_PORT, "Node.js")
    kill_port(JAVA_PORT, "Java Spring Boot")
    log_ok("All backends stopped.")

def write_pid(pid, name):
    try:
        with open(PIDS_FILE, 'a', encoding='utf-8') as f:
            f.write(f"{pid} {name}\n")
    except Exception:
        pass

def main():
    print_header()
    os.chdir(SCRIPT_DIR)

    # Detect layout
    node_dir = SCRIPT_DIR if os.path.exists(os.path.join(SCRIPT_DIR, 'server.js')) else None
    java_dir = SCRIPT_DIR if os.path.exists(os.path.join(SCRIPT_DIR, 'pom.xml')) else None

    log_info("Detected project configuration:")
    if node_dir:
        print(f"  {CYAN}Node.js{RESET}  → {node_dir} (Port {NODE_PORT})")
    if java_dir:
        print(f"  {CYAN}Java{RESET}     → {java_dir} (Port {JAVA_PORT})")

    if not node_dir and not java_dir:
        log_error("No backend projects found (server.js or pom.xml missing).")
        sys.exit(1)

    # Pre-check ports
    if os.path.exists(PIDS_FILE):
        try:
            os.remove(PIDS_FILE)
        except Exception:
            pass

    node_started = False
    java_started = False

    if service_healthy(NODE_PORT):
        log_warn(f"Node.js already active on port {NODE_PORT}; reusing running instance.")
        node_started = True
    else:
        kill_port(NODE_PORT, "Node.js")

    if service_healthy(JAVA_PORT):
        log_warn(f"Java already active on port {JAVA_PORT}; reusing running instance.")
        java_started = True
    else:
        kill_port(JAVA_PORT, "Java Spring Boot")

    # Start Node.js
    if node_dir and not node_started:
        print()
        log_info("═══ Starting Node.js Backend ═══")
        node_modules = os.path.join(node_dir, 'node_modules')
        if not os.path.exists(node_modules):
            log_info("node_modules missing. Running npm install...")
            npm_cmd = 'npm.cmd' if sys.platform.startswith('win') else 'npm'
            subprocess.run([npm_cmd, 'install', '--silent'], cwd=node_dir)

        node_env = os.environ.copy()
        node_env['PORT'] = str(NODE_PORT)
        node_log = open(os.path.join(SCRIPT_DIR, '.soukhya-node.log'), 'w', encoding='utf-8')
        
        node_proc = subprocess.Popen(['node', 'server.js'], cwd=node_dir, env=node_env, stdout=node_log, stderr=subprocess.STDOUT)
        PROCESSES.append((node_proc, "Node.js"))
        write_pid(node_proc.pid, "node")

        if wait_for_port(NODE_PORT, "Node.js") and service_healthy(NODE_PORT):
            node_started = True
            log_ok(f"Node.js backend started successfully (PID: {node_proc.pid}).")
        else:
            log_error(f"Node.js did not become healthy on port {NODE_PORT}. See .soukhya-node.log")

    # Start Java Spring Boot
    if java_dir and not java_started:
        print()
        log_info("═══ Starting Java Spring Boot Backend ═══")
        jars = glob.glob(os.path.join(java_dir, 'target', 'faceattendance-*.jar'))
        jars = [j for j in jars if not j.endswith('.original')]

        if not jars or not os.path.exists(jars[0]):
            log_info("Building Java package (mvn clean package -DskipTests)...")
            mvn_cmd = 'mvn.cmd' if sys.platform.startswith('win') else 'mvn'
            res = subprocess.run([mvn_cmd, 'clean', 'package', '-q', '-DskipTests'], cwd=java_dir)
            if res.returncode != 0:
                log_error("Maven build failed. Check Java and Maven installations.")
            jars = glob.glob(os.path.join(java_dir, 'target', 'faceattendance-*.jar'))
            jars = [j for j in jars if not j.endswith('.original')]

        java_log = open(os.path.join(SCRIPT_DIR, '.soukhya-java.log'), 'w', encoding='utf-8')
        if jars and os.path.exists(jars[0]):
            jar_path = jars[0]
            log_info(f"Launching {os.path.basename(jar_path)} on port {JAVA_PORT}...")
            java_proc = subprocess.Popen(['java', '-jar', jar_path, f'--server.port={JAVA_PORT}'], cwd=java_dir, stdout=java_log, stderr=subprocess.STDOUT)
        else:
            log_info(f"Running via mvn spring-boot:run on port {JAVA_PORT}...")
            mvn_cmd = 'mvn.cmd' if sys.platform.startswith('win') else 'mvn'
            java_proc = subprocess.Popen([mvn_cmd, 'spring-boot:run', '-q', f'-Dspring-boot.run.arguments=--server.port={JAVA_PORT}'], cwd=java_dir, stdout=java_log, stderr=subprocess.STDOUT)

        PROCESSES.append((java_proc, "Java Spring Boot"))
        write_pid(java_proc.pid, "java")

        if wait_for_port(JAVA_PORT, "Java Spring Boot", max_wait=45) and service_healthy(JAVA_PORT):
            java_started = True
            log_ok(f"Java Spring Boot started successfully (PID: {java_proc.pid}).")
        else:
            log_error(f"Java backend did not become healthy on port {JAVA_PORT}. See .soukhya-java.log")

    print()
    print(f"{GREEN}============================================{RESET}")
    print(f"{GREEN}   BACKEND LAUNCH COMPLETE                  {RESET}")
    print(f"{GREEN}============================================{RESET}")
    print()
    if node_started:
        print(f"  {CYAN}Node.js{RESET}  http://localhost:{NODE_PORT}   ({ADMIN_USER} / {ADMIN_PASS})")
    if java_started:
        print(f"  {CYAN}Java{RESET}     http://localhost:{JAVA_PORT}   ({ADMIN_USER} / {ADMIN_PASS})")
    print()

    # Run tests automatically
    test_script = os.path.join(SCRIPT_DIR, 'test_all.py')
    if os.path.exists(test_script):
        log_info("Running post-launch endpoint verification...")
        test_res = subprocess.run([sys.executable, test_script, 'all'])
        if test_res.returncode != 0:
            log_error("Endpoint verification failed. Shutting down backends.")
            cleanup()
            sys.exit(1)
        log_ok("Endpoint verification completed successfully.")

    print()
    print(f"  {YELLOW}Press Ctrl+C to stop all running backends{RESET}")
    print()

    try:
        while True:
            time.sleep(3)
            # Check if any process died
            all_alive = True
            for proc, name in PROCESSES:
                if proc and proc.poll() is not None:
                    log_warn(f"{name} exited unexpectedly with code {proc.poll()}.")
                    all_alive = False
            if not all_alive and PROCESSES:
                break
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()
