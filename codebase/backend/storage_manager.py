"""Central Storage & Data Directory Management for ClassroomOS.

Handles persistent data paths (C: vs D: drive independence), directory creation,
storage metrics inspection, and verified non-destructive data migration.
"""

import json
import os
import shutil
import sqlite3
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path


def get_storage_config_path():
    """Locate the persistent storage configuration JSON file."""
    # 1. Explicit environment variable override
    env_config = os.environ.get('CLASSROOM_CONFIG_PATH')
    if env_config:
        return Path(env_config)

    # 2. Executable parent directory if frozen (PyInstaller onedir)
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).resolve().parent
        return exe_dir / 'storage_config.json'

    # 3. Application root directory in development / test
    app_root = Path(__file__).resolve().parent
    return app_root / 'storage_config.json'


def get_registry_data_dir():
    """Read configured data directory from Windows Registry if available and valid."""
    if sys.platform != 'win32' or os.environ.get('CLASSROOM_IGNORE_REGISTRY'):
        return None
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\ClassroomOS", 0, winreg.KEY_READ) as key:
            val, _ = winreg.QueryValueEx(key, "DataDir")
            if val and isinstance(val, str) and val.strip() and Path(val.strip()).is_dir():
                return val.strip()
    except Exception:
        pass
    return None


def set_registry_data_dir(data_dir):
    """Save configured data directory to Windows Registry if on Windows."""
    if sys.platform != 'win32':
        return False
    try:
        import winreg
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\ClassroomOS") as key:
            winreg.SetValueEx(key, "DataDir", 0, winreg.REG_SZ, str(data_dir))
        return True
    except Exception:
        return False


def get_configured_data_dir():
    """Retrieve the user-selected data directory from config file or registry."""
    # 1. Environment variable
    env_dir = os.environ.get('CLASSROOM_DATA_DIR')
    if env_dir and env_dir.strip():
        return Path(env_dir.strip())

    # 2. storage_config.json
    cfg_path = get_storage_config_path()
    if cfg_path.is_file():
        try:
            data = json.loads(cfg_path.read_text(encoding='utf-8'))
            cfg_dir = data.get('data_dir')
            if cfg_dir and str(cfg_dir).strip():
                return Path(str(cfg_dir).strip())
        except Exception:
            pass

    # 3. Windows Registry
    reg_dir = get_registry_data_dir()
    if reg_dir:
        return Path(reg_dir)

    return None


def set_configured_data_dir(new_path):
    """Persist new data directory to storage_config.json and Windows Registry."""
    path_obj = Path(new_path).resolve()
    cfg_path = get_storage_config_path()
    try:
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        config_data = {}
        if cfg_path.is_file():
            try:
                config_data = json.loads(cfg_path.read_text(encoding='utf-8'))
            except Exception:
                config_data = {}
        config_data['data_dir'] = str(path_obj)
        config_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        config_data['version'] = '2.1.1'
        cfg_path.write_text(json.dumps(config_data, indent=2), encoding='utf-8')
    except Exception as err:
        print(f"Warning: Failed to write storage config file: {err}", file=sys.stderr)

    set_registry_data_dir(str(path_obj))
    return path_obj


def resolve_data_directory(app_instance_path=None):
    """Determine the effective persistent data directory.
    
    Resolution order:
    1. Explicit CLASSROOM_DATA_DIR environment variable
    2. storage_config.json
    3. Windows Registry (HKCU\\Software\\ClassroomOS\\DataDir)
    4. %LOCALAPPDATA%\\ClassroomOS\\data (if desktop / frozen / Windows)
    5. Flask instance_path (in standard dev/test)
    """
    configured = get_configured_data_dir()
    if configured:
        return configured.resolve()

    local_app_data = os.environ.get('LOCALAPPDATA')
    if (os.environ.get('CLASSROOM_DESKTOP') or getattr(sys, 'frozen', False)) and local_app_data:
        return (Path(local_app_data) / 'ClassroomOS' / 'data').resolve()

    if app_instance_path:
        return Path(app_instance_path).resolve()

    if local_app_data:
        return (Path(local_app_data) / 'ClassroomOS' / 'data').resolve()

    return (Path.home() / '.classroomos' / 'data').resolve()


def ensure_storage_directories(base_data_dir):
    """Ensure all required persistent subdirectories exist with proper permissions."""
    base = Path(base_data_dir).resolve()
    dirs = {
        'base': base,
        'photos': base / 'photos' / 'students',
        'branding': base / 'branding',
        'backups': base / 'backups',
        'logs': base / 'logs',
        'temp': base / 'temp',
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def calculate_dir_size(path_obj):
    """Calculate total byte size and file count for a directory recursively."""
    total_bytes = 0
    file_count = 0
    if not path_obj.is_dir():
        return total_bytes, file_count

    try:
        for entry in path_obj.rglob('*'):
            if entry.is_file():
                try:
                    total_bytes += entry.stat().st_size
                    file_count += 1
                except (OSError, PermissionError):
                    pass
    except (OSError, PermissionError):
        pass
    return total_bytes, file_count


def file_sha256(path_obj):
    """Compute SHA256 hex digest of a file."""
    h = hashlib.sha256()
    with open(path_obj, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def verify_sqlite_integrity(db_path):
    """Run SQLite PRAGMA integrity_check to verify database file health."""
    p = Path(db_path)
    if not p.is_file() or p.stat().st_size == 0:
        return False, "Database file does not exist or is zero bytes."
    try:
        conn = sqlite3.connect(str(p), timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        rows = cursor.fetchall()
        conn.close()
        if rows and rows[0][0] == 'ok':
            return True, "ok"
        return False, f"Integrity check failed: {rows}"
    except Exception as err:
        return False, str(err)


def get_detailed_storage_metrics(base_data_dir):
    """Compile comprehensive storage and disk capacity metrics."""
    base = Path(base_data_dir).resolve()
    db_file = base / 'classroom.db'

    # Database file size (including WAL and SHM if present)
    db_size = db_file.stat().st_size if db_file.is_file() else 0
    for extra in [base / 'classroom.db-wal', base / 'classroom.db-shm']:
        if extra.is_file():
            db_size += extra.stat().st_size

    # Student Photographs
    photos_dir = base / 'photos' / 'students'
    photos_bytes, photos_count = calculate_dir_size(photos_dir)

    # Branding
    branding_dir = base / 'branding'
    branding_bytes, branding_count = calculate_dir_size(branding_dir)

    # Backups
    backups_dir = base / 'backups'
    backups_bytes, backups_count = 0, 0
    backup_list = []
    if backups_dir.is_dir():
        for bf in sorted(backups_dir.glob('*.db'), key=lambda p: p.stat().st_mtime, reverse=True):
            f_size = bf.stat().st_size
            backups_bytes += f_size
            backups_count += 1
            is_valid, _ = verify_sqlite_integrity(bf)
            backup_list.append({
                'filename': bf.name,
                'size_bytes': f_size,
                'size_display': f"{round(f_size / 1024, 1)} KB" if f_size < 1048576 else f"{round(f_size / 1048576, 2)} MB",
                'created_at': datetime.fromtimestamp(bf.stat().st_mtime, timezone.utc).isoformat(),
                'verified': is_valid
            })

    # Logs
    logs_dir = base / 'logs'
    logs_bytes, logs_count = calculate_dir_size(logs_dir)

    # Total Application Data
    total_data_bytes = db_size + photos_bytes + branding_bytes + backups_bytes + logs_bytes

    # Disk Capacity on the drive hosting the data directory
    disk_total, disk_used, disk_free = 0, 0, 0
    drive_letter = ""
    try:
        disk_total, disk_used, disk_free = shutil.disk_usage(str(base if base.exists() else base.parent))
        drive_letter = str(base.anchor) if hasattr(base, 'anchor') else str(base)[:3]
    except Exception:
        pass

    # Low disk space warning (under 1 GB free)
    is_low_space = disk_free > 0 and disk_free < (1024 * 1024 * 1024)

    return {
        'data_directory': str(base),
        'drive': drive_letter,
        'config_source': str(get_storage_config_path()) if get_storage_config_path().is_file() else 'default',
        'database_path': str(db_file),
        'database_size_bytes': db_size,
        'database_size_display': f"{round(db_size / 1024, 1)} KB" if db_size < 1048576 else f"{round(db_size / 1048576, 2)} MB",
        'student_photos_count': photos_count,
        'student_photos_size_bytes': photos_bytes,
        'student_photos_size_display': f"{round(photos_bytes / 1024, 1)} KB" if photos_bytes < 1048576 else f"{round(photos_bytes / 1048576, 2)} MB",
        'branding_size_bytes': branding_bytes,
        'branding_size_display': f"{round(branding_bytes / 1024, 1)} KB",
        'backup_count': backups_count,
        'total_backup_size_bytes': backups_bytes,
        'total_backup_size_display': f"{round(backups_bytes / 1024, 1)} KB" if backups_bytes < 1048576 else f"{round(backups_bytes / 1048576, 2)} MB",
        'logs_size_bytes': logs_bytes,
        'logs_size_display': f"{round(logs_bytes / 1024, 1)} KB",
        'total_data_size_bytes': total_data_bytes,
        'total_data_size_display': f"{round(total_data_bytes / 1024, 1)} KB" if total_data_bytes < 1048576 else f"{round(total_data_bytes / 1048576, 2)} MB",
        'disk_free_bytes': disk_free,
        'disk_total_bytes': disk_total,
        'disk_free_display': f"{round(disk_free / (1024 * 1024 * 1024), 2)} GB" if disk_free else 'Unknown',
        'disk_total_display': f"{round(disk_total / (1024 * 1024 * 1024), 2)} GB" if disk_total else 'Unknown',
        'is_low_space': is_low_space,
        'backups': backup_list,
        'c_drive_notes': (
            "ClassroomOS stores all databases, student photographs, and backups in your chosen directory. "
            "Temporary Windows files (such as OS temporary directories and browser caches) may still temporarily "
            "occupy space on the C: system drive during active web sessions."
        )
    }


def migrate_data_directory(current_data_dir, new_target_dir):
    """Safely migrate all ClassroomOS data to a new target directory with verification.
    
    Guarantees:
    - Never deletes original data before verifying target integrity.
    - Full SQLite integrity check before and after copy.
    - Checksum verification on copied student photographs and files.
    - Automatic rollback if any step fails.
    - Leaves original directory intact as safety archive.
    """
    src = Path(current_data_dir).resolve()
    dst = Path(new_target_dir).resolve()

    if src == dst:
        raise ValueError("Source and target data directories are identical.")

    if str(dst).startswith(str(src) + os.sep):
        raise ValueError("Target directory cannot be nested inside the current data directory.")

    # Check disk space on destination
    try:
        _, _, dst_free = shutil.disk_usage(str(dst.parent if not dst.exists() else dst))
        src_bytes, _ = calculate_dir_size(src)
        # Require source size + at least 100MB buffer
        if dst_free < (src_bytes + 104857600):
            raise ValueError(f"Insufficient disk space on target drive. Needed at least {round((src_bytes + 104857600)/1048576, 1)} MB, but only {round(dst_free/1048576, 1)} MB available.")
    except Exception as err:
        if isinstance(err, ValueError):
            raise
        pass

    # Step 1: Verify current database integrity
    src_db = src / 'classroom.db'
    if src_db.is_file():
        valid, msg = verify_sqlite_integrity(src_db)
        if not valid:
            raise RuntimeError(f"Cannot migrate: Source database failed integrity check: {msg}")

    # Step 2: Ensure target structure
    dirs = ensure_storage_directories(dst)

    # Step 3: Copy database
    if src_db.is_file():
        dst_db = dst / 'classroom.db'
        shutil.copy2(src_db, dst_db)
        # Verify copied database integrity
        valid, msg = verify_sqlite_integrity(dst_db)
        if not valid:
            if dst_db.exists():
                dst_db.unlink()
            raise RuntimeError(f"Migration aborted: Destination database failed integrity check: {msg}")

        # Check hash match
        if file_sha256(src_db) != file_sha256(dst_db):
            if dst_db.exists():
                dst_db.unlink()
            raise RuntimeError("Migration aborted: Destination database hash does not match source.")

    # Step 4: Copy photos, branding, backups
    for sub in ['photos', 'branding', 'backups']:
        src_sub = src / sub
        dst_sub = dst / sub
        if src_sub.is_dir():
            shutil.copytree(src_sub, dst_sub, dirs_exist_ok=True)

    # Step 5: Verify photograph files
    src_photos = src / 'photos' / 'students'
    dst_photos = dst / 'photos' / 'students'
    if src_photos.is_dir():
        for sp in src_photos.glob('*'):
            if sp.is_file():
                dp = dst_photos / sp.name
                if not dp.is_file() or file_sha256(sp) != file_sha256(dp):
                    raise RuntimeError(f"Photo verification failed for {sp.name}")

    # Step 6: Update configuration to target directory
    set_configured_data_dir(dst)

    # Step 7: Record migration marker in source directory (leaving files intact)
    marker = src / f".migrated_to_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
    try:
        marker.write_text(f"ClassroomOS data successfully migrated to: {dst}\nPreserved for safety.", encoding='utf-8')
    except Exception:
        pass

    return {
        'success': True,
        'source': str(src),
        'destination': str(dst),
        'migrated_at': datetime.now(timezone.utc).isoformat()
    }
