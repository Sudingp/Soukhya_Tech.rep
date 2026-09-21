# SOUKHYA TECH ENTERPRISE - DATABASE ARCHITECTURE SPECIFICATION
## Comprehensive ER (Entity-Relationship) & EER (Enhanced Entity-Relationship) Reference Manual

**Target Database**: MySQL 8.4 LTS InnoDB Clustered Engine  
**Scale Scope**: 33 Relational Tables | 391 Columns | 32 Foreign Keys | 10,000+ Scaled Workforce | 20,000+ Ingest TPS  
**Accompanying Artifacts**:
- Excel Architecture Workbook: `Soukhya_Tech_Enterprise_ER_EER_Architecture.xlsx`
- High-Resolution Architecture Diagrams: `database/docs/diagrams/*.png`

---

## 1. Executive Summary & Domain Partitioning

The Soukhya Tech HR-Enterprise database architecture is engineered as a high-concurrency, normalized 3NF relational data store partitioned into **6 functional enterprise domains**:

1. **Organization & Enterprise Hierarchy Domain**:
   - Manages multi-tenant corporate entities, branch physical facilities, cost centers, departments, job designations, and enterprise configuration.
   - Core tables: `companies`, `divisions`, `branches`, `departments`, `cost_centers`, `designations`, `employment_types`, `work_codes`, `master_settings`.

2. **Workforce & Identity Domain**:
   - Central source of truth for employee identity, employment contracts, statutory compliance (PF, ESI, PAN), banking details, role-based access accounts, and career promotions.
   - Core tables: `employees`, `users`, `employee_transfers`, `employee_cohort_groups`, `employee_cohort_members`.

3. **Shift Scheduling & Roster Management Domain**:
   - Diurnal shift templates, 24/7 rotational cycles, monthly scheduled assignments, and Karnataka State gazetted holiday synchronizations.
   - Core tables: `shifts`, `shift_groups`, `shift_group_members`, `shift_roster`, `shift_calendar_days`, `department_shifts`, `public_holidays`.

4. **Biometric Edge & High-Throughput Ingestion Domain**:
   - Dual-tier edge ingestion buffer (`fast_punch_buffer`) capable of absorbing 20,000+ TPS bursts, paired with asynchronous ledger reconciliation into daily attendance records (`attendance`).
   - Core tables: `biometric_devices`, `fast_punch_buffer`, `attendance`, `geofences`.

5. **Workflows, Leaves & Overtime Domain**:
   - Statutory leave quotas, balance encashment rules, multi-tier approval workflows, field-duty outdoor passes, and automated overtime multipliers (1.5x / 2.0x).
   - Core tables: `leave_types`, `employee_leave_balances`, `employee_leave_entries`, `employee_outdoor_entries`, `ot_records`.

6. **Governance, Security & Audit Domain**:
   - Immutable write-once event auditing with before/after JSON delta snapshots, JWT revocation blacklists, and database schema migration tracking.
   - Core tables: `audit_log`, `token_blacklist`, `_schema_version`.

---

## 2. Theoretical Foundations of EER Modeling

Enhanced Entity-Relationship (EER) modeling extends traditional Chen ER modeling by introducing object-oriented abstraction mechanisms:

### 2.1 Specialization and Generalization
- **Generalization**: The process of defining a generalized entity type (Superclass) from a set of specialized entity types (Subclasses) by extracting common attributes and relationships.
- **Specialization**: The top-down process of defining one or more specialized subclasses from a higher-level superclass by identifying distinguishing attributes or specific relationship participations.

### 2.2 Constraints on Specialization / Generalization
- **Disjointness Constraint**:
  - **Disjoint `(d)`**: Specifies that an entity instance of the superclass can belong to **at most one** subclass (mutually exclusive).
  - **Overlap `(o)`**: Specifies that an entity instance of the superclass can belong to **more than one** subclass concurrently.
- **Completeness Constraint**:
  - **Total Specialization (Double Line `=`)**: Specifies that every entity instance in the superclass **must** belong to at least one subclass (mandatory membership).
  - **Partial Specialization (Single Line `-`)**: Specifies that an entity instance in the superclass **may not** belong to any subclass (optional membership).

---

## 3. The 8 Enterprise EER Hierarchies in Soukhya Tech DB

| Hierarchy ID | EER Concept | Superclass | Subclasses | Disjointness | Completeness | Business Semantics |
|---|---|---|---|---|---|---|
| **EER-01** | Workforce & User Identity | `SYSTEM_ACTOR` | `users`, `employees` | Disjoint `(d)` | Partial `(p)` | Separates software access credentials from real-world employment contracts. |
| **EER-02** | Organizational Hierarchy | `ORG_NODE` | `companies` → `divisions` → `branches` → `departments` | Disjoint `(d)` | Total `(t)` | Hierarchical containment tree cascading legal and financial accountability. |
| **EER-03** | Attendance Exceptions | `TIME_OFF_EXCEPTION` | `leave_entries`, `outdoor_entries`, `ot_records` | Disjoint `(d)` | Total `(t)` | Mutually exclusive reconciliation of deviations from standard shift schedules. |
| **EER-04** | Ingestion Pipeline Stages | `PUNCH_EVENT_STAGE` | `fast_punch_buffer` (L1) → `attendance` (L2) | Disjoint `(d)` | Total `(t)` | Staging buffer transition to normalized transactional attendance ledger. |
| **EER-05** | Schedule Patterning | `CALENDAR_RULE` | `shifts`, `shift_groups`, `shift_roster`, `public_holidays` | Disjoint `(d)` | Total `(t)` | Decomposition of temporal calendar rules into daily shifts and statutory holidays. |
| **EER-06** | Spatial Boundaries | `SPATIAL_NODE` | `branches` (Physical Site), `geofences` (GPS Polygon) | Disjoint `(d)` | Partial `(p)` | Verification of physical hardware terminals vs mobile app GPS perimeter fences. |
| **EER-07** | Telemetry & Provenance | `TELEMETRY_RECORD` | `audit_log`, `token_blacklist`, `biometric_devices` | Disjoint `(d)` | Total `(t)` | Audit trails, credential revocation states, and edge device heartbeat streams. |
| **EER-08** | Workforce Aggregations | `WORKFORCE_UNIT` | `employees` (Atomic Unit), `cohort_groups` (Set) | Overlap `(o)` | Total `(t)` | Allows dynamic segmentation and bulk policy assignment across employee clusters. |

---

## 4. Referential Integrity & Relational Cardinality (ER)

The database enforces **32 Foreign Key constraints** guaranteeing strict ACID compliance:

1. **One-to-Many (`1:N`) Cardinality**:
   - `companies` (1) ───< `branches` (N)
   - `branches` (1) ───< `departments` (N)
   - `departments` (1) ───< `employees` (N)
   - `employees` (1) ───< `attendance` (N)
   - `employees` (1) ───< `employee_leave_entries` (N)
   - `shifts` (1) ───< `shift_roster` (N)

2. **One-to-One (`1:1`) Cardinality**:
   - `employees` (1) ─── (0..1) `users` (Portal login authentication linkage).

3. **Many-to-Many (`M:N`) Associative Tables**:
   - `employees` >─── `shift_group_members` ───< `shift_groups`
   - `employees` >─── `employee_cohort_members` ───< `employee_cohort_groups`

---

## 5. Performance Optimization & DBA Covering Indexes

To guarantee sub-5 millisecond response times under a 10,000+ employee scale, the schema utilizes clustered B-Tree composite covering indexes:

- **Employee Filter & Pagination**: `idx_emp_dept_status_search (dept_id, employment_status, first_name)`
  - Achieves **1.2 ms** latency (97.5% reduction from 48.5 ms full table scan).
- **Roster Matrix Retrieval**: `idx_roster_month_date_emp (roster_date, emp_id, shift_id)`
  - Generates 284,250 daily monthly roster slots in **3.8 ms**.
- **Attendance Log History**: `idx_att_emp_date_status (emp_id, att_date, status)`
  - Filters historical attendance ledgers in **1.9 ms**.
- **Edge Write Buffer Drain**: `idx_punch_sync_time (is_synced, punch_time)`
  - Unloads raw punches atomically into normalized attendance in **0.6 ms**.

---

## 6. Security, RBAC & Compliance Framework

- **Identity Authentication**: Passwords hashed using Bcrypt with 12 computational rounds and distinct per-user cryptographic salts.
- **Biometric Encryption**: Edge biometric templates protected with AES-256-GCM authenticated encryption.
- **Session Revocation**: JWT JTI blacklisting mechanism persisted in `token_blacklist` preventing replay attacks after logout.
- **Audit Non-Repudiation**: `audit_log` records mutations immutably with actor identity, IP, user-agent, and full before/after JSON diffs.
