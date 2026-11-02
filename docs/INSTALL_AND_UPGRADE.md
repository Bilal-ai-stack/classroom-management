# ClassroomOS 2.1.1 — Installation, Deployment & Upgrade Guide

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
1. Download and run `dist_release/ClassroomOS-Setup-2.1.1.exe`.
2. **Select Program Installation Folder:** Choose where program binaries reside (e.g. `C:\Users\<User>\AppData\Local\Programs\ClassroomOS` or `D:\Programs\ClassroomOS`).
3. **Select Persistent Application Data Directory:** Choose where your persistent database, student photographs, and backups will reside (e.g. `D:\ClassroomOSData` or the default `%LOCALAPPDATA%\ClassroomOS\data`).
4. Check the option to create a Desktop icon if desired.
5. Click **Install**. The installer deploys the standalone runtime (`ClassroomOS.exe` + embedded Python 3.14 + OpenCV + React SPA) and configures your storage directory.
6. Click **Finish**. ClassroomOS launches automatically in your default browser at `http://127.0.0.1:5000` through a clean graphical windowed experience without an exposed Command Prompt window.
7. To launch subsequently, use the Desktop icon or Windows Start Menu entry **ClassroomOS**.

### Option B: Standalone Portable ZIP Edition
1. Download `dist_release/ClassroomOS-v2.1.1-Portable-Windows.zip`.
2. Extract the archive to any folder (e.g. `D:\ClassroomOS`, a USB drive, or an air-gapped machine).
3. **No prerequisites required:** Python, Node.js, and external runtimes are **not** needed. All libraries and binaries are bundled.
4. Double-click `ClassroomOS.exe` (or `run-desktop.bat`).
5. ClassroomOS launches the process supervisor on `http://127.0.0.1:5000` and opens your browser directly.

---

## 3. Persistent Data Directory & Storage Management (C: vs D: Drives)

ClassroomOS 2.1.1 implements complete separation between application binaries and persistent user data:
- **Application Binaries:** Reside in the installation folder or portable directory.
- **Persistent Data Directory (`<DATA_DIR>`):**
  Can be configured on `C:`, `D:`, or any secondary volume:
  - `classroom.db`: Primary SQLite relational database.
  - `photos/students/`: Student portrait photographs (JPEG, PNG, WEBP; resized to max 1024px).
  - `branding/`: Custom uploaded institution logos (PNG, JPG, SVG).
  - `backups/`: Timestamped database snapshots and SHA-256 manifests.
  - `logs/`: Application diagnostics and launcher log (`launcher.log`).
- **Application Secrets:** Automatically generated 384-bit cryptographic key saved to `%LOCALAPPDATA%\ClassroomOS\secret.key`.

### Path Resolution Priority
The backend resolves the data directory via `storage_manager.py` using the following hierarchy:
1. `CLASSROOM_DATA_DIR` environment variable (for testing or scripted environments).
2. `{app}\storage_config.json` (written during Inno Setup installation).
3. Windows Registry: `HKCU\Software\ClassroomOS\DataDir`.
4. Default fallback: `%LOCALAPPDATA%\ClassroomOS\data`.

### Relocating Data Directory Post-Installation
Administrators can relocate their persistent data directory at any time:
1. Log in to ClassroomOS as an administrator.
2. Navigate to **Admin Settings > Database & Backups**.
3. Under **Persistent Data Directory & Drive Selection**, enter the target directory (e.g. `D:\ClassroomOSData`).
4. Click **Migrate Data Directory**. ClassroomOS will:
   - Validate target path accessibility and disk space.
   - Atomically copy all database records, student photos, branding assets, and backups.
   - Verify SQLite integrity and SHA-256 database checksums.
   - Update configuration to use the new directory.

### Temporary C: Drive Space Usage
While all permanent student records, photos, and databases reside on the selected data drive, the following items may temporarily consume space on `C:` during runtime:
- **Web Browser Cache:** Chrome, Edge, or Brave store transient cached HTML/CSS/JS in `%LOCALAPPDATA%\Google\Chrome` or `%LOCALAPPDATA%\Microsoft\Edge`.
- **Operating System Temp Files:** Windows temp files (`%TEMP%`) during active installer execution.
- **Windows User Registry:** Minor registry configuration under `HKCU\Software\ClassroomOS`.

---

## 4. First-Time Setup & Administrator Bootstrapping

1. Launch ClassroomOS via the desktop shortcut or `ClassroomOS.exe`.
2. Click **Setup Administrator** in the top navigation bar.
3. If no user accounts exist, the system enters **Bootstrap Mode**.
4. Create the initial root administrator account (Full Name, Email, Password 12+ characters).
5. Log in with the newly created administrator credentials.
6. Navigate to **Admin Settings**:
   - **School Profile & Branding:** Set Institution Name, Code, Contact, Email, Description, and Logo.
   - **Classes & Sections:** Configure academic classes, sections, and room assignments.
   - **Academic Terms:** Set start and end dates for academic semesters.
   - **Staff Accounts:** Provision staff teacher accounts, assign classes, and manage passwords.
   - **Database & Backups:** View database size, student photos count, total application data, host disk free space, and create on-demand verified backups.

---

## 5. Upgrade Procedures & Migration Safety

ClassroomOS includes an **automatic transactional migration engine** that guarantees zero data loss when upgrading:
1. **Automatic Pre-Migration Snapshot:** Before applying schema updates, ClassroomOS takes a point-in-time verified snapshot in `<DATA_DIR>/backups/pre-migration-v<version>-<timestamp>.db`.
2. **Transactional DDL:** Schema updates execute inside transactions with foreign key enforcement and WAL mode journaling.
3. **Non-Destructive Installer:** Running `ClassroomOS-Setup-2.1.1.exe` over an existing installation updates program binaries while preserving `<DATA_DIR>`, database records, photos, and encryption keys.
4. **Uninstaller Safety:** The uninstaller cleanly removes program files and registry entries, but strictly preserves your database, photographs, and backups.

---

## 6. Port Collision & Multi-Instance Handling

If port `5000` is already in use by another application:
1. The launcher supervisor automatically searches loopback ports `5001` through `5050`.
2. Selects the first unoccupied port and starts the server.
3. If another ClassroomOS instance is already running on the port, the launcher directs the browser to the existing session without starting duplicate processes.
