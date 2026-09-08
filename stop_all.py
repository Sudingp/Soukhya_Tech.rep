#!/usr/bin/env python3
"""
Soukhya Tech — Cross-Platform Shutdown Utility (Windows & Linux)
Terminates tracked PIDs and kills processes on ports 3000 & 3001.
"""

import os
import sys
import signal
import subprocess
import re
import time

# Enable ANSI colors on Windows
if sys.platform.startswith('win'):
    os.system('')

GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RED = '\033[91m'
RESET = '\033[0m'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIDS_FILE = os.path.join(SCRIPT_DIR, '.soukhya-pids')

def log_info(msg):
    print(f"{BLUE}[INFO]{RESET}  {msg}")

def log_ok(msg):
    print(f"{GREEN}[OK]{RESET}    {msg}")

def log_warn(msg):
    print(f"{YELLOW}[WARN]{RESET}  {msg}")

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

def kill_pid(pid, name="Process"):
    if not pid:
        return
    try:
        pid = int(pid)
    except ValueError:
        return

    if sys.platform.startswith('win'):
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            log_info(f"Terminated {name} (PID: {pid})")
        except Exception:
            pass
    else:
        try:
            os.kill(pid, signal.SIGKILL)
            log_info(f"Terminated {name} (PID: {pid})")
        except (ProcessLookupError, PermissionError):
            pass
        except Exception as e:
            log_warn(f"Could not kill PID {pid}: {e}")

def kill_port_windows(port, name="Service"):
    try:
        out = subprocess.check_output(f"netstat -ano -p tcp | findstr :{port}", shell=True, text=True)
        pids = set()
        for line in out.strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and 'LISTENING' in parts:
                pids.add(parts[-1])
        for p in pids:
            log_info(f"Stopping {name} on port {port} (PID: {p})")
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(p)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        pass
    except Exception as e:
        log_warn(f"Error checking port {port} on Windows: {e}")

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
            log_info(f"Stopping {name} on port {port} (PID: {p})")
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

def main():
    log_info("Stopping all Soukhya Tech services...")

    # Stop tracked PIDs from .soukhya-pids
    if os.path.exists(PIDS_FILE):
        try:
            with open(PIDS_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    parts = line.strip().split(maxsplit=1)
                    if parts:
                        pid = parts[0]
                        name = parts[1] if len(parts) > 1 else 'Process'
                        kill_pid(pid, name)
            os.remove(PIDS_FILE)
        except Exception as e:
            log_warn(f"Could not read {PIDS_FILE}: {e}")

    # Ensure ports are freed
    kill_port(NODE_PORT, "Node.js")
    kill_port(JAVA_PORT, "Java Spring Boot")

    log_ok("All Soukhya Tech services stopped.")

if __name__ == '__main__':
    main()
