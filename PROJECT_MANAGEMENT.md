# Classroom Management System — GitHub Project Management Guide

**Target Repository:** `https://github.com/Bilal-ai-stack/classroom-management`  
**Owner:** Bilal Ahmad (`Bilal-ai-stack`)

---

## 1. Git Branching Strategy

We follow the standard GitFlow / Feature Branching methodology:

| Branch Name | Purpose | Target Merge |
|---|---|---|
| `main` | Production-ready, stable releases | Release tags (`v1.0.0`) |
| `develop` | Active integration branch for all finished features | Merged into `main` |
| `feature/phase1-student-portfolio` | Student CRUD, models, portfolio & dashboard UI | Merged into `develop` |
| `feature/phase2-daily-attendance` | Daily roster, bulk attendance, and reporting | Merged into `develop` |
| `feature/phase3-photo-assisted-attendance` | Local OpenCV face detection & teacher verification | Merged into `develop` |
| `feature/phase4-testing-and-docs` | Automated tests, seed data, and documentation | Merged into `develop` |

---

## 2. GitHub Milestones & Issues

### Milestone 1: Phase 1 — Foundation & Student Portfolio MVP (Sprint 1)
- **Issue #1: [Epic] Backend Foundation & Student CRUD API**
  - **Labels:** `backend`, `enhancement`, `phase-1`
  - **Description:** Setup Flask, SQLite, and Flask-SQLAlchemy with `Student` model and REST endpoints (`GET`, `POST`, `PUT`, `PATCH /archive`).
  - **Acceptance Criteria:**
    - [ ] `Student` model with roll_number unique constraint per class.
    - [ ] REST API endpoints for student listing, creation, editing, and archiving.
    - [ ] Validation for required fields and proper error codes (400, 404).

- **Issue #2: [Epic] React + Vite Frontend Scaffolding & Light UI Design System**
  - **Labels:** `frontend`, `ui/ux`, `phase-1`
  - **Description:** Initialize React + Vite frontend, establish CSS tokens (background `#F8FAFC`, primary `#2563EB`, text `#0F172A`), and create layout structure.
  - **Acceptance Criteria:**
    - [ ] Top navigation or sidebar with responsive layout.
    - [ ] Light theme styling with clear contrast and typography.
    - [ ] Reusable UI components (cards, badges, modal, buttons).

- **Issue #3: [Feature] Student Management & Portfolio View**
  - **Labels:** `frontend`, `feature`, `phase-1`
  - **Description:** Searchable and filterable student roster with Add/Edit modals and an individual portfolio view.
  - **Acceptance Criteria:**
    - [ ] Search students by name or roll number.
    - [ ] Add/Edit student modal with form validation.
    - [ ] Portfolio page displaying student details and attendance metrics summary.

---

### Milestone 2: Phase 2 — Daily Attendance & Reporting (Sprint 2)
- **Issue #4: [Epic] Attendance Data Model & Bulk REST Endpoints**
  - **Labels:** `backend`, `enhancement`, `phase-2`
  - **Description:** Implement `Attendance` model with composite unique constraint `(student_id, date)`. Endpoints for fetching roster and bulk saving attendance.
  - **Acceptance Criteria:**
    - [ ] Enforce unique `(student_id, date)` constraint.
    - [ ] `GET /api/attendance` returns class roster with current status for the date.
    - [ ] `POST /api/attendance/bulk` updates records without duplicating.

- **Issue #5: [Feature] Daily Attendance Roster UI**
  - **Labels:** `frontend`, `feature`, `phase-2`
  - **Description:** Teacher-friendly daily attendance page with date picker, class selector, and one-click status buttons (Present / Absent / Late).
  - **Acceptance Criteria:**
    - [ ] Date picker defaults to today.
    - [ ] Quick toggles for Present, Absent, and Late with distinct accessible badges.
    - [ ] Bulk "Save Attendance" button with instant feedback toast.

- **Issue #6: [Feature] Attendance Analytics & Reports**
  - **Labels:** `fullstack`, `analytics`, `phase-2`
  - **Description:** Attendance report views showing daily counts, monthly trends, and CSV export.
  - **Acceptance Criteria:**
    - [ ] Summary cards on Dashboard showing today's attendance rate.
    - [ ] Monthly attendance breakdown per student.
    - [ ] Export attendance records to CSV file.

---

### Milestone 3: Phase 3 — Photo-Assisted Verification (Sprint 3)
- **Issue #7: [Epic] Local Face Detection Service (OpenCV)**
  - **Labels:** `backend`, `ai/ml`, `privacy`, `phase-3`
  - **Description:** Local Haar Cascade face detection pipeline that generates temporary face thumbnails without biometric identification.
  - **Acceptance Criteria:**
    - [ ] Extract face bounding boxes from uploaded group photos.
    - [ ] Save temporary cropped thumbnails for teacher review.
    - [ ] Never store face embeddings or biometric profiles.

- **Issue #8: [Feature] Teacher Photo-Verification Review Screen**
  - **Labels:** `frontend`, `feature`, `privacy`, `phase-3`
  - **Description:** Review interface pairing detected face crops with a student roster dropdown, letting the teacher confirm matches before saving.
  - **Acceptance Criteria:**
    - [ ] Prominent UI banner: "Experimental Photo-Assisted Review (Non-Biometric)".
    - [ ] Displays detected face crops with student assignment dropdowns.
    - [ ] Unmatched students are clearly displayed for manual review.
    - [ ] Clean-up / purge button to delete temporary session photos.

---

### Milestone 4: Phase 4 — Quality Assurance & Deployment Prep (Sprint 4)
- **Issue #9: [Testing] Backend Pytest Suite & Validation Hardening**
  - **Labels:** `testing`, `backend`, `phase-4`
  - **Description:** Unit and integration tests covering student CRUD, duplicate attendance prevention, and error responses.
  - **Acceptance Criteria:**
    - [ ] `pytest` tests for `/api/students` and `/api/attendance`.
    - [ ] Validation against invalid dates and malformed payloads.

- **Issue #10: [Documentation] Complete Setup Guide & Seed Data**
  - **Labels:** `documentation`, `phase-4`
  - **Description:** Write comprehensive README with Windows PowerShell commands, setup steps, and provide fictional student seed data.
  - **Acceptance Criteria:**
    - [ ] `seed.py` creates 10+ demo students with sample attendance records.
    - [ ] `README.md` includes clear steps to run both backend and frontend on Windows.
