import os
from pathlib import Path
import pytest
from app import create_app
from launcher import find_available_port, get_or_create_desktop_secret, is_port_in_use


def test_is_port_in_use_and_find_port():
    # Ports that are definitely open vs available
    port = find_available_port(start_port=5900, max_attempts=20)
    assert 5900 <= port < 5920
    assert not is_port_in_use(port)


def test_get_or_create_desktop_secret(tmp_path):
    # First call generates key
    secret = get_or_create_desktop_secret(str(tmp_path))
    assert len(secret) >= 32

    # Second call retrieves identical key
    secret_again = get_or_create_desktop_secret(str(tmp_path))
    assert secret == secret_again

    # File exists on disk
    key_file = tmp_path / 'ClassroomOS' / 'secret.key'
    assert key_file.is_file()
    assert key_file.read_text(encoding='utf-8').strip() == secret


def test_desktop_mode_uses_localappdata(tmp_path, monkeypatch):
    monkeypatch.setenv('CLASSROOM_DESKTOP', '1')
    monkeypatch.setenv('LOCALAPPDATA', str(tmp_path))
    monkeypatch.setenv('SECRET_KEY', 'desktop-test-secret')

    app = create_app()
    expected_db_path = str(tmp_path / 'ClassroomOS' / 'data' / 'classroom.db')
    assert expected_db_path in app.config['SQLALCHEMY_DATABASE_URI']
    assert Path(tmp_path / 'ClassroomOS' / 'data').is_dir()


def test_serve_spa_assets(tmp_path, monkeypatch):
    # Create fake frontend dist
    dist_dir = tmp_path / 'dist'
    dist_dir.mkdir()
    (dist_dir / 'index.html').write_text('<!DOCTYPE html><html><head><title>ClassroomOS</title></head><body>Root</body></html>')
    (dist_dir / 'favicon.ico').write_text('icon-data')

    monkeypatch.setenv('FRONTEND_DIST_PATH', str(dist_dir))
    monkeypatch.setenv('SECRET_KEY', 'spa-test-secret')

    app = create_app({
        'TESTING': False,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'AUTO_BACKUP_BEFORE_MIGRATION': False
    })
    client = app.test_client()

    # Root route serves index.html
    root_res = client.get('/')
    assert root_res.status_code == 200
    assert '<title>ClassroomOS</title>' in root_res.get_data(as_text=True)

    # Specific static file
    icon_res = client.get('/favicon.ico')
    assert icon_res.status_code == 200
    assert icon_res.get_data(as_text=True) == 'icon-data'

    # Client-side SPA route returns index.html fallback
    spa_res = client.get('/attendance')
    assert spa_res.status_code == 200
    assert '<title>ClassroomOS</title>' in spa_res.get_data(as_text=True)

    # API 404 does not return index.html
    api_res = client.get('/api/nonexistent-endpoint')
    assert api_res.status_code == 404


def test_desktop_launcher_list_and_reset_admin(tmp_path, monkeypatch, capsys):
    from launcher import main
    monkeypatch.setenv('CLASSROOM_DESKTOP', '1')
    monkeypatch.setenv('LOCALAPPDATA', str(tmp_path))
    monkeypatch.setenv('SECRET_KEY', 'cli-test-secret')

    # Test --list-admins on empty database
    monkeypatch.setattr('sys.argv', ['launcher.py', '--list-admins'])
    with pytest.raises(SystemExit) as exc:
        main()
    assert exc.value.code == 0
    captured = capsys.readouterr().out
    assert 'No administrator accounts found' in captured

    # Bootstrap an admin user in the database
    from app import create_app
    from db import db
    from phase4_quality.models import User
    from werkzeug.security import generate_password_hash, check_password_hash

    app = create_app()
    with app.app_context():
        user = User(
            email='principal@school.test',
            full_name='Principal Skinner',
            role='admin',
            password_hash=generate_password_hash('OriginalAdminPass123', method='scrypt'),
            is_active=True
        )
        db.session.add(user)
        db.session.commit()

    # Test --list-admins with registered admin
    monkeypatch.setattr('sys.argv', ['launcher.py', '--list-admins'])
    with pytest.raises(SystemExit) as exc:
        main()
    assert exc.value.code == 0
    captured = capsys.readouterr().out
    assert 'principal@school.test' in captured
    assert 'Principal Skinner' in captured
    assert 'OriginalAdminPass123' not in captured  # No passwords exposed
    assert 'scrypt' not in captured  # No hashes exposed

    # Test --reset-admin with new password
    monkeypatch.setattr('sys.argv', [
        'launcher.py',
        '--reset-admin', 'principal@school.test',
        '--new-password', 'ResetAdminPass456'
    ])
    with pytest.raises(SystemExit) as exc:
        main()
    assert exc.value.code == 0
    captured = capsys.readouterr().out
    assert '[SUCCESS]' in captured

    # Verify password was updated in db
    with app.app_context():
        updated = User.query.filter_by(email='principal@school.test').one()
        assert check_password_hash(updated.password_hash, 'ResetAdminPass456')
        assert not check_password_hash(updated.password_hash, 'OriginalAdminPass123')

