"""Test Suite for ClassroomOS 2.1.1 Enhancements.

Covers:
1. Student Photograph Persistence (Upload, validation, display, replace, delete, fallback, multipart create).
2. Storage Management & Independent Drive Resolution (C: vs D: config, metrics, safe data migration, integrity checks).
3. Process Supervision & System Shutdown API.
"""

import io
import json
import os
import shutil
import tempfile
from pathlib import Path
import pytest
from PIL import Image

from app import create_app
from db import db
from phase1_students.models import Student
from phase4_quality.models import User
from werkzeug.security import generate_password_hash
from storage_manager import (
    resolve_data_directory,
    ensure_storage_directories,
    get_detailed_storage_metrics,
    migrate_data_directory,
    set_configured_data_dir,
    get_configured_data_dir,
    file_sha256,
    verify_sqlite_integrity
)


def create_test_image(format='JPEG', size=(120, 120), color=(30, 58, 138)):
    """Generate in-memory valid image bytes for testing."""
    img = Image.new('RGB', size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


@pytest.fixture
def test_env():
    """Setup an isolated temporary environment for storage and database testing."""
    temp_dir = tempfile.mkdtemp(prefix='test_classroom_v211_')
    data_dir = Path(temp_dir) / 'data'
    storage_dirs = ensure_storage_directories(data_dir)
    config_path = Path(temp_dir) / 'storage_config.json'

    os.environ['CLASSROOM_CONFIG_PATH'] = str(config_path)
    os.environ['CLASSROOM_DATA_DIR'] = str(data_dir)

    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'test-secret-v211',
        'SQLALCHEMY_DATABASE_URI': f"sqlite:///{data_dir / 'classroom.db'}",
        'DATA_DIRECTORY': data_dir,
        'PHOTOS_DIRECTORY': storage_dirs['photos'],
        'BRANDING_DIRECTORY': storage_dirs['branding'],
        'BACKUP_DIRECTORY': storage_dirs['backups'],
        'LOGS_DIRECTORY': storage_dirs['logs'],
        'AUTO_BACKUP_BEFORE_MIGRATION': False,
    })

    with app.app_context():
        # Create admin user
        admin = User(
            email='admin@school.local',
            full_name='System Admin',
            role='admin',
            password_hash=generate_password_hash('AdminPass1234!', method='scrypt'),
            is_active=True
        )
        db.session.add(admin)
        db.session.commit()

        # Login to obtain token
        client = app.test_client()
        login_resp = client.post('/api/auth/login', json={
            'email': 'admin@school.local',
            'password': 'AdminPass1234!'
        })
        token = login_resp.get_json()['token']

    yield {
        'app': app,
        'client': client,
        'token': token,
        'data_dir': data_dir,
        'storage_dirs': storage_dirs,
        'temp_dir': temp_dir,
        'headers': {'Authorization': f'Bearer {token}'}
    }

    # Teardown
    os.environ.pop('CLASSROOM_CONFIG_PATH', None)
    os.environ.pop('CLASSROOM_DATA_DIR', None)
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


# =============================================================================
# 1. Student Photograph Persistence Tests
# =============================================================================

def test_student_photo_lifecycle(test_env):
    """Test full student photo lifecycle: upload, retrieve, replace, delete, fallback."""
    client = test_env['client']
    headers = test_env['headers']

    # 1. Create a student without photo
    create_resp = client.post('/api/students', json={
        'roll_number': 'R-101',
        'full_name': 'Amina Tariq',
        'class_name': 'Grade 5',
        'section': 'A',
        'enrollment_date': '2026-11-01'
    }, headers=headers)
    assert create_resp.status_code == 201
    student_id = create_resp.get_json()['student']['id']

    # 2. Verify fallback avatar when no photo is uploaded
    avatar_resp = client.get(f'/api/students/{student_id}/photo')
    assert avatar_resp.status_code == 200
    assert 'image/svg+xml' in avatar_resp.content_type
    assert b'<svg' in avatar_resp.data

    # 3. Upload a valid JPEG photograph
    jpeg_bytes = create_test_image('JPEG', (200, 200))
    upload_resp = client.post(
        f'/api/students/{student_id}/photo',
        data={'photo': (io.BytesIO(jpeg_bytes), 'portrait.jpg')},
        content_type='multipart/form-data',
        headers=headers
    )
    assert upload_resp.status_code == 200
    data = upload_resp.get_json()
    assert data['success'] is True
    assert data['student']['has_photo'] is True
    assert f'/api/students/{student_id}/photo' in data['photo_url']
    first_filename = data['student']['photo_path']

    # 4. Verify photo retrieval
    photo_get_resp = client.get(f'/api/students/{student_id}/photo')
    assert photo_get_resp.status_code == 200
    assert 'image/jpeg' in photo_get_resp.content_type
    assert len(photo_get_resp.data) > 0
    photo_get_resp.close()

    # Verify physical file existence on disk
    photo_file = test_env['storage_dirs']['photos'] / first_filename
    assert photo_file.is_file()

    # 5. Replace photograph with a PNG file
    png_bytes = create_test_image('PNG', (150, 150), color=(16, 185, 129))
    replace_resp = client.post(
        f'/api/students/{student_id}/photo',
        data={'photo': (io.BytesIO(png_bytes), 'new_photo.png')},
        content_type='multipart/form-data',
        headers=headers
    )
    assert replace_resp.status_code == 200
    replace_data = replace_resp.get_json()
    second_filename = replace_data['student']['photo_path']
    assert second_filename != first_filename
    assert second_filename.endswith('.png')

    # Verify old file was deleted from disk
    assert not photo_file.exists()
    assert (test_env['storage_dirs']['photos'] / second_filename).is_file()

    # 6. Delete photograph
    del_resp = client.delete(f'/api/students/{student_id}/photo', headers=headers)
    assert del_resp.status_code == 200
    del_data = del_resp.get_json()
    assert del_data['success'] is True
    assert del_data['student']['has_photo'] is False

    # Verify physical file was unlinked
    assert not (test_env['storage_dirs']['photos'] / second_filename).exists()

    # Verify fallback avatar is served again
    fallback_resp = client.get(f'/api/students/{student_id}/photo')
    assert fallback_resp.status_code == 200
    assert 'image/svg+xml' in fallback_resp.content_type


def test_student_photo_validation(test_env):
    """Test photo validation guards against corrupted and invalid formats."""
    client = test_env['client']
    headers = test_env['headers']

    # Create student
    res = client.post('/api/students', json={
        'roll_number': 'R-102',
        'full_name': 'Zaid Khan',
        'class_name': 'Grade 5',
        'section': 'A',
        'enrollment_date': '2026-11-01'
    }, headers=headers)
    student_id = res.get_json()['student']['id']

    # 1. Invalid file extension (.exe or .txt)
    txt_resp = client.post(
        f'/api/students/{student_id}/photo',
        data={'photo': (io.BytesIO(b'not an image'), 'script.sh')},
        content_type='multipart/form-data',
        headers=headers
    )
    assert txt_resp.status_code == 400
    assert 'Unsupported image format' in txt_resp.get_json()['error']

    # 2. Corrupt image file
    corrupt_resp = client.post(
        f'/api/students/{student_id}/photo',
        data={'photo': (io.BytesIO(b'JFIF corrupted header invalid bytes'), 'corrupt.jpg')},
        content_type='multipart/form-data',
        headers=headers
    )
    assert corrupt_resp.status_code == 400
    assert 'Invalid or corrupted image' in corrupt_resp.get_json()['error']

    # 3. Oversized image (>5MB)
    oversized_bytes = b'0' * (6 * 1024 * 1024)
    oversized_resp = client.post(
        f'/api/students/{student_id}/photo',
        data={'photo': (io.BytesIO(oversized_bytes), 'huge.jpg')},
        content_type='multipart/form-data',
        headers=headers
    )
    assert oversized_resp.status_code == 400
    assert 'exceeds 5MB limit' in oversized_resp.get_json()['error']


def test_create_student_with_photo_multipart(test_env):
    """Test direct photo upload during student registration via multipart form data."""
    client = test_env['client']
    headers = test_env['headers']
    jpeg_bytes = create_test_image('JPEG', (180, 180))

    resp = client.post(
        '/api/students',
        data={
            'roll_number': 'R-103',
            'full_name': 'Fatima Bilal',
            'class_name': 'Grade 4',
            'section': 'B',
            'enrollment_date': '2026-11-01',
            'guardian_contact': '+15551234567',
            'photo': (io.BytesIO(jpeg_bytes), 'fatima.jpg')
        },
        content_type='multipart/form-data',
        headers=headers
    )
    assert resp.status_code == 201
    st = resp.get_json()['student']
    assert st['full_name'] == 'Fatima Bilal'
    assert st['has_photo'] is True
    assert st['photo_path'] != ''

    # Verify file is stored on disk and retrievable
    photo_file = test_env['storage_dirs']['photos'] / st['photo_path']
    assert photo_file.is_file()

    get_photo = client.get(f"/api/students/{st['id']}/photo")
    assert get_photo.status_code == 200
    assert 'image/jpeg' in get_photo.content_type


# =============================================================================
# 2. Storage Management & Independent Drive Selection Tests
# =============================================================================

def test_storage_metrics_inspection(test_env):
    """Test comprehensive storage metrics including database, photos, and backups."""
    client = test_env['client']
    headers = test_env['headers']

    # Upload a student photo first to ensure non-zero photo size
    jpeg_bytes = create_test_image('JPEG', (250, 250))
    client.post(
        '/api/students',
        data={
            'roll_number': 'R-201',
            'full_name': 'Omar Farooq',
            'class_name': 'Grade 6',
            'section': 'A',
            'enrollment_date': '2026-11-01',
            'photo': (io.BytesIO(jpeg_bytes), 'omar.jpg')
        },
        content_type='multipart/form-data',
        headers=headers
    )

    # Create a backup
    bk_resp = client.post('/api/admin/backups', headers=headers)
    assert bk_resp.status_code in (200, 201)

    # Query storage info
    storage_resp = client.get('/api/admin/storage', headers=headers)
    assert storage_resp.status_code == 200
    info = storage_resp.get_json()['storage']

    assert 'database_size_bytes' in info
    assert info['database_size_bytes'] > 0
    assert info['student_photos_count'] >= 1
    assert info['student_photos_size_bytes'] > 0
    assert info['backup_count'] >= 1
    assert info['total_data_size_bytes'] > 0
    assert 'disk_free_bytes' in info
    assert 'data_directory' in info
    assert 'c_drive_notes' in info


def test_safe_data_directory_migration(test_env):
    """Test verified data directory migration to a target folder (simulating D: drive)."""
    client = test_env['client']
    headers = test_env['headers']
    current_data_dir = test_env['data_dir']

    # 1. Create a student with photograph in current directory
    jpeg_bytes = create_test_image('JPEG', (200, 200), color=(50, 100, 150))
    client.post(
        '/api/students',
        data={
            'roll_number': 'R-301',
            'full_name': 'Maryam Noor',
            'class_name': 'Grade 7',
            'section': 'A',
            'enrollment_date': '2026-11-01',
            'photo': (io.BytesIO(jpeg_bytes), 'maryam.jpg')
        },
        content_type='multipart/form-data',
        headers=headers
    )

    # Create a verified backup
    client.post('/api/admin/backups', headers=headers)

    # 2. Target migration directory (simulating D:\ClassroomOSData)
    target_data_dir = Path(test_env['temp_dir']) / 'Simulated_D_Drive' / 'ClassroomOSData'

    migrate_resp = client.post('/api/admin/storage/migrate', json={
        'target_directory': str(target_data_dir)
    }, headers=headers)

    assert migrate_resp.status_code == 200
    res = migrate_resp.get_json()
    assert res['success'] is True
    assert str(target_data_dir) in res['message']

    # 3. Verify destination files exist and match hashes
    dst_db = target_data_dir / 'classroom.db'
    src_db = current_data_dir / 'classroom.db'
    assert dst_db.is_file()
    assert file_sha256(dst_db) == file_sha256(src_db)

    # Verify SQLite integrity check passes on destination
    valid, msg = verify_sqlite_integrity(dst_db)
    assert valid is True
    assert msg == 'ok'

    # Verify photos were copied with matching hashes
    dst_photos = target_data_dir / 'photos' / 'students'
    src_photos = current_data_dir / 'photos' / 'students'
    assert dst_photos.is_dir()
    for sp in src_photos.glob('*'):
        if sp.is_file():
            dp = dst_photos / sp.name
            assert dp.is_file()
            assert file_sha256(sp) == file_sha256(dp)

    # Verify backups were copied
    assert (target_data_dir / 'backups').is_dir()

    # 4. Verify original source data remains preserved as safety archive
    assert src_db.is_file()
    assert (src_photos).is_dir()


def test_storage_config_persistence(test_env):
    """Test that set_configured_data_dir and get_configured_data_dir persist to JSON."""
    os.environ.pop('CLASSROOM_DATA_DIR', None)
    target_dir = Path(test_env['temp_dir']) / 'CustomStorage'
    set_configured_data_dir(target_dir)

    read_dir = get_configured_data_dir()
    assert read_dir is not None
    assert str(read_dir.resolve()) == str(target_dir.resolve())


# =============================================================================
# 3. Process Supervision & System Shutdown API Tests
# =============================================================================

def test_system_shutdown_loopback_permission(test_env):
    """Test that /api/system/shutdown is accessible from loopback and rejects external hosts."""
    client = test_env['client']

    # Loopback request should be accepted
    resp = client.post('/api/system/shutdown', environ_base={'REMOTE_ADDR': '127.0.0.1'})
    assert resp.status_code == 200
    assert resp.get_json()['success'] is True

    # External IP request must be rejected with 403 Forbidden
    resp_ext = client.post('/api/system/shutdown', environ_base={'REMOTE_ADDR': '192.168.1.100'})
    assert resp_ext.status_code == 403
    assert 'only permitted from loopback' in resp_ext.get_json()['error']
