# ClassroomOS 2.1.0 — Installation, Deployment & Upgrade Guide

## 1. System Requirements

- **Operating System:** Windows 10 (version 1903+) or Windows 11 (64-bit).
- **Runtime:** **Zero prerequisites required.** Self-contained standalone Python 3.14 + OpenCV + React 19 SPA bundled in PyInstaller distribution. (Developers can use Python 3.10–3.14).
- **RAM:** 2 GB minimum (4 GB recommended).
- **Disk Space:** 250 MB free storage for application files and local database.
- **Display:** Responsive display support from 320px (mobile) to 1920px+ (desktop).
- **Network:** 100% offline-ready. Internet connection is completely optional (used only for WhatsApp Web redirection or optional Cloud API).

---

## 2. Windows Installation Options

### Option A: Inno Setup Windows Installer (Recommended)
1. Download and run `dist_release/ClassroomOS-Setup-2.1.0.exe`.
2. Select your user installation directory (defaults to `%LOCALAPPDATA%\Programs\ClassroomOS`).
3. Check the option to create a Desktop icon if desired.
4. Click **Install**. The installer deploys the standalone runtime (`ClassroomOS.exe` + embedded Python 3.14 + OpenCV + React SPA).
5. Click **Finish**. ClassroomOS launches automatically in your default browser at `http://127.0.0.1:5000`.
6. To launch subsequently, use the Desktop icon or Windows Start Menu entry **ClassroomOS**.

### Option B: Standalone Portable ZIP Edition
1. Download `dist_release/ClassroomOS-v2.1.0-Portable-Windows.zip`.
2. Extract the archive to any folder (e.g. `C:\ClassroomOS`, a USB drive, or an air-gapped machine).
3. **No prerequisites required:** Python, Node.js, and external runtimes are **not** needed. All libraries and binaries are bundled.
4. Double-click `ClassroomOS.exe` (or `run-desktop.bat`).
5. ClassroomOS launches the process supervisor on `http://127.0.0.1:5000` and opens your browser.

---

## 3. Persistent Data Directory & Privacy Isolation

ClassroomOS implements strict isolation between application code and user data:
- **Application Binaries:** Reside in the installation folder or portable directory.
- **User Data Storage:** Persisted in `%LOCALAPPDATA%\ClassroomOS\data\`:
  - `classroom.db`: Primary SQLite relational database.
  - `branding\`: Custom uploaded institution logos (PNG, JPG, SVG).
  - `backups\`: Timestamped database snapshots and SHA-256 manifests.
- **Application Secrets:** Automatically generated 384-bit cryptographic key saved to `%LOCALAPPDATA%\ClassroomOS\secret.key`.

> **Important:** Reinstalling, upgrading, or deleting the application program folder will **never** delete student records, attendance logs, or institution logos.

---

## 4. First-Time Setup & Administrator Bootstrapping

1. Launch ClassroomOS via `run-desktop.bat` or the desktop shortcut.
2. Click **Sign In** in the top navigation bar.
3. If no user accounts exist, the system enters **Bootstrap Mode**.
4. The first account created via `/api/auth/bootstrap` becomes the **Chief Administrator**.
5. Log in with the newly created administrator credentials.
6. Navigate to **Admin Settings**:
   - **Institution Profile:** Set Institution Name, Code, Contact, Email, and Description.
   - **Branding:** Upload your official School Logo or Crest.
   - **Classes & Sections:** Configure academic classes, sections, and room assignments.
   - **Academic Terms:** Set start and end dates for academic semesters.
   - **Staff Management:** Provision staff teacher accounts, assign classes, and manage passwords.
   - **Storage & Backups:** View database size and create an on-demand verified backup.

---

## 5. Upgrade Procedures & Migration Safety (v2.0.0 to v2.1.0)

ClassroomOS includes an **automatic transactional migration engine** that guarantees zero data loss when upgrading from legacy schema versions (v0 through v5) to v6:

1. **Automatic Pre-Migration Snapshot:** Before applying any schema changes, ClassroomOS uses SQLite's Online Backup API to create a verified snapshot in `%LOCALAPPDATA%\ClassroomOS\data\backups\pre-migration-v<version>-<timestamp>.db`.
2. **Transactional DDL:** Schema migrations execute inside database transactions with foreign key enforcement and WAL mode journaling.
3. **Migration 6:** Automatically adds `description`, WhatsApp settings columns to `institution_settings`, guardian/consent columns to `students`, and provisions the `whatsapp_notifications` table.
4. **Idempotent Verification:** Schema version is tracked in `schema_migrations`. Current schema version is `6`.

---

## 6. Port Collision & Multi-Instance Handling

If port `5000` is already in use by another application:
1. The launcher supervisor automatically searches loopback ports `5001` through `5050`.
2. Selects the first unoccupied port and outputs:
   `ClassroomOS running on http://127.0.0.1:<port>`
3. Automatically opens the default web browser to the allocated loopback port.
