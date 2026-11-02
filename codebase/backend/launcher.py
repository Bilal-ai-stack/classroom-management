"""Windows Desktop Launcher & Process Supervisor for ClassroomOS.

Runs as a clean Windows application without an unwanted Command Prompt window.
Supervises local Flask server readiness, single-instance routing, browser opening,
and diagnostic log output.
"""

import argparse
import ctypes
import os
import secrets
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from storage_manager import resolve_data_directory, ensure_storage_directories


class SafeOutputLogger:
    """Redirects stdout and stderr to a persistent log file and optional console."""

    def __init__(self, log_path, fallback_stream=None):
        self.log_path = Path(log_path)
        self.fallback = fallback_stream
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            self.file = open(self.log_path, 'a', encoding='utf-8', buffering=1)
        except Exception:
            self.file = None

    def write(self, message):
        if self.file:
            try:
                self.file.write(message)
                self.file.flush()
            except Exception:
                pass
        if self.fallback and hasattr(self.fallback, 'write'):
            try:
                self.fallback.write(message)
            except Exception:
                pass

    def flush(self):
        if self.file:
            try:
                self.file.flush()
            except Exception:
                pass
        if self.fallback and hasattr(self.fallback, 'flush'):
            try:
                self.fallback.flush()
            except Exception:
                pass


def show_native_message_box(title, message, is_error=True):
    """Display native Windows dialog box when operating without a console window."""
    if sys.platform == 'win32':
        try:
            icon_flag = 0x10 if is_error else 0x40  # MB_ICONERROR or MB_ICONINFORMATION
            ctypes.windll.user32.MessageBoxW(0, str(message), str(title), icon_flag)
            return
        except Exception:
            pass
    print(f"[{title}] {message}", file=sys.stderr)


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


def is_classroom_running(url, timeout=1.0):
    """Check if an active ClassroomOS instance is responding at the target URL."""
    try:
        req = urllib.request.Request(f"{url}/api/health", headers={'User-Agent': 'ClassroomOS-Launcher'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def wait_for_server_ready(url, timeout=20.0):
    """Poll health check endpoint until server is ready to accept HTTP traffic."""
    start = time.time()
    while time.time() - start < timeout:
        if is_classroom_running(url, timeout=0.5):
            return True
        time.sleep(0.15)
    return False


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
    try:
        secret_file.write_text(new_secret, encoding='utf-8')
    except Exception:
        pass
    return new_secret


def main():
    parser = argparse.ArgumentParser(description="ClassroomOS Desktop Launcher")
    parser.add_argument("--port", type=int, default=5000, help="Preferred loopback port (default: 5000)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (must be loopback for security)")
    parser.add_argument("--list-admins", action="store_true", help="List registered administrator accounts safely")
    parser.add_argument("--reset-admin", type=str, metavar="EMAIL", help="Recover/reset password for an administrator account")
    parser.add_argument("--new-password", type=str, help="New password for administrator reset")
    args = parser.parse_args()

    # 1. Resolve Data Directory and Setup Diagnostic Logging
    os.environ['CLASSROOM_DESKTOP'] = '1'
    data_dir = resolve_data_directory()
    storage_dirs = ensure_storage_directories(data_dir)
    log_file = storage_dirs['logs'] / 'launcher.log'

    # Redirect stdout and stderr safely so no unhandled windowed exceptions occur
    sys.stdout = SafeOutputLogger(log_file, sys.stdout)
    sys.stderr = SafeOutputLogger(log_file, sys.stderr)

    print("=" * 65)
    print(f"ClassroomOS Launcher Session: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Resolved Data Directory: {data_dir}")
    print(f"Diagnostic Log File:     {log_file}")
    print("=" * 65)

    if not os.environ.get('SECRET_KEY'):
        local_app_data = os.environ.get('LOCALAPPDATA') or str(data_dir.parent)
        os.environ['SECRET_KEY'] = get_or_create_desktop_secret(local_app_data)

    # 2. Check if ClassroomOS is already running on loopback (Single Instance Handling)
    default_url = f"http://{args.host}:{args.port}"
    if not (args.list_admins or args.reset_admin):
        if is_classroom_running(default_url):
            print(f"ClassroomOS instance is already running at {default_url}. Directing browser to existing session.")
            if not args.no_browser:
                webbrowser.open(default_url)
            sys.exit(0)

    # 3. Initialize Flask Application
    try:
        from app import create_app
        app = create_app()
    except Exception as err:
        error_msg = f"Failed to initialize ClassroomOS database and application:\n\n{err}\n\nReview diagnostic log:\n{log_file}"
        print(f"FATAL: {error_msg}", file=sys.stderr)
        show_native_message_box("ClassroomOS Startup Error", error_msg, is_error=True)
        sys.exit(1)

    # 4. Handle Administrator CLI Queries
    if args.list_admins:
        with app.app_context():
            from phase4_quality.models import User, utcnow
            admins = User.query.filter_by(role='admin').all()
            print("=" * 60)
            print("  ClassroomOS Registered Administrators")
            print("=" * 60)
            if not admins:
                print("  No administrator accounts found.")
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
                new_pass = getpass.getpass(f"Enter new password for '{email}': ")
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

            AuthSession.query.filter_by(user_id=user.id, revoked_at=None).update({'revoked_at': utcnow()})
            record_audit('user.admin_cli_recovery', 'user', user.id, {'email': email}, actor_user_id=user.id)
            db.session.commit()

            print(f"[SUCCESS] Password for administrator '{email}' reset successfully.")
            sys.exit(0)

    # 5. Enforce loopback binding for security
    if args.host not in ("127.0.0.1", "localhost"):
        err = "ClassroomOS desktop can only bind to loopback (127.0.0.1) for security."
        print(f"ERROR: {err}", file=sys.stderr)
        show_native_message_box("ClassroomOS Security Error", err, is_error=True)
        sys.exit(1)

    # 6. Resolve Target Port
    target_port = args.port
    if is_port_in_use(target_port, args.host):
        try:
            target_port = find_available_port(start_port=target_port + 1, host=args.host)
            print(f"Port {args.port} was in use; allocated alternate loopback port: {target_port}")
        except Exception as err:
            show_native_message_box("ClassroomOS Port Error", str(err), is_error=True)
            sys.exit(1)

    server_url = f"http://{args.host}:{target_port}"
    print(f"ClassroomOS starting at: {server_url}")

    # 7. Start Server Thread and Supervise Readiness
    server_thread = threading.Thread(
        target=lambda: app.run(host=args.host, port=target_port, debug=False, use_reloader=False),
        daemon=True
    )
    server_thread.start()

    # Wait for server to be responsive before opening browser
    if wait_for_server_ready(server_url, timeout=15.0):
        print("Server confirmed ready.")
        if not args.no_browser:
            print(f"Opening browser to {server_url}")
            webbrowser.open(server_url)
    else:
        err = f"ClassroomOS server started on {server_url} but did not respond to health check in 15 seconds."
        print(f"WARNING: {err}", file=sys.stderr)
        show_native_message_box("ClassroomOS Notice", err, is_error=False)
        if not args.no_browser:
            webbrowser.open(server_url)

    # Keep process supervisor running
    try:
        while server_thread.is_alive():
            server_thread.join(timeout=1.0)
    except (KeyboardInterrupt, SystemExit):
        print("\nClassroomOS shutting down cleanly.")


if __name__ == '__main__':
    main()
