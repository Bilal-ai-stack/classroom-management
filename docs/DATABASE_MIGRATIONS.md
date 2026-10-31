# Database Migrations

The backend now uses numbered migrations in `codebase/backend/migrations.py`. Startup applies only unapplied versions and records them in `schema_migrations`. `db.create_all()` is no longer the schema-upgrade mechanism.

## Current schema versions

- Version 1: existing `students` and `attendances` schema and attendance-date index.
- Version 2: persistent `users`, `auth_sessions`, and `audit_events` tables and indexes.

An existing pre-v2 database is preserved. Before pending migrations run against a file-backed database, the application creates a verified backup under `<database-directory>/backups/`. A backup contains the SQLite file plus a `.manifest.json` file with its SHA-256 digest and successful integrity result. Migration tests prove a legacy student and attendance row remain unchanged after upgrading to version 2.

## SQLite connection policy

Every SQLite connection enables:

- `PRAGMA foreign_keys = ON`
- `PRAGMA busy_timeout = 5000`
- `PRAGMA synchronous = NORMAL`
- `PRAGMA journal_mode = WAL` for file-backed databases

WAL is appropriate for the single-computer model because readers do not block a writer. Keep the live database on a local disk. Do not run it from a network share or synchronize the live database/WAL files through a file-sync service. Back up through the provided command instead.

## Operator commands

Set `SECRET_KEY` before invoking the Flask application:

```powershell
cd codebase/backend
$env:SECRET_KEY = '<long locally generated random value>'
$env:FLASK_APP = 'app:create_app'
.\venv\Scripts\python.exe -m flask db-version
```

Never edit `schema_migrations` manually. Add future migrations as a new monotonically increasing entry and test upgrading a copy of the prior schema. Do not change an already released migration.
