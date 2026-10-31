# Architecture Decisions

## ADR-001 — Evolve the Flask/React system in place

Retain Flask, React, and the existing APIs while separating domain services incrementally. A rewrite or desktop-only replacement would add migration risk without improving the validated core. This stack is comfortable on an 8 GB Windows laptop when run as one backend process and static frontend.

## ADR-002 — SQLite for single-device offline use

Keep SQLite for the desktop edition, with foreign keys, WAL, busy timeout, integrity checks, versioned migrations, and application-controlled backups. Use PostgreSQL for genuine concurrent multi-PC deployment. Sharing SQLite on a network drive is rejected due to locking, corruption, and access-control risks.

## ADR-003 — Versioned migrations before schema expansion

Introduce Alembic/Flask-Migrate (or an equivalent explicit runner) and a backup gate before adding institution, enrollment, user, session, and audit tables. Continued `db.create_all()` evolution or destructive rebuilds are rejected because they cannot safely upgrade user data.

## ADR-004 — Manual attendance is authoritative

Attendance sessions and teacher-confirmed records are the source of truth. Photo detection may propose face regions only; it never finalizes attendance or converts non-detection to Absent. The modest extra interaction preserves consent-independent operation and prevents algorithmic absence decisions.

## ADR-005 — Photo processing fails closed and remains local

Use a maintained CPU-local detector only when installed and validated; return an explicit unavailable/error state otherwise. Do not generate synthetic candidate boxes, use a cloud dependency, infer identity, or infer emotion. Detection should run as a bounded background job so a large image cannot freeze the UI on integrated graphics.

## ADR-006 — Database-backed identities and least privilege

Replace demo accounts with hashed database credentials, expiring/revocable sessions, bootstrap onboarding, school/role/class scope, and audited privileged actions. Frontend-only role visibility and hard-coded accounts are not security controls.

## ADR-007 — Package the proven web core

First prove a supervised loopback Flask process serving the built SPA, then compare a lightweight native launcher/WebView with Electron. Tauri is not automatically simpler because it must still bundle and supervise Python. The final wrapper remains open until Windows resource and installer measurements exist.

## ADR-008 — Preserve historical enrollment context

Future attendance records must belong to an attendance session and enrollment/class-section snapshot, not infer history from the student's current class. Archive, transfer, and rollover must preserve old rows.

## ADR-009 — Dependency-free transactional migration runner

Use an explicit numbered SQLite migration runner in `migrations.py` rather than adding Alembic during this foundation batch. The application has one local SQLite database and only two legacy tables; the runner records every applied version, executes pending versions in transactions, and automatically creates a verified pre-migration backup for an existing file database. This is reversible: Alembic can adopt the recorded version and SQL when schema branching or multiple database engines justify its additional dependency.

## ADR-010 — Opaque server-side bearer sessions

Use 256-bit random bearer tokens, storing only SHA-256 token hashes in the database. Sessions expire after 12 hours and can be revoked on logout or password reset. Passwords use Werkzeug's maintained scrypt implementation. This keeps the current SPA/API shape while providing server-side revocation; production TLS remains mandatory if the API is ever exposed beyond loopback.
