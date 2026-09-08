#!/usr/bin/env python3
"""
Soukhya Tech — Cross-Platform Endpoint Test Suite (Windows & Linux)
Pure Python standard library (no third-party dependencies required).
Tests Node.js & Java Spring Boot REST endpoints.
"""

import sys
import os
import json
import urllib.request
import urllib.error
import time

# Enable ANSI escape sequences on Windows
if sys.platform.startswith('win'):
    os.system('')

# Colors
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
CYAN = '\033[96m'
RESET = '\033[0m'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

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

PASSED_TESTS = 0
FAILED_TESTS = 0

def log_info(msg):
    print(f"{CYAN}[INFO]{RESET}  {msg}")

def log_ok(msg):
    global PASSED_TESTS
    PASSED_TESTS += 1
    print(f"{GREEN}[OK]{RESET}    {msg}")

def log_warn(msg):
    print(f"{YELLOW}[WARN]{RESET}  {msg}")

def log_fail(msg):
    global FAILED_TESTS
    FAILED_TESTS += 1
    print(f"{RED}[FAIL]{RESET}  {msg}", file=sys.stderr)

def make_request(url, method='GET', headers=None, data=None):
    if headers is None:
        headers = {}
    
    encoded_data = None
    if data is not None:
        if isinstance(data, (dict, list)):
            encoded_data = json.dumps(data).encode('utf-8')
            if 'Content-Type' not in headers:
                headers['Content-Type'] = 'application/json'
        elif isinstance(data, str):
            encoded_data = data.encode('utf-8')
        else:
            encoded_data = data

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode('utf-8')
            return response.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        return e.code, body
    except Exception as e:
        return 0, str(e)

def assert_service_ready(port, name):
    url = f"http://127.0.0.1:{port}/"
    status, body = make_request(url)
    if status == 0:
        log_fail(f"{name} did not respond on port {port}: {body}")
        return False
    log_ok(f"{name} is reachable on port {port} (HTTP {status})")
    return True

def get_auth_tokens(port, name):
    url = f"http://127.0.0.1:{port}/api/auth/login"
    log_info(f"Authenticating against {name} at {url}")
    status, body = make_request(url, method='POST', data={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })

    if status != 200:
        log_fail(f"{name} authentication failed with HTTP {status}: {body}")
        return None, None

    try:
        data = json.loads(body)
        access_token = data.get('access_token')
        refresh_token = data.get('refresh_token')
        if not access_token:
            log_fail(f"{name} login returned HTTP 200 but access_token is missing")
            return None, None
        log_ok(f"{name} login successful (Access token acquired)")
        return access_token, refresh_token
    except Exception as e:
        log_fail(f"{name} failed to parse JSON auth response: {e}")
        return None, None

def test_auth_refresh(port, name, refresh_token):
    url = f"http://127.0.0.1:{port}/api/auth/refresh"
    log_info(f"Testing token refresh on {name}")
    status, body = make_request(url, method='POST', data={"refresh_token": refresh_token})
    if status == 200:
        log_ok(f"{name} token refresh returned HTTP 200")
        return True
    else:
        log_fail(f"{name} token refresh returned HTTP {status} (expected 200): {body}")
        return False

def test_auth_invalid(port, name):
    url = f"http://127.0.0.1:{port}/api/auth/login"
    log_info(f"Testing invalid login rejection on {name}")
    status, body = make_request(url, method='POST', data={
        "username": "admin",
        "password": "wrong-password-xyz"
    })
    if status == 401:
        log_ok(f"{name} invalid login rejection returned HTTP 401")
        return True
    else:
        log_fail(f"{name} invalid login returned HTTP {status} (expected 401): {body}")
        return False

def assert_api_get(port, path, token, name):
    url = f"http://127.0.0.1:{port}{path}"
    log_info(f"Testing {name} {path}")
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    status, body = make_request(url, method='GET', headers=headers)
    if status == 200:
        log_ok(f"{name} {path} returned HTTP 200")
        return True
    else:
        log_fail(f"{name} {path} returned HTTP {status} (expected 200): {body}")
        return False

def run_service_tests(port, name):
    print()
    log_info("══════════════════════════════════════════")
    log_info(f" Running Tests for: {name} (Port {port})")
    log_info("══════════════════════════════════════════")

    if not assert_service_ready(port, name):
        return False

    access_token, refresh_token = get_auth_tokens(port, name)
    if not access_token:
        return False

    if refresh_token:
        test_auth_refresh(port, name, refresh_token)

    test_auth_invalid(port, name)

    assert_api_get(port, "/api/employees", access_token, name)
    assert_api_get(port, "/api/attendance", access_token, name)
    assert_api_get(port, "/api/stats", access_token, name)

    if "Node" in name:
        log_info(f"Testing Real-Time Sync & DSA Cache stats on {name}")
        sync_status, sync_body = make_request(f"http://127.0.0.1:{port}/api/sync/version")
        if sync_status == 200 and "revision" in sync_body:
            log_ok(f"{name} Real-Time Sync & DSA Cache active (HTTP 200)")
        else:
            log_fail(f"{name} /api/sync/version returned HTTP {sync_status}")

    if "Java" in name:
        log_info(f"Testing Actuator health on {name}")
        act_status, _ = make_request(f"http://127.0.0.1:{port}/actuator/health")
        if act_status == 200:
            log_ok(f"{name} Actuator health returned HTTP 200")
        else:
            log_fail(f"{name} Actuator health returned HTTP {act_status} (expected 200)")

    return True


def main():
    target = (sys.argv[1] if len(sys.argv) > 1 else 'all').lower()
    log_info(f"Starting Soukhya Tech test suite for target: {target}")

    if target == 'node':
        run_service_tests(NODE_PORT, "Node.js")
    elif target == 'java':
        run_service_tests(JAVA_PORT, "Java Spring Boot")
    else:
        run_service_tests(NODE_PORT, "Node.js")
        run_service_tests(JAVA_PORT, "Java Spring Boot")

    print()
    if FAILED_TESTS == 0:
        print(f"{GREEN}============================================{RESET}")
        print(f"{GREEN}   ALL ENDPOINT TESTS PASSED ({PASSED_TESTS} passed)    {RESET}")
        print(f"{GREEN}============================================{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}============================================{RESET}")
        print(f"{RED}   TEST SUITE FAILED ({FAILED_TESTS} failed, {PASSED_TESTS} passed) {RESET}")
        print(f"{RED}============================================{RESET}")
        sys.exit(1)

if __name__ == '__main__':
    main()
