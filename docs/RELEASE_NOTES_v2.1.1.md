# Release Notes — ClassroomOS 2.1.1

**Release Tag:** `v2.1.1`  
**Release Date:** November 2, 2026  
**Git Branch:** `feature/classroom-v2.1.1`  
**Distribution Channel:** Windows Desktop (Portable Standalone ZIP & Inno Setup Graphical Installer)  
**Windows Setup Package:** `dist_release/ClassroomOS-Setup-2.1.1.exe`  
**Standalone Portable ZIP:** `dist_release/ClassroomOS-v2.1.1-Portable-Windows.zip`  
**Final Release Verdict:** **READY FOR PRODUCTION COMMUNITY RELEASE**

---

## 1. Executive Summary

ClassroomOS 2.1.1 is a targeted maintenance and enhancement release resolving three release-blocking desktop usability issues identified in the v2.1.0 release:

1. **Student Photograph Persistence:** Corrects the entire photo lifecycle—supporting photo selection during enrollment, in-modal photo upload, replacement, and deletion from student portfolios and edit modals, Pillow-based format/size validation, and resilient persistent file storage outside SQLite with in-memory streaming to eliminate Windows file locking.
2. **Complete C: and D: Storage Management:** Enables educational institutions to install program binaries on `C:` while designating persistent data (database, photographs, logos, and backups) on `D:` or any secondary partition. Introduces `storage_manager.py` with multi-tier path resolution, storage metrics, live disk space monitoring, and safe verified migration with automatic rollback.
3. **Professional Windows Launching (No Command Prompt):** Eliminates the exposed Command Prompt window when launching `ClassroomOS.exe` by compiling with PyInstaller's GUI windowed subsystem (`console=False`), redirecting stdout/stderr safely to `<DATA_DIR>/logs/launcher.log`, adding native Windows error message dialogs, single-instance detection, server readiness polling before opening the browser, and an in-app "Exit" button backed by a secure loopback shutdown endpoint.

All existing student records, administrator credentials, database migrations, and offline-first capabilities are preserved.

---

## 2. Key Highlights & New Capabilities

### 📸 1. Student Photograph Persistence & Management
- **Full Lifecycle Integration:**
  - Photo attachment during initial student enrollment via multipart form submission.
  - One-click upload, replacement, and removal directly from the **Student Portfolio Modal**.
  - Photo update and removal directly from the **Edit Student Modal**.
  - Photo thumbnail avatars displayed in the student roster table with automatic initial fallbacks.
- **Pillow Image Validation & Security:**
  - Enforced format whitelist: JPEG, PNG, WEBP (SVG rejected for student photos to prevent XSS).
  - Maximum upload size constrained to 5 MB (`413 Payload Too Large` on violation).
  - Decompression bomb protection via PIL pixel limit defenses.
  - Image dimension normalization: high-resolution portraits are automatically resized to max 1024×1024 px preserving aspect ratio.
  - Automatic EXIF orientation normalization via `ImageOps.exif_transpose` (prevents sideways or upside-down mobile photos).
  - Color mode normalization: RGBA/P images converted cleanly to RGB.
- **Windows File-Lock Defense:**
  - Photo delivery route (`GET /api/students/<id>/photo`) streams image bytes from an in-memory `io.BytesIO` buffer rather than holding an open Windows file handle. This completely prevents `[WinError 32]` file access conflicts when users replace or delete photos.
  - Missing or removed photos fall back to an embedded vector SVG avatar.
- **Clean Filesystem Storage:**
  - Photos are saved persistently under `<DATA_DIR>/photos/students/student_<id>.<ext>`.
  - Database stores only relative filename references (`photo_path`) in SQLite, keeping database backups compact and preventing database bloat.
  - Automatic unlinking of stale photo files upon replacement or student deletion.

### 💾 2. Complete C: and D: Drive Storage Management
- **Independent Installation & Data Drives:**
  - Inno Setup installer features an interactive **Persistent Application Data Directory** selection page (`CreateInputDirPage`).
  - Allows selecting `D:\ClassroomOSData`, `E:\ClassroomOSData`, or retaining the standard `%LOCALAPPDATA%\ClassroomOS\data`.
  - Installer writes configuration to `{app}\storage_config.json` and records `HKCU\Software\ClassroomOS\DataDir`.
- **Hierarchical Path Resolution (`storage_manager.py`):**
  1. `CLASSROOM_DATA_DIR` environment variable (highest priority, enabling container and automated test isolation).
  2. `storage_config.json` residing in the application directory.
  3. Windows Registry key `HKCU\Software\ClassroomOS\DataDir`.
  4. Default `%LOCALAPPDATA%\ClassroomOS\data` (desktop mode) or Flask `instance_path` (development mode).
- **Directory Structure:**
  ```
  <DATA_DIR>/
  ├── classroom.db          # Primary SQLite database
  ├── photos/
  │   └── students/         # Student portrait photographs
  ├── branding/             # School logos and crests
  ├── backups/              # Automated point-in-time database backups & manifests
  └── logs/                 # launcher.log, audit, and runtime diagnostics
  ```
- **Live Storage Metrics Dashboard:**
  - Displays primary database file size, student photo count and aggregate size, total application data, and available host drive disk space.
  - Automatic warning when available disk space falls below 500 MB.
- **Verified Storage Migration:**
  - REST endpoint `POST /admin/storage/migrate` allows administrators to relocate their persistent data directory to another drive.
  - Pre-flight check verifies source and destination paths and ensures minimum free space.
  - Atomically copies database, photos, branding, and backups.
  - Verifies SQLite integrity (`PRAGMA integrity_check`) and SHA-256 hash match of the migrated database.
  - Updates `storage_config.json` and Windows Registry upon success; performs immediate rollback if any step fails.
- **Temporary C: Drive Footprint Documentation:**
  - Documented in [INSTALL_AND_UPGRADE.md](file:///c:/Users/Bilal%20ahmad/OneDrive/Desktop/Classroom%20Management/docs/INSTALL_AND_UPGRADE.md) that browser cache (`%LOCALAPPDATA%\Google\Chrome` or Edge) and temporary PyInstaller extraction files consume transient C: space during active execution, while all persistent data resides strictly on the designated drive.

### 🖥️ 3. Professional Windows Launching Experience
- **Elimination of Command Prompt:**
  - PyInstaller build configuration updated with `console=False` and `--windowed`.
  - The resulting executable (`ClassroomOS.exe`) uses the Windows GUI subsystem (`IMAGE_SUBSYSTEM_WINDOWS_GUI`), preventing Command Prompt windows from appearing on launch.
- **Safe Output Logging:**
  - Implemented `SafeOutputLogger` in `launcher.py` which redirects `sys.stdout` and `sys.stderr` safely to `<DATA_DIR>/logs/launcher.log` with timestamped formatting.
  - Critical startup errors (port conflicts, missing dependencies) trigger native Windows message boxes via `ctypes.windll.user32.MessageBoxW`.
- **Single-Instance Enforcement & Readiness Polling:**
  - Detects if ClassroomOS is already running on loopback and directs the browser to the existing session rather than throwing an unhandled socket error.
  - Implements reliable HTTP polling (`waitForServer`) before launching the system browser, ensuring users never see a "Connection Refused" error page.
- **In-App Application Exit:**
  - Added a dedicated loopback shutdown endpoint: `POST /api/system/shutdown`.
  - Accessible via a prominent "Exit ClassroomOS" button in the navigation bar.
  - Verifies loopback origin before scheduling process termination via a detached daemon thread.

---

## 3. Verification & Testing Matrix

| Test Suite / Script | Scope | Result | Status |
| :--- | :--- | :---: | :---: |
| **Backend Unit & Integration Suite** | 11 modules (`tests/`): Auth, Attendance, Photos, Storage, Institution, Quality, V2.1.1 Enhancements | **104 passed in 71.2s** | ✅ PASSED |
| **Playwright Photo & Storage E2E** | `e2e-photo-storage-test.mjs`: Enrollment photo upload, roster thumbnail, portfolio view, photo replacement, persistence across full page reload, and Admin Storage dashboard metrics | **6/6 steps passed (100%)** | ✅ PASSED |
| **Clean Install & Lifecycle Test** | `test-clean-install.ps1`: Silent installation of `ClassroomOS-Setup-2.1.1.exe`, bootstrap, SVG branding, student creation, attendance lock/reopen, database backup hash verification, restart persistence, Inno Setup upgrade, and uninstallation data preservation | **7/7 steps passed (100%)** | ✅ PASSED |
| **Packaged Binary Playwright E2E** | `e2e-packaged-admin-test.mjs`: Form field interaction, request stability check (zero infinite loops), save to SQLite, browser reload persistence, and application restart persistence | **11/11 steps passed (100%)** | ✅ PASSED |

---

## 4. Release Artifacts & Checksums

| Artifact | File Name | Size | SHA-256 Checksum |
| :--- | :--- | :---: | :--- |
| **Windows Installer** | `ClassroomOS-Setup-2.1.1.exe` | ~53 MB | `286E79C4AD20FC04BC47EF7ABA6E32FCE4003A3D471425D4773CAB43418BBD19` |
| **Portable ZIP Archive** | `ClassroomOS-v2.1.1-Portable-Windows.zip` | ~74 MB | `24221ACBED77A86ABC25BD73FE701D62DDC0016EE5C6AADEC5412E08871518FE` |
| **Verification Manifest** | `dist_release/SHA256SUMS.txt` | 165 B | Verified SHA-256 manifest |

---

## 5. Upgrade Instructions

Upgrading from ClassroomOS 2.0.0 or 2.1.0 to 2.1.1 is fully non-destructive and requires no manual database migrations:

1. Close any running instance of ClassroomOS.
2. Run `ClassroomOS-Setup-2.1.1.exe`.
3. Choose the same or a new installation directory. The installer automatically detects your existing persistent data directory from `HKCU\Software\ClassroomOS\DataDir`.
4. Finish installation and launch ClassroomOS. All student records, attendance logs, and administrator accounts will remain intact.

