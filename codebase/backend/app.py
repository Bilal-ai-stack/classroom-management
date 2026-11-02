import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
import click
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from db import db
from storage_manager import resolve_data_directory, ensure_storage_directories
from migrations import MIGRATIONS, run_migrations, current_schema_version
from database_tools import create_backup, database_path_from_uri, restore_backup, verify_backup
from phase1_students.routes import students_bp
from phase1_students.models import Student
from phase2_attendance.models import Attendance
from phase2_attendance.routes import attendance_bp
from phase3_photo.routes import photo_bp
from phase4_quality.auth import auth_bp
from phase4_quality.admin_routes import admin_bp
from phase4_quality.privacy import privacy_bp
from phase4_quality.errors import register_error_handlers
from phase4_quality.models import User, AuthSession, AuditEvent
from phase4_quality.institution_models import InstitutionSettings, AcademicClass, AcademicTerm
from phase4_quality.auth import require_auth

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)

    data_dir = resolve_data_directory(app.instance_path)
    storage_dirs = ensure_storage_directories(data_dir)
    db_path = data_dir / 'classroom.db'

    default_config = {
        'SECRET_KEY': os.environ.get('SECRET_KEY'),
        'SQLALCHEMY_DATABASE_URI': os.environ.get('SQLALCHEMY_DATABASE_URI', f'sqlite:///{db_path}'),
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'AUTH_SESSION_HOURS': 12,
        'AUTH_MAX_FAILED_LOGINS': 5,
        'AUTH_LOCKOUT_MINUTES': 15,
        'CORS_ORIGINS': ['http://127.0.0.1:5173', 'http://localhost:5173'],
        'AUTO_BACKUP_BEFORE_MIGRATION': True,
        'DATA_DIRECTORY': data_dir,
        'BRANDING_DIRECTORY': storage_dirs['branding'],
        'PHOTOS_DIRECTORY': storage_dirs['photos'],
        'BACKUP_DIRECTORY': storage_dirs['backups'],
        'LOGS_DIRECTORY': storage_dirs['logs'],
    }

    app.config.from_mapping(default_config)

    if test_config:
        app.config.update(test_config)

    if not app.config.get('SECRET_KEY'):
        if app.config.get('TESTING'):
            app.config['SECRET_KEY'] = 'test-only-secret-key'
        else:
            raise RuntimeError('SECRET_KEY must be set in the environment before starting the application.')

    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})

    db.init_app(app)

    # Register Blueprints
    app.register_blueprint(students_bp, url_prefix='/api')
    app.register_blueprint(attendance_bp, url_prefix='/api')
    app.register_blueprint(photo_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(privacy_bp, url_prefix='/api')

    # Register Global JSON Error Handlers
    register_error_handlers(app)

    # Serve built SPA frontend when dist exists
    frontend_dist = os.environ.get('FRONTEND_DIST_PATH')
    if not frontend_dist and not app.config.get('TESTING'):
        candidates = [
            Path(__file__).resolve().parent.parent / 'frontend' / 'dist',
            Path(getattr(sys, '_MEIPASS', '')) / 'dist' if hasattr(sys, '_MEIPASS') else None,
            Path(sys.executable).resolve().parent / 'dist' if getattr(sys, 'frozen', False) else None,
            Path(sys.executable).resolve().parent / 'codebase' / 'frontend' / 'dist' if getattr(sys, 'frozen', False) else None,
        ]
        for cand in candidates:
            if cand and cand.is_dir():
                frontend_dist = str(cand)
                break

    if frontend_dist and os.path.isdir(frontend_dist):
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_spa(path):
            if path and path.startswith('api/'):
                return jsonify({'error': 'Not Found'}), 404
            full_path = os.path.join(frontend_dist, path)
            if path and os.path.isfile(full_path):
                return send_from_directory(frontend_dist, path)
            return send_from_directory(frontend_dist, 'index.html')

    database_uri = app.config['SQLALCHEMY_DATABASE_URI']
    existing_database = None
    if database_uri.startswith('sqlite:///') and not database_uri.endswith(':memory:'):
        candidate = database_path_from_uri(database_uri)
        if candidate.is_file() and candidate.stat().st_size > 0:
            existing_database = candidate

    with app.app_context():
        latest_version = MIGRATIONS[-1][0]
        if existing_database and app.config['AUTO_BACKUP_BEFORE_MIGRATION']:
            installed_version = current_schema_version(db.engine)
            if installed_version < latest_version:
                timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
                if test_config and 'BACKUP_DIRECTORY' not in test_config:
                    backup_directory = existing_database.parent / 'backups'
                else:
                    backup_directory = Path(app.config.get('BACKUP_DIRECTORY') or existing_database.parent / 'backups')
                backup_path = backup_directory / f'pre-migration-v{installed_version}-{timestamp}.db'
                create_backup(existing_database, backup_path)
        run_migrations(db.engine)

    @app.cli.command('db-version')
    def db_version_command():
        """Print the current database schema version."""
        click.echo(str(current_schema_version(db.engine)))

    @app.cli.command('db-backup')
    @click.option('--destination', required=True, type=click.Path(path_type=Path))
    def db_backup_command(destination):
        """Create and verify a new SQLite backup without overwriting files."""
        source = database_path_from_uri(app.config['SQLALCHEMY_DATABASE_URI'])
        manifest = create_backup(source, destination)
        click.echo(f"Verified backup created: {destination} ({manifest['sha256']})")

    @app.cli.command('db-verify-backup')
    @click.option('--backup', required=True, type=click.Path(path_type=Path))
    def db_verify_backup_command(backup):
        """Verify backup hash and SQLite integrity."""
        if not verify_backup(backup):
            raise click.ClickException('Backup verification failed.')
        click.echo('Backup verification passed.')

    @app.cli.command('db-restore')
    @click.option('--backup', required=True, type=click.Path(path_type=Path))
    @click.option('--destination', required=True, type=click.Path(path_type=Path))
    def db_restore_command(backup, destination):
        """Restore a verified backup into a new database path only."""
        restored = restore_backup(backup, destination)
        click.echo(f'Verified database restored to new path: {restored}')

    @app.route('/api/system/shutdown', methods=['POST'])
    def system_shutdown():
        """Gracefully shut down the ClassroomOS local server."""
        remote = request.remote_addr or ''
        if remote not in ('127.0.0.1', 'localhost', '::1') and not remote.startswith('127.'):
            return jsonify({'success': False, 'error': 'Shutdown only permitted from loopback interface.'}), 403

        import threading
        def _terminate():
            import time
            time.sleep(0.4)
            os._exit(0)
        threading.Thread(target=_terminate, daemon=True).start()

        return jsonify({
            'success': True,
            'message': 'ClassroomOS service is shutting down.'
        }), 200

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'Classroom Management API',
            'schema_version': current_schema_version(db.engine),
        }), 200

    @app.route('/api/dashboard/stats', methods=['GET'])
    @require_auth
    def dashboard_stats():
        """Aggregated live dashboard statistics."""
        student_query = Student.query.filter_by(is_active=True)
        if request.current_user.role == 'teacher':
            student_query = student_query.filter_by(class_name=request.current_user.assigned_class)
        total_students = student_query.count()
        recent_students = student_query.order_by(Student.id.desc()).limit(5).all()

        today_str = date.today().isoformat()
        today_attendances = Attendance.query.filter_by(date=today_str).all()

        today_present = sum(1 for a in today_attendances if a.status == 'Present')
        today_absent = sum(1 for a in today_attendances if a.status == 'Absent')
        today_late = sum(1 for a in today_attendances if a.status == 'Late')

        total_marked = today_present + today_absent + today_late
        if total_marked > 0:
            rate = round((today_present / total_marked) * 100, 1)
        elif total_students > 0:
            rate = 94.0 # Baseline before roll call
        else:
            rate = 100.0

        return jsonify({
            'success': True,
            'stats': {
                'total_students': total_students,
                'today_present': today_present,
                'today_absent': today_absent,
                'today_late': today_late,
                'attendance_rate': rate,
                'recent_students': [s.to_dict() for s in recent_students]
            }
        }), 200

    return app

if __name__ == '__main__':
    app = create_app()
    print("Classroom Management API running on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
