# Classroom Management System — Kanban Board

**Project Type:** GitHub Projects (Kanban Board)  
**Methodology:** Agile Kanban with Work-In-Progress (WIP) limits  
**Board URL:** `https://github.com/Bilal-ai-stack/classroom-management/projects`

## Classroom Management System 2.1.1 — Active Release Lane

The evidence-backed roadmap is maintained in `docs/CODEX_AUDIT.md` and execution results in `docs/CODEX_PROGRESS.md`.

- [x] Audit repository, baseline tests/build, and document architecture decisions.
- [x] Reject invalid attendance atomically; remove fabricated photo detections.
- [x] P0: versioned migrations (v1-v6) and tested backup/restore gate.
- [x] P0: persistent authentication, secure bootstrap, RBAC, and route scoping.
- [x] P0: deterministic, hardened local photo pipeline tests.
- [x] P1: configurable institution/admin model, branding logo upload/sanitization, and UI.
- [x] P2: reporting, portfolios, privacy/retention, mobile responsiveness (320px-1920px), accessibility and offline resilience.
- [x] P3: verified Windows packaging (portable zip, Inno Setup), upgrade, restore, and uninstall flow.
- [x] P0: Complete Admin Panel Editability (profile, terms, classes/sections rename sync, staff edit & password reset).
- [x] P1: UI/UX Professional Redesign (institutional light theme `#1E3A8A`, system typography, zero external CDN fonts).
- [x] P1: Database Storage Metrics, Backups & Point-in-Time Safe Restoration with pre-restore safety snapshot.
- [x] P1: Guardian WhatsApp Notification Module (consent, manual deep-link preview modal, automated Cloud API sandbox).
- [x] P2: Mobile & PWA Offline Readiness (`manifest.webmanifest`, `sw.js`, offline indicator banner).
- [x] P3: Community Packaging & Product Landing Website (`virtualgoal.com/classroomos`).
- [x] **P0: Student Photograph Persistence Lifecycle (v2.1.1)** (registration photo upload, portfolio modal replacement/deletion, Pillow format & size validation, in-memory `io.BytesIO` streaming, zero Windows file locking, SVG fallback avatar).
- [x] **P0: Complete C: and D: Storage Management (v2.1.1)** (independent installation and persistent data directories, Inno Setup `CreateInputDirPage`, `storage_manager.py` resolution hierarchy, live metrics dashboard, safe verified migration with automatic rollback).
- [x] **P1: Professional Windows Launching (v2.1.1)** (PyInstaller windowed GUI subsystem `console=False`, elimination of Command Prompt window, `SafeOutputLogger`, native MessageBox error dialogs, loopback server readiness polling, in-app Exit button).
- [x] **P0: Production Release Packaging & Verification (v2.1.1)** (`ClassroomOS-Setup-2.1.1.exe`, `ClassroomOS-v2.1.1-Portable-Windows.zip`, SHA-256 manifests, clean install lifecycle verification, packaged Playwright E2E testing).

---

## Kanban Board Overview

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   📋 Backlog    │ 🎯 Ready (To Do)│ 🚧 In Progress  │ 👀 In Review/PR │     ✅ Done     │
│                 │   (WIP Max: 3)  │   (WIP Max: 2)  │   (WIP Max: 2)  │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │ • Issues #2-#20 │
│                 │                 │                 │                 │ • Issue #21     │
│                 │                 │                 │                 │ • Issue #22     │
│                 │                 │                 │                 │ • Issue #23     │
│                 │                 │                 │                 │ • Issue #24     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## Column Definitions & Policies

### 1. 📋 Backlog (Future Work)
- **Policy:** Contains scoped issues not yet scheduled for immediate development.
- **Current Cards:** All primary roadmap epics for v2.1.1 completed!

### 2. 🎯 Ready / To Do (WIP Limit: 3)
- **Policy:** Clear acceptance criteria defined, dependencies resolved, ready for immediate assignment.
- **Current Cards:** None

### 3. 🚧 In Progress (WIP Limit: 2)
- **Policy:** Actively being coded on the designated feature branch.
- **Current Cards:** None

### 4. 👀 In Review / PR (WIP Limit: 2)
- **Policy:** Code complete, tests passing locally, PR opened against `develop`.
- **Review Checklist:**
  - [x] Linting & automated CI pass
  - [x] No biometric recognition code introduced (ethical policy)
  - [x] Tested on Windows / PowerShell
  - [x] 100% Offline verification (zero external CDN or cloud dependencies)

### 5. ✅ Done
- **Policy:** PR reviewed, approved, merged, acceptance criteria verified.
- **Cards on GitHub:**
  - [x] `[#2]` [Epic] Backend Foundation & Student CRUD API *(Phase 1 / Milestone 1)*
  - [x] `[#3]` [Epic] React + Vite Frontend Scaffolding & Light UI Design System *(Phase 1 / Milestone 1)*
  - [x] `[#4]` [Feature] Student Management & Portfolio View *(Phase 1 / Milestone 1)*
  - [x] `[#5]` [Epic] Attendance Data Model & Bulk REST Endpoints *(Phase 2 / Milestone 2)*
  - [x] `[#6]` [Feature] Daily Attendance Roster UI *(Phase 2 / Milestone 2)*
  - [x] `[#7]` [Feature] Attendance Analytics & Reports *(Phase 2 / Milestone 2)*
  - [x] `[#8]` [Epic] Local Face Detection Service (OpenCV) *(Phase 3 / Milestone 3)*
  - [x] `[#9]` [Feature] Teacher Photo-Verification Review Screen *(Phase 3 / Milestone 3)*
  - [x] `[#10]` [Testing] Backend Pytest Suite & Validation Hardening *(Phase 4 / Milestone 4)*
  - [x] `[#11]` [Documentation & Infra] Complete Setup Guide, Docker Compose & Docker Hub CI/CD *(Phase 4 / Milestone 4)*
  - [x] `[#12]` [Feature] Editable School Logo & Institutional Branding *(Phase 4 / Release Execution)*
  - [x] `[#13]` [Feature] Universal Mobile Responsiveness (320px–1920px) & Touch Attendance UI *(Phase 4 / Release Execution)*
  - [x] `[#14]` [DevOps & Packaging] Windows Desktop Portable Build & Inno Setup Release *(Phase 4 / Release Execution)*
  - [x] `[#15]` [Epic] Complete Admin Settings Panel Editability & State Management *(v2.1.0)*
  - [x] `[#16]` [Design] Professional UI/UX Light Theme & System Typography Redesign *(v2.1.0)*
  - [x] `[#17]` [Feature] Database Storage Panel, Verified Backups & Safe Pre-Restore Snapshots *(v2.1.0)*
  - [x] `[#18]` [Feature] Guardian WhatsApp Notification Module (Consent, Manual wa.me Preview, Cloud API Sandbox) *(v2.1.0)*
  - [x] `[#19]` [PWA & Offline] Service Worker Cache & Real-Time Offline Banner *(v2.1.0)*
  - [x] `[#20]` [Release] Packaging Pipeline (Setup Exe, Portable Zip, SHA256SUMS, Product Landing Page) *(v2.1.0)*
  - [x] `[#21]` [Feature] Student Photograph Persistence Lifecycle & Pillow Validation *(v2.1.1)*
  - [x] `[#22]` [Feature] Complete C: and D: Storage Management, Custom Inno Page & Verified Migration *(v2.1.1)*
  - [x] `[#23]` [Desktop] Clean Windowed Windows Launcher (Zero Command Prompt Window) & Loopback Exit *(v2.1.1)*
  - [x] `[#24]` [Release] ClassroomOS 2.1.1 Production Installer, Standalone Portable ZIP & Checksums *(v2.1.1)*
