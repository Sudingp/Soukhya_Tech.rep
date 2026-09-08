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
                                      DSA LRU Caching, Full-Screen UI, Complete SQLite Elimination
```

### Version Summaries:

- **v2.0.0 (`HR-Enterprise-Dev-V2`) — [Current Active Branch]**:
  - **Database**: Pure enterprise MySQL 8.4 LTS with InnoDB, native JSON biometrics, composite indexes, connection pooling, and complete removal of SQLite.
  - **Authentication**: Zero plaintext credentials (SHA-256 username hash + Bcrypt password hash), session revocation, and JWT token blacklist.
  - **Governance**: Real-time mode switching (Admin Mode vs. User Mode) and admin-governed password resets (no self-service forgot password).
  - **Performance**: DSA Doubly-Linked-List LRU Cache, Prefix Trie, Server-Sent Events (SSE) live sync.
  - **Frontend UI**: Full-viewport responsiveness, interactive login modal, mode switcher, and role-aware changelog modal.
  - **DevOps**: Single-command startup (`npm start`) with auto-starting MySQL daemon.

- **v1.1.0 (`HR-Enterprise-Dev-V1`)**:
  - Replaced C# .NET 8 backend with Java Spring Boot 3 backend.
  - SQLite schema migrations v1 to v5 with JPA/Hibernate compatibility.

- **v1.0.0 (`HR-Enterprise-Prod`)**:
  - Initial face-api.js webcam scanner and ESSL-style dashboard.
