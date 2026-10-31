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
    args = parser.parse_args()

    # Enforce loopback binding for security
    if args.host not in ("127.0.0.1", "localhost"):
        print("ERROR: For security, ClassroomOS desktop can only bind to loopback (127.0.0.1).", file=sys.stderr)
        sys.exit(1)

    # Configure Desktop Environment & Paths
    os.environ['CLASSROOM_DESKTOP'] = '1'
    local_app_data = os.environ.get('LOCALAPPDATA') or str(Path.home() / 'AppData' / 'Local')
    os.environ['LOCALAPPDATA'] = local_app_data

    if not os.environ.get('SECRET_KEY'):
        os.environ['SECRET_KEY'] = get_or_create_desktop_secret(local_app_data)

    target_port = args.port
    if is_port_in_use(target_port, args.host):
        print(f"Port {target_port} is in use. Searching for an available loopback port...")
        target_port = find_available_port(start_port=target_port + 1, host=args.host)
        print(f"Selected alternate loopback port: {target_port}")

    # Initialize Flask Application with SQLite migrations
    from app import create_app
    app = create_app()

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
