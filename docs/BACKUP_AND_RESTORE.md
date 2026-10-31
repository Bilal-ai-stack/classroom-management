# Backup and Restore

## Create and verify a backup

```powershell
cd codebase/backend
$env:SECRET_KEY = '<configured application secret>'
$env:FLASK_APP = 'app:create_app'
.\venv\Scripts\python.exe -m flask db-backup --destination 'D:\ClassroomBackups\classroom-2026-10-29.db'
.\venv\Scripts\python.exe -m flask db-verify-backup --backup 'D:\ClassroomBackups\classroom-2026-10-29.db'
```

The destination and its manifest must not already exist. The command refuses overwrites, checks the source database, uses SQLite's online backup API, checks the copy, and writes a SHA-256 manifest. Keep both files together.

## Restore safely

Stop the application before recovery. Restore always targets a new path and refuses to replace an existing file:

```powershell
.\venv\Scripts\python.exe -m flask db-restore `
  --backup 'D:\ClassroomBackups\classroom-2026-10-29.db' `
  --destination 'D:\ClassroomRecovery\classroom-restored.db'
```

After the command reports success, configure a test application instance to use the restored file and verify login, student counts, attendance history, and the schema version. Replacing the live database is intentionally a separate, offline operator action: retain the original file, its `-wal`/`-shm` companions if present, and the verified backup until acceptance checks pass. The application never silently overwrites the live database.

## Recovery limitations

Backups are not encrypted. Store them on access-controlled encrypted media where student records require it. Loss of both administrator credentials and all viable database backups has no automated recovery path in this batch.
