#!/usr/bin/env python3
"""
Soukhya Tech — Unified Backend Launcher (Cross-Platform: Windows & Linux)
Auto-detects runtimes | Auto-starts MySQL | Auto-builds | Auto-launches Node.js & Java backends.
Pure Python standard library (no external packages needed).
"""

import os
import sys
import time
import signal
import subprocess
import shutil
import urllib.request
import urllib.error
import json
import glob
import re

# Bypass proxy for localhost / loopback calls
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))

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
    print(f"{CYAN}║     SOUKHYA TECH  —  Unified Cross-Platform Launcher       ║{RESET}")
    print(f"{CYAN}║              (Linux / Windows / macOS Native)              ║{RESET}")
    print(f"{CYAN}╚════════════════════════════════════════════════════════════╝{RESET}")
    print()

def configure_java_env():
    """Auto-detect JDK 21 / 17 on Windows and configure JAVA_HOME / PATH if needed."""
    if sys.platform.startswith('win'):
        current_java = shutil.which('java')
        current_home = os.environ.get('JAVA_HOME')
        
        # Check standard Adoptium JDK and common Windows JDK install locations
        jdk_candidates = [
            r"C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot",
            r"C:\Program Files\Eclipse Adoptium\jdk-21",
            r"C:\Program Files\Java\jdk-21",
            r"C:\Program Files\Amazon Corretto\jdk21",
            r"C:\Program Files\Zulu\zulu-21",
            r"C:\Program Files\Eclipse Adoptium\jdk-17",
            r"C:\Program Files\Java\jdk-17"
        ]
        
        if not current_home or not os.path.exists(current_home):
            for cand in jdk_candidates:
                java_exe = os.path.join(cand, 'bin', 'java.exe')
                if os.path.exists(cand) and os.path.exists(java_exe):
                    os.environ['JAVA_HOME'] = cand
                    os.environ['PATH'] = os.path.join(cand, 'bin') + os.pathsep + os.environ.get('PATH', '')
                    log_info(f"Auto-configured Windows JAVA_HOME: {cand}")
                    break
        elif current_home and os.path.exists(current_home):
            java_bin = os.path.join(current_home, 'bin')
            if java_bin not in os.environ.get('PATH', ''):
                os.environ['PATH'] = java_bin + os.pathsep + os.environ.get('PATH', '')

configure_java_env()

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

def ensure_mysql():
    """Ensure MySQL 8.4 / MariaDB database service is running before starting backends."""
    setup_script = os.path.join(SCRIPT_DIR, 'scripts', 'setup_mysql.js')
    if os.path.exists(setup_script):
        log_info("Verifying MySQL database service...")
        node_cmd = shutil.which('node') or 'node'
        try:
            res = subprocess.run([node_cmd, setup_script], cwd=SCRIPT_DIR)
            if res.returncode == 0:
                log_ok("MySQL database service is active and ready.")
            else:
                log_warn("MySQL setup script exited with non-zero status. Proceeding...")
        except Exception as e:
            log_warn(f"Notice running setup_mysql.js: {e}")

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
            if e.code in (200, 401, 403, 404):
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

    # 1. Check runtime availability
    log_info("Verifying installed runtimes...")
    node_avail = shutil.which('node') is not None
    if not node_avail:
        log_error("Node.js is not installed or not found in PATH.")
        log_error("Please install Node.js from https://nodejs.org/")
        sys.exit(1)
    else:
        log_ok("Node.js runtime detected.")

    mvn_cmd = 'mvn.cmd' if sys.platform.startswith('win') else 'mvn'
    mvn_avail = shutil.which(mvn_cmd) is not None or shutil.which('mvn') is not None
    java_cmd = 'java.exe' if sys.platform.startswith('win') else 'java'
    java_avail = shutil.which(java_cmd) is not None or shutil.which('java') is not None

    play_java = mvn_avail or java_avail
    if play_java:
        log_ok("Java / Maven runtime detected.")
    else:
        log_warn("Maven/Java is not installed in PATH. Java backend will be skipped.")

    # 2. Ensure MySQL Database Service
    ensure_mysql()

    # 3. Detect Layout
    node_dir = SCRIPT_DIR if os.path.exists(os.path.join(SCRIPT_DIR, 'server.js')) else None
    java_dir = SCRIPT_DIR if os.path.exists(os.path.join(SCRIPT_DIR, 'pom.xml')) and play_java else None

    log_info("Detected project configuration:")
    if node_dir:
        print(f"  {CYAN}Node.js{RESET}  → {node_dir} (Port {NODE_PORT})")
    if java_dir:
        print(f"  {CYAN}Java{RESET}     → {java_dir} (Port {JAVA_PORT})")

    # 4. Port conflict checks and cleanup
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

    if java_dir:
        if service_healthy(JAVA_PORT):
            log_warn(f"Java already active on port {JAVA_PORT}; reusing running instance.")
            java_started = True
        else:
            kill_port(JAVA_PORT, "Java Spring Boot")

    # 5. Start Node.js Backend
    if node_dir and not node_started:
        print()
        log_info("═══ Starting Node.js Backend (Port 3000) ═══")
        node_modules = os.path.join(node_dir, 'node_modules')
        if not os.path.exists(node_modules):
            log_info("node_modules directory missing. Running npm install...")
            npm_cmd = shutil.which('npm') or ('npm.cmd' if sys.platform.startswith('win') else 'npm')
            subprocess.run([npm_cmd, 'install'], cwd=node_dir, shell=sys.platform.startswith('win'))

        node_env = os.environ.copy()
        node_env['PORT'] = str(NODE_PORT)
        node_log = open(os.path.join(SCRIPT_DIR, '.soukhya-node.log'), 'w', encoding='utf-8')

        node_bin = shutil.which('node') or 'node'
        node_proc = subprocess.Popen([node_bin, 'server.js'], cwd=node_dir, env=node_env, stdout=node_log, stderr=subprocess.STDOUT)
        PROCESSES.append((node_proc, "Node.js"))
        write_pid(node_proc.pid, "node")

        if wait_for_port(NODE_PORT, "Node.js") and service_healthy(NODE_PORT):
            node_started = True
            log_ok(f"Node.js backend started successfully (PID: {node_proc.pid}).")
        else:
            log_error(f"Node.js did not become healthy on port {NODE_PORT}. Check .soukhya-node.log")

    # 6. Start Java Spring Boot Backend
    if java_dir and not java_started:
        print()
        log_info("═══ Starting Java Spring Boot Backend (Port 3001) ═══")
        jars = glob.glob(os.path.join(java_dir, 'target', 'faceattendance-*.jar'))
        jars = [j for j in jars if not j.endswith('.original')]

        if not jars or not os.path.exists(jars[0]):
            log_info("Target JAR not found. Compiling Java package (mvn clean package -DskipTests)...")
            res = subprocess.run([mvn_cmd, 'clean', 'package', '-DskipTests'], cwd=java_dir, shell=sys.platform.startswith('win'))
            if res.returncode != 0:
                log_warn("Maven package build returned non-zero code.")
            jars = glob.glob(os.path.join(java_dir, 'target', 'faceattendance-*.jar'))
            jars = [j for j in jars if not j.endswith('.original')]

        java_log = open(os.path.join(SCRIPT_DIR, '.soukhya-java.log'), 'w', encoding='utf-8')
        java_bin = shutil.which('java') or 'java'
        if jars and os.path.exists(jars[0]):
            jar_path = jars[0]
            log_info(f"Launching {os.path.basename(jar_path)} on port {JAVA_PORT}...")
            java_proc = subprocess.Popen([java_bin, '-jar', jar_path, f'--server.port={JAVA_PORT}'], cwd=java_dir, stdout=java_log, stderr=subprocess.STDOUT)
        else:
            log_info(f"Launching via {mvn_cmd} spring-boot:run on port {JAVA_PORT}...")
            java_proc = subprocess.Popen([
                mvn_cmd, 'spring-boot:run',
                '-Dspring-boot.run.mainClass=com.soukhyatech.faceattendance.FaceAttendanceApplication',
                f'-Dspring-boot.run.jvmArguments=-Dserver.port={JAVA_PORT}'
            ], cwd=java_dir, stdout=java_log, stderr=subprocess.STDOUT, shell=sys.platform.startswith('win'))

        PROCESSES.append((java_proc, "Java Spring Boot"))
        write_pid(java_proc.pid, "java")

        if wait_for_port(JAVA_PORT, "Java Spring Boot", max_wait=45) and service_healthy(JAVA_PORT):
            java_started = True
            log_ok(f"Java Spring Boot started successfully (PID: {java_proc.pid}).")
        else:
            log_warn(f"Java backend starting or running. Check .soukhya-java.log for live status.")

    print()
    print(f"{GREEN}============================================================{RESET}")
    print(f"{GREEN}   SOUKHYA TECH HR ENTERPRISE — BACKENDS READY             {RESET}")
    print(f"{GREEN}============================================================{RESET}")
    print()
    if node_started:
        print(f"  {CYAN}Node.js Dashboard & APIs{RESET}  → http://localhost:{NODE_PORT}   ({ADMIN_USER} / {ADMIN_PASS})")
    if java_started:
        print(f"  {CYAN}Java Spring Boot Backend{RESET}  → http://localhost:{JAVA_PORT}   ({ADMIN_USER} / {ADMIN_PASS})")
    print()

    # 7. Run post-launch verification
    test_script = os.path.join(SCRIPT_DIR, 'test_all.py')
    if os.path.exists(test_script):
        log_info("Running post-launch endpoint verification...")
        test_target = 'all' if java_started else 'node'
        test_res = subprocess.run([sys.executable, test_script, test_target])
        if test_res.returncode == 0:
            log_ok("Post-launch endpoint verification passed 100%.")
        else:
            log_warn("Some post-launch endpoint tests reported issues. Check test log above.")

    print()
    print(f"  {YELLOW}Press Ctrl+C to stop all running services{RESET}")
    print()

    try:
        while True:
            time.sleep(3)
            all_alive = True
            for proc, name in PROCESSES:
                if proc and proc.poll() is not None:
                    log_warn(f"{name} exited with code {proc.poll()}.")
                    all_alive = False
            if not all_alive and PROCESSES:
                break
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()

