"""Small, transactional SQLite migration runner for the local-first application."""

from datetime import datetime, timezone

from sqlalchemy import text


MIGRATIONS = (
    (1, 'initial_students_and_attendance', (
        """CREATE TABLE IF NOT EXISTS students (
            id INTEGER NOT NULL PRIMARY KEY,
            roll_number VARCHAR(20) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            class_name VARCHAR(50) NOT NULL,
            section VARCHAR(20) NOT NULL DEFAULT 'A',
            guardian_contact VARCHAR(50),
            enrollment_date VARCHAR(20) NOT NULL,
            photo_path VARCHAR(255),
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME,
            updated_at DATETIME,
            CONSTRAINT uq_student_roll_class_section UNIQUE (roll_number, class_name, section)
        )""",
        """CREATE TABLE IF NOT EXISTS attendances (
            id INTEGER NOT NULL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            date VARCHAR(10) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Present',
            remarks VARCHAR(255),
            created_at DATETIME,
            updated_at DATETIME,
            CONSTRAINT uq_student_date UNIQUE (student_id, date),
            FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE
        )""",
        "CREATE INDEX IF NOT EXISTS ix_attendance_date ON attendances (date)",
    )),
    (2, 'persistent_authentication_and_audit', (
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER NOT NULL PRIMARY KEY,
            email VARCHAR(254) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL,
            assigned_class VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT 1,
            failed_login_count INTEGER NOT NULL DEFAULT 0,
            locked_until DATETIME,
            password_changed_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            CHECK (role IN ('admin', 'teacher'))
        )""",
        """CREATE TABLE IF NOT EXISTS auth_sessions (
            id INTEGER NOT NULL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            created_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )""",
        "CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_auth_sessions_expiry ON auth_sessions (expires_at)",
        """CREATE TABLE IF NOT EXISTS audit_events (
            id INTEGER NOT NULL PRIMARY KEY,
            actor_user_id INTEGER,
            action VARCHAR(80) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(64),
            details TEXT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE SET NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_audit_events_created ON audit_events (created_at)",
        "CREATE INDEX IF NOT EXISTS ix_audit_events_actor ON audit_events (actor_user_id)",
    )),
    (3, 'attendance_sessions_and_historical_snapshot', (
        """CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INTEGER NOT NULL PRIMARY KEY,
            class_name VARCHAR(50) NOT NULL,
            section VARCHAR(20) NOT NULL DEFAULT 'A',
            date VARCHAR(10) NOT NULL,
            session_type VARCHAR(20) NOT NULL DEFAULT 'Daily',
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            finalized_at DATETIME,
            finalized_by_user_id INTEGER,
            reopened_at DATETIME,
            reopened_by_user_id INTEGER,
            reopen_reason TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            CHECK (status IN ('open', 'finalized')),
            CONSTRAINT uq_session_class_section_date UNIQUE (class_name, section, date),
            FOREIGN KEY(finalized_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
            FOREIGN KEY(reopened_by_user_id) REFERENCES users (id) ON DELETE SET NULL
        )""",
        "CREATE INDEX IF NOT EXISTS ix_attendance_sessions_date ON attendance_sessions (date)",
        "CREATE INDEX IF NOT EXISTS ix_attendance_sessions_class ON attendance_sessions (class_name, section)",
        "ALTER TABLE attendances ADD COLUMN session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE SET NULL",
        "ALTER TABLE attendances ADD COLUMN snapshot_class_name VARCHAR(50)",
        "ALTER TABLE attendances ADD COLUMN snapshot_section VARCHAR(20)",
        "ALTER TABLE attendances ADD COLUMN updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_attendances_session ON attendances (session_id)",
    )),
)


def run_migrations(engine):
    """Upgrade a database to the latest known schema without deleting data."""
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER NOT NULL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                applied_at DATETIME NOT NULL
            )"""
        )
        applied = {
            row[0] for row in connection.execute(text('SELECT version FROM schema_migrations'))
        }
        for version, name, statements in MIGRATIONS:
            if version in applied:
                continue
            for statement in statements:
                try:
                    connection.exec_driver_sql(statement)
                except Exception as ex:
                    if 'duplicate column name' in str(ex).lower():
                        continue
                    raise
            connection.execute(
                text('INSERT INTO schema_migrations (version, name, applied_at) VALUES (:version, :name, :applied_at)'),
                {'version': version, 'name': name, 'applied_at': datetime.now(timezone.utc).isoformat()},
            )


def current_schema_version(engine):
    with engine.connect() as connection:
        exists = connection.exec_driver_sql(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
        ).first()
        if not exists:
            return 0
        return connection.execute(text('SELECT COALESCE(MAX(version), 0) FROM schema_migrations')).scalar_one()
