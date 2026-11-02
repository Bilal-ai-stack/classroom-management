# Release Notes — ClassroomOS 2.1.0

**Release Tag:** `v2.1.0`  
**Release Date:** November 1, 2026  
**Git Branch:** `feature/classroom-v2.1`  
**Distribution Channel:** Windows Desktop (Portable Standalone ZIP & Inno Setup Executable)  
**Windows Setup Package:** `dist_release/ClassroomOS-Setup-2.1.0.exe`  
**Standalone Portable ZIP:** `dist_release/ClassroomOS-v2.1.0-Portable-Windows.zip`  
**Product Landing Page:** `https://virtualgoal.com/classroomos` / `website/index.html`  
**Final Release Verdict:** **READY FOR PRODUCTION COMMUNITY RELEASE**

---

## 1. Executive Summary

ClassroomOS 2.1.0 is the comprehensive community enhancement release of ClassroomOS, designed to deliver a dependable, sovereign, offline-first, mobile-ready, and professionally distributable classroom management platform for schools, educators, and educational institutions worldwide.

Building upon the solid architecture of v2.0.0, ClassroomOS 2.1 introduces complete administrator editability across all institutional settings, a restrained and sophisticated light theme design system, a full guardian WhatsApp notification module with consent tracking and manual preview dispatches, live database storage metrics with automated point-in-time SQLite backups and pre-restore safety snapshots, complete offline asset independence (eliminating all external CDN fonts), and mobile PWA service worker caching.

The application remains **100% local-first**. It runs natively on Windows 10/11 without requiring Python, Node.js, cloud databases, or hosted AI models, preserving absolute student data privacy and FERPA compliance.

---

## 2. Key Highlights & New Capabilities

### 🏫 1. Complete Admin Panel Editability & State Management
- **Institution Profile:** Complete administrator control over School Name, School Code, Address, Contact Number, Email, and Institution Description, backed by instant SQLite persistence.
- **School Crest & Branding:** Complete upload, preview, replacement, and removal workflows with strict security validation (2MB limit, decompression bomb defense, and vector SVG sanitization) and an embedded vector academic fallback.
- **Classes & Sections Synchronization:** Class and section names can now be edited and renamed. Renaming automatically and transactionally synchronizes enrolled student records, attendance logs, and attendance session snapshots.
- **Academic Terms Management:** Dedicated UI tab and REST API endpoints (`PUT /admin/terms/<id>`, `DELETE /admin/terms/<id>`) allowing creation, editing, date boundary adjustments, and safe deletion of academic terms.
- **Staff Accounts & Password Management:** Administrators can edit teacher and administrator profiles, update assigned classes and sections, toggle account activation, and reset staff passwords with enforced 12+ character alphanumeric complexity.
- **Audit Logging:** All sensitive administrative modifications emit immutable audit events (`admin.institution_update`, `admin.class_update`, `admin.term_update`, `auth.user_update`, `auth.user_password_reset`).

### 🎨 2. Professional UI/UX Light Theme Redesign
- **Institutional Color Palette:** Restrained, sophisticated light theme built around Deep Institutional Navy (`#1E3A8A`), slate neutrals (`#475569`, `#E2E8F0`), muted green (`#15803D`), amber (`#B45309`), and subdued red (`#B91C1C`).
- **Elimination of Generic AI Aesthetics:** Removed oversized colorful cards, decorative emojis, neon accents, and excessive gradients in favor of structured tables, clean cards, and clear visual hierarchy.
- **System Typography:** Zero network dependency font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`), rendering instantly with zero latency or layout shifts.
- **Accessible Contrast:** High-contrast text and interactive states adhering strictly to WCAG AA guidelines.

### 📶 3. Verified 100% Offline-First Architecture
- **No External CDN Dependencies:** Removed external Google Fonts `@import` calls; all stylesheets, icons, and script assets are locally bundled.
- **Local Machine Vision:** Haar Cascade face detection operates exclusively on the local CPU via OpenCV (`haarcascade_frontalface_default.xml`), ensuring zero network transmission of photos.
- **Local Authentication & Persistence:** Token generation, session validation, and SQLite persistence function identically whether connected to the internet or operating on an isolated campus network.

### 💾 4. Database Storage Metrics, Backups & Safe Restoration
- **Live Storage Panel:** Administrators can inspect the active SQLite database path, file size in bytes/megabytes, total backup storage volume, and available local disk space via `shutil.disk_usage`.
- **Verified SQLite Backups:** On-demand backup creation using SQLite's native backup API (`con.backup()`), generating timestamped snapshots under `%LOCALAPPDATA%\ClassroomOS\data\backups` accompanied by SHA-256 verification manifests.
- **Automated Pre-Restore Safety Snapshots:** Restoring a database snapshot automatically takes a pre-restore backup of the current database before executing point-in-time restoration, guaranteeing zero data loss.
- **Authenticated Backup Deletion:** Administrators can safely purge old backup archives with RBAC verification and audit logging.

### 💬 5. Guardian WhatsApp Notification Module
- **Extended Student Portfolio:** Added structured guardian contact fields including Guardian Name, Relationship, International WhatsApp Number (E.164 validated), Consent Status, Consent Timestamp, and Notification Preferences.
- **Manual WhatsApp Dispatch:** One-click *Send WhatsApp* button on student attendance rosters and portfolios opens an interactive preview modal. Teachers can choose between `Absent Today`, `Late Arrival`, or `General Notice` templates, customize the message in real time, and launch WhatsApp Web or Desktop via secure `wa.me` deep links.
- **Manual Dispatch Logging:** Teachers can log dispatch confirmations, recording timestamp, recipient, and message preview into the school audit log without making false assumptions about external network delivery.
- **Automated Cloud API Configuration:** Built-in settings tab for optional WhatsApp Business Cloud API integration (disabled by default), featuring phone number ID, access token storage, template definitions, and a safe interactive simulation test harness.

### 📱 6. Mobile & Progressive Web App (PWA) Readiness
- **Universal Viewport Support:** Tested and verified across 6 viewports (320px, 375px, 430px, 768px, 1366px, 1920px) with zero horizontal overflow.
- **Touch-Friendly Controls:** Enforced ≥ 44×44 px touch targets for buttons, inputs, hamburger toggles, and attendance action switches.
- **PWA Service Worker:** Packaged `manifest.webmanifest` and resilient `sw.js` with Cache-First static asset caching and Network-Only API routing.
- **Real-Time Offline Status Banner:** Visual non-intrusive alert notifying staff when network connectivity changes.

---

## 3. Database Schema Migration 6

The database schema has been incremented to **Version 6** via transactional migration:
- **`institution_settings`:** Added `description` (TEXT), `whatsapp_enabled` (BOOLEAN), `whatsapp_phone_number_id` (VARCHAR), `whatsapp_access_token` (TEXT), `whatsapp_template_absent` (TEXT), and `whatsapp_template_late` (TEXT).
- **`students`:** Added `guardian_name` (VARCHAR), `guardian_relationship` (VARCHAR), `whatsapp_number` (VARCHAR), `whatsapp_consent` (BOOLEAN), `whatsapp_consent_date` (DATETIME), `whatsapp_opt_out` (BOOLEAN), and `notification_preferences` (TEXT).
- **`whatsapp_notifications`:** Created table for tracking dispatches (`id`, `student_id`, `guardian_phone`, `message_type`, `payload`, `status`, `provider_response`, `created_at`, `sent_at`).

All migrations are fully backward-compatible and apply automatically on first launch.

---

## 4. Verification & Testing Matrix

| Test Category | Suite / File | Scope | Status | Result |
| :--- | :--- | :--- | :---: | :---: |
| **Backend Unit & Integration** | `pytest tests/` | 10 test modules (Auth, Attendance, Photo, Institution, Quality, V2.1 Enhancements) | ✅ PASSED | **97 passed in 39.81s** |
| **V2.1 Enhancement Tests** | `test_v21_enhancements.py` | Admin Editability, Terms CRUD, Class Rename Sync, Staff Edit, Storage API, WhatsApp Config & Manual Log | ✅ PASSED | **7/7 passed** |
| **Database Migrations** | `test_database_reliability.py` | Schema v1 through v6 transactional migration and rollback resilience | ✅ PASSED | **Verified** |
| **Frontend Production Build** | `npm run build` | Vite 6 React compilation, chunk optimization, asset hashing | ✅ PASSED | **Built in 1.57s (0 errors)** |
| **Frontend Static Analysis** | `npm run lint` | Oxlint fast AST validation across all JSX and JS files | ✅ PASSED | **0 warnings, 0 errors** |
| **Playwright Responsive E2E** | `e2e-responsive.mjs` | 6 viewports (320px, 375px, 430px, 768px, 1366px, 1920px), zero overflow, touch targets | ✅ PASSED | **6/6 passed** |
| **Standalone Packaging** | `build-release.ps1` | PyInstaller native Windows compilation + Inno Setup installer compilation | ✅ PASSED | **Generated** |

---

## 5. Standalone Release Artifacts

Release artifacts generated in `dist_release/`:

1. **`ClassroomOS-Setup-2.1.0.exe`**
   - Full graphical Windows Setup Wizard compiled via Inno Setup 6.
   - Installs to `%LOCALAPPDATA%\Programs\ClassroomOS`.
   - Automatically preserves `%LOCALAPPDATA%\ClassroomOS\data` across upgrades and uninstalls.
2. **`ClassroomOS-v2.1.0-Portable-Windows.zip`**
   - Standalone portable archive containing the complete PyInstaller distribution and `run-desktop.bat`.
   - Requires zero installation; unpack and run from any directory or USB drive.
3. **`dist_release/SHA256SUMS.txt`**
   - Cryptographic manifest containing SHA-256 verification hashes for all distribution files.

---

## 6. Upgrade & Migration Instructions

Upgrading from ClassroomOS v2.0.0 (or v1.x) to v2.1.0 is completely seamless:
1. Close any running instance of ClassroomOS.
2. Run `ClassroomOS-Setup-2.1.0.exe` (or unpack `ClassroomOS-v2.1.0-Portable-Windows.zip`).
3. Launch ClassroomOS. The migration engine automatically detects existing database files under `%LOCALAPPDATA%\ClassroomOS\data\classroom.db` and applies Migration 6 without modifying or losing student records.
4. Verify updated settings in **Admin Settings → Institution Profile** and **Storage & Backups**.

---

## 7. Security, Privacy & Ethics Statement

- **Zero Biometrics:** ClassroomOS does not collect, analyze, or store facial recognition templates, face embeddings, or unique biological markers.
- **Data Sovereignty:** All student demographic information, attendance histories, guardian contacts, and administrative audit logs are stored strictly on the local machine in standard SQLite format.
- **Guardian Privacy:** WhatsApp messaging requires explicit consent tracking and international phone number validation. Manual messaging utilizes verified client deep links, preventing unintended data leaks to third-party tracking services.
- **Open Standards:** Built on open technologies (React, Flask, SQLite, OpenCV) with full audit logging and offline resilience.

