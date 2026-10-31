# Codex Audit — Classroom Management System 2.0

**Audit date:** 2026-10-29  
**Repository:** `C:/Users/Bilal ahmad/OneDrive/Desktop/Classroom Management`  
**Branch:** `feature/classroom-v2`  
**Starting worktree:** clean

## Executive finding

This is a working practice MVP, not a distribution-ready school system. It has a React single-page UI, Flask JSON API, SQLite models for students and daily attendance, a manual roster, reports, and a human-reviewed photo screen. The baseline tests pass, but production claims in the README exceed the implementation. Authentication uses hard-coded plaintext demo accounts, most data routes are not protected, there are no migrations or backup/restore facilities, and the photo implementation was capable of fabricating detections when its engine was unavailable. The latter and unsafe attendance validation were addressed in the first implementation batch; the security and product-model gaps remain release blockers.

## Repository and runtime map

| Area | Actual implementation | Evidence |
|---|---|---|
| Frontend | React 19 SPA built by Vite 8; one large `App.jsx`; browser token storage and fetch wrapper | `codebase/frontend/src/App.jsx`, `src/shared/api.js`, `package.json` |
| Backend | Flask application factory and five blueprints | `codebase/backend/app.py` |
| Data | SQLite created at startup with `db.create_all()`; no migrations | `app.py`, `db.py` |
| Domain | `Student` and `Attendance` only | `phase1_students/models.py`, `phase2_attendance/models.py` |
| Photo | OpenCV Haar detection when installed; face boxes/crops returned inline; no recognition | `phase3_photo/detector.py`, `routes.py` |
| Deployment | Docker Compose: Nginx frontend + Gunicorn backend; SQLite Docker volume | `docker-compose.yml`, Dockerfiles |
| CI | backend pytest plus frontend lint/build workflows | `.github/workflows/ci.yml` |
| Windows desktop | None | no wrapper, installer, packaging workflow, or release manifest |

Observed local tools: Python 3.14.7, Flask 3.1.3, Flask-SQLAlchemy 3.1.1, pytest 9.1.1, Node 24.18.1, npm 11.16.0. Docker targets Python 3.11 and Node 20, so local/CI/runtime version alignment must be tightened.

Entry points are `codebase/backend/app.py` and `codebase/frontend/src/main.jsx`. Development runs Flask on loopback port 5000 and Vite on port 5173. Docker exposes the backend on all interfaces through host port 5000 and uses permissive CORS, which is unsuitable for the proposed local desktop release.

## Functional matrix

| Capability | Status | Evidence / gap |
|---|---|---|
| Student CRUD/archive/search | Partial | API and UI exist; no RBAC, pagination, audit, transfer, guardian model, or server CSV import |
| Portfolio | Partial | modal shows identity and attendance; no enrollment history, assessments, achievements, documents, or permission model |
| Manual attendance | Partial | roster, bulk actions, remarks, save and uniqueness exist; no sessions, finalization/reopen, corrections, holidays, sections in filter, audit, authorization, Excused/Unverified states, or policy denominator |
| Attendance reports/CSV | Partial | date/class report and browser CSV exist; calculations treat only Present as attendance and empty data as 100%; no PDF/print policy or academic calendar |
| Photo capture/upload | Partial | single file upload and bounding-box review; no webcam, rotation/crop, multi-photo session, cancellation, durable job state, quality checks, or reliable engine verification in this environment |
| Facial recognition | Not implemented | correct default for current maturity; no embeddings or identity model |
| Authentication | Unsafe demo only | hard-coded plaintext accounts/passwords and in-memory tokens in `phase4_quality/auth.py` |
| Authorization/RBAC | Missing | student, attendance, photo, privacy, report, and dashboard routes are unprotected |
| Admin portal/configuration | Missing | no school, staff, class, subject, session, calendar, settings, assignments, roles, or import APIs |
| Backup/migrations | Missing | `db.create_all()` only; no schema version, backup, restore, validation, or rollover |
| Offline web operation | Partial | core stack can be local, but developer runtimes/Docker are required |
| Windows installer | Missing | no `.exe`, wrapper, app-data strategy, upgrade/uninstall behavior, or signing |
| Accessibility | Partial/unverified | some ARIA and semantic elements; no automated axe/E2E, screen-reader, zoom, contrast, or full keyboard evidence |

## Attendance audit

Manual entry is implemented with a class/date roster and per-student Present/Late/Absent controls. The database enforces one row per student per date. Before this audit, invalid status values were silently changed to Present and mixed-validity batches committed partial results. The first v2 batch now validates ISO calendar dates, status values, duplicate IDs, active students, and student existence before an atomic write.

There is no attendance-session entity, class/section ownership snapshot, academic-calendar handling, late-enrollment cutoff, finalization, reopen reason, correction history, or actor audit. A student's current class is joined into historical records, so transfers can mislabel historical class reports. Empty reports and rosters report 100%, which is misleading. The model must evolve through versioned migrations rather than replacement.

## Photo and privacy audit

The UI uploads one image and asks a teacher to associate returned face candidates with students. It does not automatically identify students or mark unseen students absent. This is a sound MVP boundary. However, the previous detector generated four plausible face boxes when OpenCV was missing or failed, making fabricated evidence appear real. That behavior has been removed: processing now fails closed, invalid bytes are rejected when OpenCV is available, and a 10 MB request limit is enforced at the route.

The current environment lacks OpenCV despite `opencv-python-headless` being declared, so successful real-image detection is not verified. Returned base64 crops remain in browser/API memory; cleanup endpoints do not correspond to stored artifacts. Extension-only checks remain insufficient until content verification is tested with the installed engine and pixel/dimension/decompression limits are added. Privacy text claims “Compliant” without a legal or technical compliance assessment and must be rewritten before release.

## Security, integrity, and operations

P0 release blockers:

- Replace hard-coded accounts, plaintext passwords, predictable token material, and process-memory sessions with database users, modern password hashing, revocable expiring sessions, secure bootstrap, and rate limiting.
- Protect every mutation and sensitive read with server-side role and class/school scope checks.
- Move `SECRET_KEY` out of source, reject unsafe production defaults, restrict CORS and loopback exposure, and disable debug mode outside explicit development.
- Introduce transactional, versioned migrations and tested pre-upgrade backups before schema expansion.
- Add audit events for attendance and sensitive administration.

SQLite is appropriate for one local device, but WAL, foreign-key enforcement, busy timeouts, integrity checks, and backup semantics are not configured. SQLite must not be put on a shared network drive for multi-user access.

## Baseline verification

From `codebase/backend`: `.\venv\Scripts\python.exe -m pytest tests -q` produced **29 passed, 1 warning** in 3.30s. The warning is a denied/broken `.pytest_cache` path in the OneDrive workspace.

From `codebase/frontend`, `npm.cmd run lint` exited 0 with four `react(set-state-in-effect)` warnings in `App.jsx`; `npm.cmd run build` exited 0 after transforming 1,937 modules (JS 290.67 kB / 84.83 kB gzip; CSS 16.87 kB).

The app was not visually inspected in a browser during this pass, and no screenshot or installer was generated. Docker and offline installation were not tested.

## Prioritized roadmap

### P0 — release safety foundation

1. Versioned migrations plus verified backup/restore and SQLite safety settings. Acceptance: an existing fixture upgrades, rolls back from backup, and passes integrity checks.
2. Persistent users, password hashing, bootstrap admin, expiring sessions, RBAC/scoping, CSRF/session decision, and route coverage. Acceptance: every protected route has unauthenticated, wrong-role, and cross-class tests.
3. Attendance sessions, status policy, finalization/reopen/correction audit, class/section snapshot, valid dates, and atomic saves. Acceptance: edge-case and report-math tests cover all status/date rules.
4. Photo upload hardening and deterministic local-engine tests. Acceptance: fake, oversized, decompression-bomb, no-face, and multi-face fixtures fail/succeed explicitly without invented faces.

### P1 — usable configurable product

Add institution settings, academic sessions/terms, classes/sections, subjects, calendars, staff/assignments, student enrollment history, guardians, CSV dry-run/import, admin UI, audit trail, and usable teacher daily-attendance flow. Split the monolithic frontend into routed feature modules with accessible shared components.

### P2 — reporting, privacy, and resilience

Add policy-driven metrics, printable/PDF reports, portfolios, retention/consent records, structured logging without PII, backup UI, restore drill, responsive and accessibility E2E tests, and tested local photo job progress/cancellation.

### P3 — Windows distribution

After the web core is stable, package Flask plus the built SPA using a small native launcher or browser-shell proof of concept, store data under per-user LocalAppData, bind to loopback, supervise ports/processes, and build an installer in Windows CI. Test clean install, offline restart, upgrade, backup/restore, and uninstall retention. Do not add recognition until an explicit consent, governance, and evaluation project exists.

## Known audit limitations

No real student data was opened or modified. No production database, external service, camera, Docker daemon, browser accessibility tool, or Windows installer environment was exercised. Dependency vulnerability and license scans remain pending.
