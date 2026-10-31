"""Windows Desktop Launcher & Process Supervisor for ClassroomOS."""

import argparse
import os
import secrets
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path


def is_port_in_use(port, host='127.0.0.1'):
    """Check if a TCP port is occupied on loopback."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def find_available_port(start_port=5000, max_attempts=50, host='127.0.0.1'):
    """Find the next available loopback port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        if not is_port_in_use(port, host):
            return port
    raise RuntimeError(f"Could not find an available port in range {start_port}-{start_port + max_attempts}")


def get_or_create_desktop_secret(local_app_data):
    """Retrieve or generate a secure persistent secret key stored in LocalAppData."""
    app_dir = Path(local_app_data) / 'ClassroomOS'
    app_dir.mkdir(parents=True, exist_ok=True)
    secret_file = app_dir / 'secret.key'

    if secret_file.is_file():
        content = secret_file.read_text(encoding='utf-8').strip()
        if len(content) >= 32:
            return content

    new_secret = secrets.token_urlsafe(48)
    secret_file.write_text(new_secret, encoding='utf-8')
    return new_secret


def open_browser_delayed(url, delay=1.2):
    """Open browser in a background thread once the server has spun up."""
    def _open():
        time.sleep(delay)
        print(f"Opening ClassroomOS in default browser: {url}")
        webbrowser.open(url)
    t = threading.Thread(target=_open, daemon=True)
    t.start()


def main():
    parser = argparse.ArgumentParser(description="ClassroomOS Desktop Launcher")
    parser.add_argument("--port", type=int, default=5000, help="Preferred loopback port (default: 5000)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (must be loopback for security)")
    parser.add_argument("--list-admins", action="store_true", help="List registered administrator accounts safely (no credentials exposed)")
    parser.add_argument("--reset-admin", type=str, metavar="EMAIL", help="Recover/reset password for an administrator account")
    parser.add_argument("--new-password", type=str, help="New password for administrator reset (min 12 chars, letters & numbers)")
    args = parser.parse_args()

    # Configure Desktop Environment & Paths
    os.environ['CLASSROOM_DESKTOP'] = '1'
    local_app_data = os.environ.get('LOCALAPPDATA') or str(Path.home() / 'AppData' / 'Local')
    os.environ['LOCALAPPDATA'] = local_app_data

    if not os.environ.get('SECRET_KEY'):
        os.environ['SECRET_KEY'] = get_or_create_desktop_secret(local_app_data)

    # Initialize Flask Application with SQLite migrations
    from app import create_app
    app = create_app()

    # Handle Administrator Recovery & Audit Queries
    if args.list_admins:
        with app.app_context():
            from phase4_quality.models import User
            admins = User.query.filter_by(role='admin').all()
            print("=" * 60)
            print("  ClassroomOS Registered Administrators")
            print("=" * 60)
            if not admins:
                print("  No administrator accounts found in the database.")
            for a in admins:
                status = "Active" if a.is_active else "Inactive"
                locked = " [LOCKED]" if (a.locked_until and a.locked_until > utcnow()) else ""
                print(f"  • ID: {a.id} | Email: {a.email} | Name: {a.full_name} | Status: {status}{locked}")
            print("=" * 60)
            sys.exit(0)

    if args.reset_admin:
        email = args.reset_admin.strip().lower()
        with app.app_context():
            from phase4_quality.models import User, AuthSession, record_audit, utcnow
            from phase4_quality.auth import password_error
            from werkzeug.security import generate_password_hash
            from db import db

            user = User.query.filter_by(email=email).first()
            if not user:
                print(f"ERROR: No user found with email '{email}'.", file=sys.stderr)
                sys.exit(1)
            if user.role != 'admin':
                print(f"ERROR: User '{email}' has role '{user.role}', not 'admin'.", file=sys.stderr)
                sys.exit(1)

            new_pass = args.new_password
            if not new_pass:
                import getpass
                new_pass = getpass.getpass(f"Enter new password for administrator '{email}': ")
                confirm = getpass.getpass("Confirm new password: ")
                if new_pass != confirm:
                    print("ERROR: Passwords do not match.", file=sys.stderr)
                    sys.exit(1)

            err = password_error(new_pass)
            if err:
                print(f"ERROR: {err}", file=sys.stderr)
                sys.exit(1)

            user.password_hash = generate_password_hash(new_pass, method='scrypt')
            user.password_changed_at = utcnow()
            user.failed_login_count = 0
            user.locked_until = None
            user.is_active = True

            # Revoke existing sessions for security
            AuthSession.query.filter_by(user_id=user.id, revoked_at=None).update({'revoked_at': utcnow()})
            record_audit('user.admin_cli_recovery', 'user', user.id, {'email': email}, actor_user_id=user.id)
            db.session.commit()

            print("=" * 60)
            print(f"  [SUCCESS] Password for administrator '{email}' reset successfully.")
            print("  All existing sessions revoked and account lockout was cleared.")
            print("=" * 60)
            sys.exit(0)

    # Enforce loopback binding for security
    if args.host not in ("127.0.0.1", "localhost"):
        print("ERROR: For security, ClassroomOS desktop can only bind to loopback (127.0.0.1).", file=sys.stderr)
        sys.exit(1)

    target_port = args.port
    if is_port_in_use(target_port, args.host):
        print(f"Port {target_port} is in use. Searching for an available loopback port...")
        target_port = find_available_port(start_port=target_port + 1, host=args.host)
        print(f"Selected alternate loopback port: {target_port}")

    server_url = f"http://{args.host}:{target_port}"
    print("=" * 60)
    print("  ClassroomOS — Local Desktop Service")
    print(f"  Interface:  {server_url}")
    print(f"  Storage:    {Path(local_app_data) / 'ClassroomOS' / 'data'}")
    print("=" * 60)

    if not args.no_browser:
        open_browser_delayed(server_url)

    try:
        # Run local server
        app.run(host=args.host, port=target_port, debug=False)
    except KeyboardInterrupt:
        print("\nClassroomOS stopped cleanly. Goodbye!")


if __name__ == '__main__':
    main()
