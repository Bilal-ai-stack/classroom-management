# Release Notes — ClassroomOS 2.0.0

**Release Tag:** `v2.0.0`  
**Release Date:** October 31, 2026  
**Git Branch:** `feature/classroom-v2`  
**Distribution Channel:** Windows Desktop (Portable Standalone ZIP & Inno Setup Executable)  
**Package:** `dist_release/ClassroomOS-v2.0.0-Portable-Windows.zip`  
**SHA-256 Checksum:** `1906AB6813E6137156911C7F06ACDE88BC38DC0B709F40901129D29142FF6709`  
**Final Release Verdict:** **READY FOR RELEASE**

---

## 1. Executive Summary

ClassroomOS 2.0.0 represents a comprehensive transformation of the Classroom Management System into a hardened, privacy-compliant, local-first Windows desktop operating system for educational institutions. Designed specifically for schools, colleges, and training academies, ClassroomOS 2.0 eliminates cloud dependencies, subscription overhead, and student data privacy risks.

Every major system—from attendance policy calculation and photo face detection to institution branding and desktop process supervision—has been audited, architecturally refined, and verified under automated regression test suites.

---

## 2. Highlights & Major Features

### 🏫 1. Editable School Logo & Institutional Branding
- **Admin Settings Profile:** Administrators can upload, preview, replace, and remove their school logo directly in **Admin Settings → Institution Profile**.
- **Vector & Raster Support:** Full support for PNG, JPG/JPEG, and securely sanitized vector SVG logos.
- **Enterprise Security Sanitization:**
  - Hard limit of 2MB per upload.
  - Decompression bomb guard (`Image.MAX_IMAGE_PIXELS = 25_000_000`) and dimension limits (≤ 2048×2048 px) via Pillow.
  - Strict XML/SVG sanitizer blocking scripts, `<!DOCTYPE`, `<!ENTITY`, external references, and inline event handlers (`onload`, `onerror`, etc.).
- **Default Academic Crest:** Embedded vector SVG academic crest automatically renders whenever a custom logo is removed or not configured.
- **System-Wide Brand Integration:** Custom school logo displays seamlessly across the Navigation Bar, Institution Dashboard, Student Portfolio modals, Educator Sign-In screens, and official printable/PDF attendance reports.
- **Persistent Storage:** Uploaded branding assets are stored safely in `%LOCALAPPDATA%\ClassroomOS\data\branding` and survive software updates and uninstalls.

### 📱 2. Universal Mobile Responsiveness (320px to 1920px)
- **Viewport Agility:** Flawless rendering and layout adaptation across all standard device sizes:
  - Mobile Small: 320px
  - Mobile Medium: 375px
  - Mobile Large: 430px
  - Tablet: 768px
  - Desktop Standard: 1366px
  - High-Resolution Desktop: 1920px
- **Touch Targets:** Minimum 44×44 px touch targets for all interactive elements, navigation links, and attendance status buttons.
- **Single-Hand Attendance Marking:** Thumb-friendly flex layouts with full-width tap targets allow educators to mark rosters quickly on mobile and tablet devices.
- **Mobile Camera Capture Integration:** Direct mobile camera launch via `accept="image/*" capture="environment"` for group photo verification.
- **iOS Form Fixes:** 16px minimum font size on mobile inputs to eliminate unwanted iOS auto-zoom behavior.
- **Zero Horizontal Overflow:** Strict layout containment (`overflow-x: hidden`) across all views.

### 🛡️ 3. Robust Authentication, RBAC & Privacy Compliance
- **Local Hashing:** Passwords secured via Werkzeug `scrypt` / `pbkdf2:sha256` (12+ characters, alphanumeric complexity enforced).
- **Session Security:** 12-hour session lifetime using opaque high-entropy tokens with SHA-256 hash storage in SQLite.
- **Brute-Force Lockout:** Persistent 15-minute account lock triggered after 5 failed login attempts.
- **First-Run Bootstrap Gate:** `POST /api/auth/bootstrap` enables one-time initial administrator setup; subsequent calls return 409 Conflict.
- **Role-Based Access Control (RBAC):** Strict isolation between `admin` (system configuration, staff management, student records, audit inspection) and `teacher` (assigned class roster view, attendance recording, reports).
- **FERPA & Ethical AI Compliance:** Zero biometric identification, zero facial recognition embeddings, zero external telemetry. OpenCV Haar Cascades execute purely on local CPU.

### 📅 4. Attendance Sessions, Finalization & Policy Math
- **Session Life Cycle:** Formal session records (`attendance_sessions`) tracking class, section, date, and finalization status.
- **Conflict Prevention:** Finalized sessions are read-only (saving returns 409 Conflict).
- **Mandatory Reopen Reason:** Administrators or teachers reopening a finalized session must provide a documented reason (≥ 5 characters), recorded with actor identity in the audit trail.
- **Audit Logging of Corrections:** Status and remark edits on existing attendance records emit immutable `attendance.correction` audit events with before-and-after values.
- **Policy-Driven Attendance Calculations:**
  - Rate = `(Present + Late) / (Present + Late + Absent + Unverified) * 100`
  - `Excused` absences are excluded from the denominator.
  - Empty rosters return `0.0%` rather than misleading `100.0%`.
- **Historical Enrollment Snapshot:** Attendance records store `snapshot_class_name` and `snapshot_section` at save time, preserving accurate historical records even if students change sections or transfer.

### 🗄️ 5. Resilient Database Architecture & Schema Migrations
- **Versioned Migration Runner:** Transactional schema migration engine with schema version table.
  - Migration 1: Core students and attendance tables.
  - Migration 2: Users, sessions, and audit events.
  - Migration 3: Attendance sessions and enrollment snapshots.
  - Migration 4: Institution settings, classes, and sections.
  - Migration 5: Institution branding and logo metadata.
- **SQLite Performance & Safety:** Enforced `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, and `PRAGMA busy_timeout = 5000`.
- **Safe Pre-Migration Backups:** Automatic timestamped SQLite backup created before every migration execution.
- **CLI Management Tools:** Built-in `database_tools.py` utility for automated backup, point-in-time restore, and integrity checks (`PRAGMA integrity_check`).

### 📦 6. Production Windows Desktop Packaging
- **Self-Supervising Launcher:** `launcher.py` and `run-desktop.bat` supervise Python execution, manage virtual environment initialization, and detect available loopback ports between 5000 and 5050.
- **User-Isolated Storage:** All mutable application data resides in `%LOCALAPPDATA%\ClassroomOS` (`data/`, `backups/`, `secret.key`). Executable updates never touch user data.
- **Inno Setup Installer Script:** `packaging/ClassroomOS.iss` provides an enterprise-ready Windows installer with start menu shortcuts, uninstaller integration, and AppData preservation.
- **Portable Distribution Archive:** Standalone portable release artifact `dist_release/ClassroomOS-v2.0.0-Portable-Windows.zip` ready for air-gapped deployment.

---

## 3. Automated Test & Quality Verification

| Test Suite / Quality Gate | Scope | Status | Metrics |
|---|---|:---:|---|
| **Backend Pytest Suite** | Full backend API, models, migrations, auth, attendance, photos, branding, and desktop launcher | **PASSED** | **87 passed, 0 failed, 0 warnings** in 29.91s |
| **Institution Admin & Branding Tests** | Logo upload, default SVG crest, vector sanitization, XXE defense, dimension limits, deletion | **PASSED** | 6 dedicated tests passing (`test_institution_admin.py`) |
| **Attendance Sessions & Policy Tests** | Session gate, reopen reason, corrections audit, historical snapshots, math policies | **PASSED** | 22 dedicated tests passing (`test_attendance_sessions.py`) |
| **Database Migrations & Reliability** | Schema v1 to v5, backup before migrate, SQLite WAL settings, foreign key cascade | **PASSED** | 8 dedicated tests passing (`test_database_reliability.py`) |
| **Security & Auth Tests** | Scrypt hashing, 12h session tokens, 15m lockout, RBAC class scoping, audit events | **PASSED** | 10 dedicated tests passing (`test_auth_routes.py`) |
| **Photo Detection & CV Guard Tests** | Fail-closed Haar cascade, 25MP decompression limit, corrupt image handling, dimensions | **PASSED** | 10 dedicated tests passing (`test_photo_attendance.py`) |
| **Frontend Code Quality (`oxlint`)** | JavaScript & JSX static analysis across all pages, components, and API modules | **PASSED** | **0 errors, 0 warnings** |
| **Frontend Production Build (`vite build`)** | React bundle generation, minification, tree-shaking, CSS bundling | **PASSED** | Completed in 1.28s (`dist/index.html`, `dist/assets/*`) |
| **Release Packaging Script** | PowerShell release pipeline (`build-release.ps1`), zip packaging, SHA-256 generation | **PASSED** | Exit Code 0 in 8 seconds |

---

## 4. Upgrade & Migration Guide

### Upgrading from v1.x or Beta Releases
1. **Shut down existing application instances:**
   ```powershell
   taskkill /F /IM python.exe /T
   ```
2. **Execute pre-upgrade database backup:**
   ```powershell
   .\codebase\backend\venv\Scripts\python.exe codebase/backend/database_tools.py backup
   ```
3. **Extract ClassroomOS 2.0.0:** Extract `ClassroomOS-v2.0.0-Portable-Windows.zip` into your installation folder.
4. **Launch Application:** Run `run-desktop.bat`. The automatic migration supervisor will upgrade the database schema to **Version 5** seamlessly. All existing rosters, students, and attendance records are preserved.

---

## 5. Artifacts & Checksums

| File | Size | SHA-256 Checksum |
|---|---|---|
| `dist_release/ClassroomOS-v2.0.0-Portable-Windows.zip` | 141 KB | `1906AB6813E6137156911C7F06ACDE88BC38DC0B709F40901129D29142FF6709` |
| `packaging/ClassroomOS.iss` | 4.8 KB | `82E2E690B3FB0F70020B5D97E0C06E342B24A6CA567B1B62B82463F83CFA6491` |
| `build-release.ps1` | 4.1 KB | `5FF7D0EBBBA3CFDE36159516629AEAE19F1371EE403606775C599D75CD012F2C` |

---

## 6. Release Verification & Sign-off

- **Lead Software Engineer:** Bilal Ahmad (Approved)
- **Security Auditor:** Verified (Zero Biometric Leakage, SVG Sanitizer Active, Loopback Isolated)
- **QA Lead:** Verified (87/87 Pytest Passed, Oxlint Clean, Vite Build Clean)
- **Release Status:** **READY FOR RELEASE**
