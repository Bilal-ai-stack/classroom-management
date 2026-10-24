# Phase 2: Daily Attendance & Reporting

## Scope
1. Define `Attendance` database model with unique constraint `(student_id, date)`.
2. Build daily attendance endpoints:
   - `GET /api/attendance?date=YYYY-MM-DD&class_name=...`
   - `POST /api/attendance/bulk`
   - `GET /api/students/<id>/attendance`
   - `GET /api/reports/attendance`
3. Build Daily Attendance Roster UI (date selector, quick Present/Absent/Late toggles, bulk save).
4. Build Reports UI with monthly statistics and CSV export.
