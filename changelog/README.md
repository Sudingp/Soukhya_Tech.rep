# Soukhya Tech HR Enterprise — Changelog Index

This directory serves as the centralized version history and changelog registry for Soukhya Tech HR Enterprise.

To ensure clarity for different audiences, the changelog is partitioned into two distinct views:

| Document | Target Audience | Scope & Content |
| :--- | :--- | :--- |
| [**`CHANGELOG_ADMIN.md`**](./CHANGELOG_ADMIN.md) | System Administrators, DevOps & Engineers | Full backend architecture, MySQL 8.4 LTS migration, schema DDL, indexing, SHA-256/Bcrypt security, DSA caching, APIs, and administrative controls. |
| [**`CHANGELOG_USER.md`**](./CHANGELOG_USER.md) | Standard Users, Staff & Employees | Frontend features, full-screen viewport layout, interactive login, mode switching, face scan punch-in, and password reset policies. |

---

## Branch & Release Roadmap

```
HR-Enterprise-Prod (v1.0.0) ────────► Initial C# / Java / SQLite baseline
                                            │
                                            ▼
HR-Enterprise-Dev-V1 (v1.1.0) ──────► Java Spring Boot 3 migration & initial ESSL UI
                                            │
                                            ▼
HR-Enterprise-Dev-V2 (v2.0.0) ──────► Pure MySQL 8.4 LTS, Hash-Based Auth, Admin Governance,
                                      DSA LRU Caching, Full-Screen UI, SQLite Elimination
                                            │
                                            ▼
HR-Enterprise-Dev-V3.1 (v3.1.0) ────► Organization Relational Configs, Shift Roster,
                                      Work Codes, Geofences, Biometric Device Management
                                            │
                                            ▼
HR-Enterprise-Dev-V4 (v4.0.0) ──────► 2026 Karnataka Gazette Ingestion, Senior DBA
                                      15-Tier Benchmark Suite, Covering Indexes
                                            │
                                            ▼
HR-Enterprise-Prod (v4.1.0) ────────► Comprehensive Admin & User Mode Segregation,
                                      Employee Self-Service (ESS), Live Geolocation
```

### Version Summaries:

- **v4.1.0 (`HR-Enterprise-Prod`) — [Current Active Branch]**:
  - **RBAC Segregation**: Complete UI and API separation between Administrative Governance and Employee Self-Service (ESS) with role scoping on attendance, leaves, and outdoor duty.
  - **Live Geolocation**: W3C machine GPS capture, Leaflet OpenStreetMap preview, and database coordinate persistence.
  - **Organization Subsystem**: Restored 3NF configuration pipelines across Companies, Branches, Divisions, Cost Centers, Designations, and Department Shifts.
  - **Quality**: 100% compliance with $\le 500$ lines rule across all JS/CSS files; 38/38 integration tests passing (100%).

- **v4.0.0 (`HR-Enterprise-Dev-V4`)**:
  - **Calendar**: Complete ingestion of 53 Karnataka 2026 gazetted and restricted holidays with interactive holiday leave workflow.
  - **Performance**: Senior DBA 15-tier query benchmark suite with covering composite indexes and stored generated column `punch_date`.

- **v3.1.0 (`HR-Enterprise-Dev-V3.1`)**:
  - Shift Calendar, Shift Groups, and 284K-slot Shift Roster Matrix.
  - Organization drawer consolidation for Leave Types, Leave Entries, and Outdoor Entries.

- **v2.0.0 (`HR-Enterprise-Dev-V2`)**:
  - Pure enterprise MySQL 8.4 LTS migration, zero plaintext credentials, role-based auth, DSA caching, and full-viewport responsiveness.

- **v1.0.0 (`HR-Enterprise-Prod`)**:
  - Initial face-api.js webcam scanner and ESSL-style dashboard.
