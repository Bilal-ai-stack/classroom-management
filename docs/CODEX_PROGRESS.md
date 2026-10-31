# Codex Progress — Classroom Management System 2.0

## Milestone status (2026-10-31)

| Milestone | Status | Evidence |
|---|---|---|
| Audit and baseline | Completed | `CODEX_AUDIT.md`; commands below |
| Data-integrity safety batch | Implemented and tested | atomic attendance validation and photo fail-closed changes |
| Database reliability | Implemented and tested | schema v3 migrations, SQLite safety settings, verified backup/restore |
| Secure authentication/RBAC | Implemented and tested | persistent users/sessions, scrypt, lockout, class scope, admin reset and audit |
| Attendance sessions, finalization, corrections | Implemented and tested | sessions, finalize/reopen/reason, correction audit, Excused/Unverified policy math, snapshot — 52 tests pass |
| Photo pipeline hardening | Implemented and tested | fail-closed detection, Pillow verification, 25MP decompression bomb limit, 6000px bounds, teacher scoping — 62 tests pass |
| Domain/admin foundation | In progress | secure APIs exist; full configurable school/admin model underway |
| UI redesign/reporting/backup | Not started | existing MVP only |
| Windows release | Not started | no installer artifact exists |

## Implemented in this batch (2026-10-31)

### Migration 3 — Attendance Sessions & Historical Snapshot
- Added `attendance_sessions` table (`class_name`, `section`, `date`, `status`: open/finalized, `finalized_by`, `reopened_by`, `reopen_reason`).
- Added columns to `attendances`: `session_id`, `snapshot_class_name`, `snapshot_section`, `updated_by_user_id`.
- Migration runner hardened to skip duplicate-column errors for idempotent re-runs.
- Updated schema version to 3; `test_database_reliability.py` asserts `current_schema_version == 3`.

### Attendance Models
- New `AttendanceSession` SQLAlchemy model with finalization gate, reopen audit fields, and `is_finalized` property.
- `Attendance` model updated with snapshot fields (`snapshot_class_name`, `snapshot_section`) and `updated_by_user_id` FK.
- `to_dict()` now returns historical class/section from snapshot when present, preventing transfer corruption.

### Attendance Routes (complete overhaul)
- **New valid statuses**: `Present`, `Absent`, `Late`, **`Excused`**, **`Unverified`** — case-insensitive normalisation.
- **Policy-driven attendance math** (`calculate_attendance_rates`):
  - Rate = (Present + Late) / (Present + Late + Absent + Unverified).
  - Excused is excluded from the denominator entirely.
  - Empty roster returns `0.0`, not the misleading `100.0`.
- **Session auto-creation**: `POST /attendance/bulk` auto-creates an open `AttendanceSession` on first save per class/section/date.
- **Finalization gate**: saving to a finalized session returns `409 Conflict`.
- **Correction audit**: upserts that change status or remarks emit an `attendance.correction` AuditEvent with before/after values.
- **Snapshot capture**: every write records `snapshot_class_name` and `snapshot_section` from the student's class at save time.
- `GET /attendance` now includes a `session` object showing finalization state and summary counts for all five statuses.
- **New endpoint** `POST /attendance/session/finalize` — finalizes a session, links any un-linked attendance records.
- **New endpoint** `POST /attendance/session/reopen` — reopens with mandatory reason (≥5 chars), audited.
- **New endpoint** `GET /attendance/session` — returns session detail + full audit trail from `AuditEvent`.
- Reports and student history updated to use policy math and snapshot-based class filter.

### Test Coverage (52 tests, 0 failures)
New `test_attendance_sessions.py` (22 tests) covers:
- Session created implicitly on save.
- Roster includes session status.
- Finalization marks session and links attendance.
- Cannot save to finalized session (409).
- Finalize idempotency.
- Finalize creates session if missing.
- Reopen records reason and auditor.
- Reopen requires reason ≥ 5 chars.
- Cannot reopen an already-open session.
- Can save after reopen.
- Correction creates AuditEvent with before/after values.
- No correction event when data is unchanged.
- Session audit trail endpoint returns finalize + reopen events.
- Excused and Unverified statuses accepted.
- Status comparison is case-insensitive.
- Attendance rate excludes Excused from denominator.
- Empty attendance returns 0.0 rate.
- Report rate uses policy math.
- Snapshot preserves historical class on student transfer.
- Report filters by historical snapshot class.
- Sections have independent sessions.
- Session detail returns `session=None` gracefully for unseen dates.

### Frontend API
- Added `attendanceApi.getSession()`, `.finalizeSession()`, and `.reopenSession()` to `shared/api.js`.

## Verification

```powershell
cd codebase/backend
.\venv\Scripts\python.exe -m pytest -v
# Result: 62 passed in ~32s
```

## Next acceptance batch

- [x] Add migration/version table and a verified backup-before-migrate workflow.
- [x] Configure SQLite foreign keys/WAL/busy timeout and test integrity/restore.
- [x] Replace hard-coded authentication with persistent hashed users and secure admin bootstrap.
- [x] Protect sensitive APIs with tested RBAC/class scope.
- [x] Add attendance sessions, finalization/reopen reason, correction audit, Excused/Unverified policy, and historical enrollment context.
- [x] Photo pipeline hardening and deterministic local-engine tests (fake/oversized/no-face/multi-face fixtures).
- [ ] Configurable institution/admin model and UI.
- [ ] Reporting, portfolios, privacy/retention, accessibility and offline resilience.
- [ ] Verified Windows packaging, upgrade, restore, and uninstall flow.

## Blockers and risks

- The local virtual environment does not contain OpenCV or Pillow even though requirements declare both; real photo detection has not been verified.
- The authentication foundation is materially safer, but global/IP throttling, account lifecycle UI, browser-token hardening, and security dependency scans remain before release.
- No Windows packaging implementation or verified `.exe` exists.
- CORS policy and debug-mode defaults are not yet locked for production.
