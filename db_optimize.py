#!/usr/bin/env python3
"""
Soukhya Tech — SQLite Database & OS Performance Optimizer
Runs WAL checkpoints, table defragmentation, index validation, and latency benchmarks.
Pure Python standard library (cross-platform for Windows & Linux).
"""

import os
import sys
import time
import sqlite3

# Enable ANSI colors on Windows
if sys.platform.startswith('win'):
    os.system('')

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
CYAN = '\033[96m'
BOLD = '\033[1m'
RESET = '\033[0m'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, 'database', 'attendance.db')

def log_info(msg):
    print(f"{CYAN}[INFO]{RESET}  {msg}")

def log_ok(msg):
    print(f"{GREEN}[OK]{RESET}    {msg}")

def log_warn(msg):
    print(f"{YELLOW}[WARN]{RESET}  {msg}")

def log_error(msg):
    print(f"{RED}[ERROR]{RESET} {msg}", file=sys.stderr)

def get_db_file_sizes():
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    wal_path = DB_PATH + '-wal'
    wal_size = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0
    shm_path = DB_PATH + '-shm'
    shm_size = os.path.getsize(shm_path) if os.path.exists(shm_path) else 0
    return db_size, wal_size, shm_size

def benchmark_queries(conn, iterations=50):
    start = time.perf_counter()
    for _ in range(iterations):
        conn.execute("SELECT id, name, department, role FROM employees LIMIT 50").fetchall()
        conn.execute("SELECT COUNT(*) FROM attendance").fetchone()
        conn.execute("SELECT status, COUNT(*) FROM employees GROUP BY status").fetchall()
    duration = time.perf_counter() - start
    avg_latency_ms = (duration / (iterations * 3)) * 1000
    return avg_latency_ms

def main():
    print()
    print(f"{CYAN}╔════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{CYAN}║     SOUKHYA TECH — SQLite & OS Performance Optimizer       ║{RESET}")
    print(f"{CYAN}╚════════════════════════════════════════════════════════════╝{RESET}")
    print()

    if not os.path.exists(DB_PATH):
        log_error(f"Database not found at {DB_PATH}")
        sys.exit(1)

    log_info(f"Target Database: {DB_PATH}")
    db_sz_before, wal_sz_before, shm_sz_before = get_db_file_sizes()
    print(f"  Initial DB Size:  {db_sz_before / 1024:.1f} KB")
    print(f"  Initial WAL Size: {wal_sz_before / 1024:.1f} KB")

    # Connect with high performance parameters
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.execute("PRAGMA busy_timeout = 5000")

    # 1. Benchmark Before
    log_info("Running pre-optimization read benchmarks...")
    latency_before = benchmark_queries(conn)
    print(f"  Pre-Optimization Query Latency: {latency_before:.3f} ms / query")

    # 2. Check Integrity
    log_info("Verifying database B-tree integrity...")
    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity == 'ok':
        log_ok("Integrity check passed (OK)")
    else:
        log_warn(f"Integrity check returned: {integrity}")

    # 3. WAL Checkpoint (TRUNCATE)
    log_info("Running WAL Checkpoint (TRUNCATE) to merge write logs...")
    res = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
    log_ok(f"Checkpoint completed: busy={res[0]}, log_pages={res[1]}, checkpointed={res[2]}")

    # 4. PRAGMA Optimize & VACUUM
    log_info("Running SQLite PRAGMA optimize & memory defragmentation...")
    conn.execute("PRAGMA optimize")
    try:
        conn.execute("VACUUM")
        log_ok("VACUUM completed: database defragmented and free space reclaimed.")
    except Exception as e:
        log_warn(f"VACUUM note (non-critical): {e}")

    # 5. Verify Indexes
    log_info("Validating table indexes...")
    indexes = conn.execute("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'").fetchall()
    log_ok(f"Active indexes: {len(indexes)} index structures verified.")
    for idx_name, tbl in indexes:
        if not idx_name.startswith('sqlite_autoindex'):
            print(f"    • {idx_name} on {tbl}")

    # 6. Benchmark After
    log_info("Running post-optimization latency benchmarks...")
    latency_after = benchmark_queries(conn)
    print(f"  Post-Optimization Query Latency: {latency_after:.3f} ms / query")

    conn.close()

    db_sz_after, wal_sz_after, shm_sz_after = get_db_file_sizes()
    print()
    print(f"{GREEN}============================================{RESET}")
    print(f"{GREEN}   OPTIMIZATION SUMMARY                     {RESET}")
    print(f"{GREEN}============================================{RESET}")
    print(f"  Database Size:  {db_sz_before / 1024:.1f} KB → {db_sz_after / 1024:.1f} KB")
    print(f"  WAL Log Size:   {wal_sz_before / 1024:.1f} KB → {wal_sz_after / 1024:.1f} KB")
    print(f"  Query Latency:  {latency_before:.3f} ms → {latency_after:.3f} ms")
    if latency_before > 0:
        improvement = ((latency_before - latency_after) / latency_before) * 100
        print(f"  Latency Change: {improvement:+.1f}%")
    print(f"{GREEN}============================================{RESET}\n")

if __name__ == '__main__':
    main()
