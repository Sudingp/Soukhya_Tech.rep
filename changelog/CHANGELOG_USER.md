# User Guide & Release Notes — Soukhya Tech HR Enterprise

Welcome to the Soukhya Tech HR Enterprise release notes. This document highlights all visual, interface, and operational improvements designed for everyday users, staff, and employees.

---

## What's New in Version 2.0 (Branch: `HR-Enterprise-Dev-V2`)

### 1. Full-Screen Edge-to-Edge Experience
- **Expanded Layout**: The entire application now adapts dynamically to your display. No more tiny white boxes, awkward horizontal scrollbars, or cut-off tables.
- **Full Viewport Dashboard**: Dashboard metrics, employee registries, company pages, and webcam scanners now comfortably utilize 100% of your monitor's screen space.
- **High-DPI & Multi-Monitor Support**: Cleanly scales on high-resolution laptops, desktop monitors, and wall-mounted attendance tablets.

### 2. Interactive Login & Session Security
- **Modern Login Dialog**:
  - A clean, modern login modal greets you whenever authentication is needed.
  - Quick-test buttons allow instant pre-filling for testing (`🛡️ Admin Preset` / `👤 User Preset`).
- **Real Log Off Feature**:
  - Clicking `[Log Off]` immediately terminates your session, shuts down active webcam camera feeds, clears session storage, and locks the interface.
- **Enterprise Password Reset Policy**:
  - **No Self-Service "Forgot Password"**: To keep staff accounts safe from social engineering and unauthorized account takeovers, self-service password resets are permanently disabled.
  - If you need your password reset or credentials updated, please contact your **System Administrator**.

### 3. Application Mode Switching (Admin Mode vs. User Mode)
- **Status Indicator**: The top header clearly displays your current operational mode:
  - `[🛡️ ADMIN MODE]`: Shows full administrative access.
  - `[👤 USER MODE]`: Shows standard employee self-service mode.
- **Switch Mode Button (`[⇄ Switch Mode]`)**:
  - Easily switch between User and Admin modes at any time with a single click.
- **Dedicated User Mode View**:
  - When logged in as a standard user, complex administrative drawers, company settings, and system configurations are automatically hidden.
  - The interface presents a streamlined, clean view focused directly on **Face Attendance Punch-In** and your personal scan log.

### 4. Lightning-Fast Face Attendance & Live Sync
- **Sub-Second Face Verification**: Instant webcam face alignment with 128-point neural biometric recognition.
- **Duplicate Punch Prevention**: Prevents accidental repeated scans by giving immediate visual feedback and enforcing cooldown protection.
- **Real-Time Live Updates**: Attendance logs and dashboard numbers update live on screen without requiring manual page refreshes.

---

## Historical Version Notes (v1.0.0 — `HR-Enterprise-Prod`)

- **Initial Face Recognition**: Core webcam face attendance punch-in powered by neural networks in the browser.
- **Basic Dashboard**: Initial summary cards for Present, Late, and Hibernate employee statuses.
- **Employee Directory**: Basic table showing staff members, departments, and designations.
