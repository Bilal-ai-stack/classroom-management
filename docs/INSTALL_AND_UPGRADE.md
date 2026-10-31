# ClassroomOS 2.0.0 — Installation, Deployment & Upgrade Guide

## 1. System Requirements

- **Operating System:** Windows 10 (version 1903+) or Windows 11 (64-bit).
- **Runtime:** Python 3.10, 3.11, 3.12, 3.13, or 3.14 (Python 64-bit recommended).
- **RAM:** 4 GB minimum (8 GB recommended for OpenCV photo analysis).
- **Disk Space:** 500 MB free storage for application files and local database.
- **Display:** Responsive display support from 320px (mobile) to 1920px+ (desktop).

---

## 2. Windows Installation Options

### Option A: Portable Standalone Edition (Recommended)
1. Download `ClassroomOS-v2.0.0-Portable-Windows.zip`.
2. Extract the archive to any non-administrator directory (e.g. `C:\ClassroomOS` or `D:\ClassroomOS`).
3. Ensure Python is installed and accessible on your system `PATH` (or create a virtual environment inside `codebase\backend\venv`).
4. Install dependencies if running on a fresh machine:
   ```cmd
   cd codebase\backend
   python -m pip install -r requirements.txt
   ```
5. Double-click `run-desktop.bat`.
6. ClassroomOS starts the process supervisor on `http://127.0.0.1:5000` and automatically opens your default web browser.

### Option B: Inno Setup Windows Installer
1. If using the Inno Setup installer package (`ClassroomOS-Setup-2.0.0.exe`), launch the executable.
2. Select your user installation directory (defaults to `%LOCALAPPDATA%\Programs\ClassroomOS`).
3. Choose whether to create a Desktop shortcut.
4. Click **Install**.
5. The installer configures Start Menu and Desktop shortcuts pointing to `run-desktop.bat`.

---

## 3. Persistent Data Directory & Privacy Isolation

ClassroomOS implements strict isolation between application code and user data:
- **Application Binaries:** Reside in the installation folder or portable directory.
- **User Data Storage:** Persisted in `%LOCALAPPDATA%\ClassroomOS\data\`:
  - `classroom.db`: Primary SQLite relational database.
  - `branding\`: Custom uploaded institution logos (PNG, JPG, SVG).
- **Automatic Backups:** Stored in `%LOCALAPPDATA%\ClassroomOS\backups\`.
- **Application Secrets:** Automatically generated 384-bit cryptographic key saved to `%LOCALAPPDATA%\ClassroomOS\secret.key`.

> **Important:** Reinstalling, upgrading, or deleting the application program folder will **never** delete student records, attendance logs, or institution logos.

---

## 4. First-Time Setup & Administrator Bootstrapping

1. Launch ClassroomOS via `run-desktop.bat`.
2. Click **Sign In** in the top navigation bar.
3. If no user accounts exist, the system enters **Bootstrap Mode**.
4. The first account created via `/api/auth/bootstrap` becomes the **Chief Administrator**.
5. Log in with the newly created administrator credentials.
6. Navigate to **Institutional Settings**:
   - Set Institution Name, Code, and Academic Year.
   - Upload your official School Logo or Crest.
   - Configure academic classes, sections, and room assignments.
   - Provision staff teacher accounts and assign classes.

---

## 5. Upgrade Procedures & Migration Safety

ClassroomOS includes an **automatic transactional migration engine** that guarantees zero data loss when upgrading from legacy schema versions (v0 through v4) to v5:

1. **Automatic Pre-Migration Snapshot:** Before applying any schema changes, ClassroomOS uses SQLite's Online Backup API to create a verified snapshot in `%LOCALAPPDATA%\ClassroomOS\backups\pre-migration-v<version>-<timestamp>.db`.
2. **Transactional DDL:** Schema migrations execute inside database transactions with foreign key enforcement and WAL mode journaling.
3. **Idempotent Migration Verification:** Schema version is tracked in `schema_migrations`. To verify the installed version:
   ```cmd
   cd codebase\backend
   python -m flask db-version
   ```
   Output: `5`

---

## 6. Port Collision & Multi-Instance Handling

If port `5000` is already in use by another application:
1. The launcher supervisor automatically searches loopback ports `5001` through `5050`.
2. Selects the first unoccupied port and outputs:
   `Selected alternate loopback port: 5001`
3. Launches the browser directly to the negotiated port.
4. Bound exclusively to `127.0.0.1` loopback for security.
