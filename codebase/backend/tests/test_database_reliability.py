import sqlite3

import pytest
from sqlalchemy import text

from app import create_app
from database_tools import create_backup, integrity_check, restore_backup, verify_backup
from db import db
from migrations import current_schema_version


def create_legacy_database(path):
    connection = sqlite3.connect(path)
    connection.executescript("""
        CREATE TABLE students (
            id INTEGER NOT NULL PRIMARY KEY,
            roll_number VARCHAR(20) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            class_name VARCHAR(50) NOT NULL,
            section VARCHAR(20) NOT NULL DEFAULT 'A',
            guardian_contact VARCHAR(50), enrollment_date VARCHAR(20) NOT NULL,
            photo_path VARCHAR(255), notes TEXT, is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME, updated_at DATETIME,
            CONSTRAINT uq_student_roll_class_section UNIQUE (roll_number, class_name, section)
        );
        CREATE TABLE attendances (
            id INTEGER NOT NULL PRIMARY KEY, student_id INTEGER NOT NULL,
            date VARCHAR(10) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Present',
            remarks VARCHAR(255), created_at DATETIME, updated_at DATETIME,
            CONSTRAINT uq_student_date UNIQUE (student_id, date),
            FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE
        );
        INSERT INTO students (id, roll_number, full_name, class_name, section, enrollment_date, is_active)
        VALUES (1, 'KEEP-1', 'Existing Student', 'Grade 1', 'A', '2025-01-01', 1);
        INSERT INTO attendances (student_id, date, status) VALUES (1, '2026-10-01', 'Present');
    """)
    connection.commit()
    connection.close()


def test_legacy_database_migrates_without_changing_records(tmp_path):
    database = tmp_path / 'legacy.db'
    create_legacy_database(database)
    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'test-secret',
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{database.as_posix()}',
    })
    backups = list((tmp_path / 'backups').glob('pre-migration-v0-*.db'))
    assert len(backups) == 1
    assert verify_backup(backups[0])
    with app.app_context():
        assert current_schema_version(db.engine) == 6
        student = db.session.execute(text('SELECT roll_number, full_name FROM students WHERE id = 1')).one()
        attendance = db.session.execute(text('SELECT date, status FROM attendances WHERE student_id = 1')).one()
        assert tuple(student) == ('KEEP-1', 'Existing Student')
        assert tuple(attendance) == ('2026-10-01', 'Present')
        pragmas = db.session.connection().exec_driver_sql('PRAGMA foreign_keys').scalar_one()
        timeout = db.session.connection().exec_driver_sql('PRAGMA busy_timeout').scalar_one()
        journal = db.session.connection().exec_driver_sql('PRAGMA journal_mode').scalar_one()
        assert pragmas == 1
        assert timeout == 5000
        assert journal.lower() == 'wal'


def test_backup_verification_restore_and_overwrite_protection(tmp_path):
    source = tmp_path / 'source.db'
    create_legacy_database(source)
    backup = tmp_path / 'backups' / 'classroom.db'
    manifest = create_backup(source, backup)
    assert manifest['integrity_check'] == 'ok'
    assert verify_backup(backup)
    assert integrity_check(backup)

    restored = tmp_path / 'restored.db'
    restore_backup(backup, restored)
    assert integrity_check(restored)
    connection = sqlite3.connect(restored)
    try:
        assert connection.execute('SELECT full_name FROM students WHERE id = 1').fetchone()[0] == 'Existing Student'
    finally:
        connection.close()

    with pytest.raises(FileExistsError):
        restore_backup(backup, restored)
    with pytest.raises(FileExistsError):
        create_backup(source, backup)


def test_tampered_backup_is_rejected(tmp_path):
    source = tmp_path / 'source.db'
    create_legacy_database(source)
    backup = tmp_path / 'backup.db'
    create_backup(source, backup)
    with backup.open('ab') as handle:
        handle.write(b'tampered')
    assert not verify_backup(backup)
    with pytest.raises(ValueError):
        restore_backup(backup, tmp_path / 'should-not-exist.db')
    assert not (tmp_path / 'should-not-exist.db').exists()
