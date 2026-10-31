# Security Foundation

## Accounts and sessions

- The first administrator is created once through `POST /api/auth/bootstrap`; the endpoint returns conflict after any user exists.
- Passwords require at least 12 characters, including a letter and number, and are stored with scrypt hashes. Plaintext passwords are never persisted or audited.
- Administrators create teacher/admin accounts through `POST /api/auth/users` and reset passwords through `POST /api/auth/users/<id>/reset-password`.
- Five failed login attempts lock an existing account for 15 minutes by default. Counters and lock expiry are persisted.
- Login issues an opaque random token. Only its SHA-256 hash is stored. Sessions expire after 12 hours and are revoked on logout or password reset.

## Authorization

Student data, dashboard statistics, attendance, reports, and photo routes require authentication. Teachers can read students and record/view attendance only for their assigned class. Student creation, editing, archival, account management, privacy audit/purge, and audit-event access require an administrator.

The public endpoints are health, privacy policy, one-time bootstrap, and login. Bootstrap must be completed locally before general access is allowed.

## Deployment requirements

- Set a long random `SECRET_KEY` outside source control. Startup fails if it is missing outside tests.
- Keep the backend bound to loopback for the offline desktop model. The Docker configuration is a development/server deployment and must not expose port 5000 to an untrusted LAN.
- CORS defaults to the local Vite origins rather than wildcard access.
- Use HTTPS and a server deployment with PostgreSQL if remote multi-user operation is introduced.

## Remaining security work

CSRF is not applicable to the current Authorization-header bearer design, but XSS can expose a token held in browser local storage. A desktop packaging batch should evaluate HttpOnly same-site cookies or an OS credential store. Global/IP rate limiting, administrator account deactivation, secret rotation, structured security logs, and a formal dependency vulnerability scan remain pending.
