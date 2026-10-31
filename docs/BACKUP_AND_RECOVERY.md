# ClassroomOS 2.0.0 — Backup, Disaster Recovery & Integrity Guide

## 1. Overview & Data Architecture

ClassroomOS stores all persistent operational data in `%LOCALAPPDATA%\ClassroomOS\`:
- **`data\classroom.db`**: Primary SQLite database holding students, enrollments, attendance ledgers, institution configurations, staff accounts, and security audit logs.
- **`data\branding\`**: Uploaded school logos and crests (PNG, JPG, SVG).
- **`backups\`**: Automated transactional pre-migration backups created prior to schema upgrades.
- **`secret.key`**: Persistent 384-bit cryptographic key for session verification.

---

## 2. Automated Safeguards

### Pre-Migration Backup Snapshot
Before applying any database schema migration (e.g. from version 4 to 5), the application automatically invokes SQLite's Online Backup API:
- **Location:** `%LOCALAPPDATA%\ClassroomOS\backups\pre-migration-v<version>-<timestamp>.db`
- **Integrity Check:** Automatically executed on the source before copying, and verified on the snapshot afterward.
- **Overwrite Protection:** The backup engine refuses to overwrite any existing file.

---

## 3. Manual Operator Backups via CLI

ClassroomOS provides built-in CLI commands for administrator backups:

### Create a Verified Backup
```powershell
cd codebase\backend
$env:SECRET_KEY = "your-app-secret-key"
$env:FLASK_APP = "app:create_app"
.\venv\Scripts\python.exe -m flask db-backup --destination "D:\Backups\ClassroomOS-2026-10-31.db"
```
**Output:**
```
Source database integrity check passed.
Backup written to D:\Backups\ClassroomOS-2026-10-31.db.
Backup integrity check passed.
SHA-256: a1b2c3d4...
Manifest written to D:\Backups\ClassroomOS-2026-10-31.db.manifest.json.
```

### Verify Backup Integrity
```powershell
.\venv\Scripts\python.exe -m flask db-verify-backup --backup "D:\Backups\ClassroomOS-2026-10-31.db"
```
**Output:**
```
Backup file:   D:\Backups\ClassroomOS-2026-10-31.db
Expected hash: a1b2c3d4...
Actual hash:   a1b2c3d4...
Integrity:     ok
Verification result: VALID
```

---

## 4. Disaster Recovery Procedure

In the event of hardware failure, corruption, or operator error:

1. **Stop the Application:** Ensure `run-desktop.bat` and all background Flask instances are closed.
2. **Execute Safe Out-of-Place Restore:**
   ```powershell
   cd codebase\backend
   .\venv\Scripts\python.exe -m flask db-restore `
     --backup "D:\Backups\ClassroomOS-2026-10-31.db" `
     --destination "C:\Recovery\classroom-restored.db"
   ```
   > **Safety Guarantee:** The restore command *never* writes directly to an active database. It strictly requires an unoccupied destination path and verifies SQLite integrity before returning success.

3. **Verify Restored Database:**
   ```powershell
   .\venv\Scripts\python.exe -m pytest tests\test_database_reliability.py
   ```
4. **Deploy Restored Database:**
   - Copy `C:\Recovery\classroom-restored.db` to `%LOCALAPPDATA%\ClassroomOS\data\classroom.db`.
   - If recovering school logos, copy backup branding assets into `%LOCALAPPDATA%\ClassroomOS\data\branding\`.
5. **Restart ClassroomOS:**
   - Double-click `run-desktop.bat`.
   - Log in and verify student counts, class rosters, attendance records, and active branding crest.

---

## 5. Cold Storage & Archival Strategy

- **Backup Cadence:** Weekly automated backups are recommended for active academic terms.
- **Offsite Redundancy:** Copy the `.db` and `.manifest.json` pair to an encrypted external storage drive or school network share.
- **Zero Cloud Leakage:** All backups remain strictly local, preserving student privacy under FERPA guidelines.
