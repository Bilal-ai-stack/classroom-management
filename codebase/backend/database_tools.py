"""Verified, non-destructive SQLite backup and restore utilities."""

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def database_path_from_uri(uri):
    prefix = 'sqlite:///'
    if not uri.startswith(prefix) or uri.endswith(':memory:'):
        raise ValueError('Backup and restore require a file-backed SQLite database.')
    return Path(uri[len(prefix):]).resolve()


def integrity_check(path):
    path = Path(path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f'Database file not found: {path}')
    connection = sqlite3.connect(f'file:{path.as_posix()}?mode=ro', uri=True)
    try:
        result = connection.execute('PRAGMA integrity_check').fetchall()
        return result == [('ok',)]
    finally:
        connection.close()


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def create_backup(source_path, destination_path):
    source = Path(source_path).resolve()
    destination = Path(destination_path).resolve()
    if not source.is_file():
        raise FileNotFoundError(f'Source database not found: {source}')
    manifest_path = destination.with_suffix(destination.suffix + '.manifest.json')
    if destination.exists() or manifest_path.exists():
        raise FileExistsError(f'Refusing to overwrite existing backup: {destination}')
    if source == destination:
        raise ValueError('Backup destination must differ from the source database.')
    if not integrity_check(source):
        raise ValueError('Source database failed SQLite integrity_check; backup aborted.')

    destination.parent.mkdir(parents=True, exist_ok=True)
    source_connection = sqlite3.connect(str(source))
    destination_connection = sqlite3.connect(str(destination))
    try:
        source_connection.backup(destination_connection)
    except Exception:
        destination_connection.close()
        destination.unlink(missing_ok=True)
        raise
    finally:
        source_connection.close()
        try:
            destination_connection.close()
        except Exception:
            pass

    if not integrity_check(destination):
        destination.unlink(missing_ok=True)
        raise ValueError('Backup failed SQLite integrity_check and was removed.')

    manifest = {
        'format': 'classroom-management-sqlite-backup-v1',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'database_file': destination.name,
        'sha256': sha256_file(destination),
        'integrity_check': 'ok',
    }
    try:
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return manifest


def verify_backup(backup_path):
    backup = Path(backup_path).resolve()
    manifest_path = backup.with_suffix(backup.suffix + '.manifest.json')
    if not backup.is_file() or not manifest_path.is_file():
        return False
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return False
    return (
        manifest.get('format') == 'classroom-management-sqlite-backup-v1'
        and manifest.get('sha256') == sha256_file(backup)
        and integrity_check(backup)
    )


def restore_backup(backup_path, destination_path):
    """Restore into a new path; never replace an existing or live database silently."""
    backup = Path(backup_path).resolve()
    destination = Path(destination_path).resolve()
    if destination.exists():
        raise FileExistsError(f'Refusing to overwrite existing database: {destination}')
    if not verify_backup(backup):
        raise ValueError('Backup verification failed; restore aborted.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    source_connection = sqlite3.connect(str(backup))
    destination_connection = sqlite3.connect(str(destination))
    try:
        source_connection.backup(destination_connection)
    except Exception:
        destination_connection.close()
        destination.unlink(missing_ok=True)
        raise
    finally:
        source_connection.close()
        try:
            destination_connection.close()
        except Exception:
            pass
    if not integrity_check(destination):
        destination.unlink(missing_ok=True)
        raise ValueError('Restored database failed integrity_check and was removed.')
    return destination
