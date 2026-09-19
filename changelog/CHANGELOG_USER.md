# User Guide & Release Notes — Soukhya Tech HR Enterprise

Welcome to the Soukhya Tech HR Enterprise release notes. This document highlights all visual, interface, and operational improvements designed for everyday users, staff, and employees.

---

## What's New in Version 4.0 (Branch: `HR-Enterprise-Dev-V4` / `HR-Enterprise-Prod`)

### 1. Official Karnataka High Court 2026 Holiday Calendar & Smart Leave
- **41 Official State Holidays**: Access the complete Karnataka 2026 gazette with 20 Mandatory General Holidays and 21 Restricted / Optional Holidays (RH).
- **Smart Holiday Leave Application**: When applying for leave, select a holiday directly from the new dropdown list (`#la-holiday-id`). The system automatically sets the date, preselects Restricted Holiday (`LT_RH`) or Casual Leave (`LT_CL`), and handles quota calculations.
- **Dynamic Holiday Badges**: View live visual badges for General Gazetted vs. Restricted holidays across shift schedules and calendar days.

### 2. High-Performance Organization Masters & Multi-Company Directory
- **Unified Master Management**: Manage Companies, Divisions, Cost Centers, Designations, Branches, Geofences, Shifts, Shift Groups, and Biometric Devices from responsive, dedicated modals.
- **Instant Search on 10,000+ Staff**: Search, filter, and paginate across 10,100 employee profiles with sub-millisecond responsiveness.

### 3. Real-Time Overtime & Shift Rostering
- **Automated Overtime Calculation**: Overtime calculations accurately calculate standard vs. weekly-off and public holiday wage rates (1.5x / 2.0x).
- **Monthly Shift Matrix**: View and manage shift schedules across all departments with zero lag.

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
