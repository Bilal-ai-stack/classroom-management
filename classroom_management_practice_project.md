# Classroom Management System — Full-Stack AI Practice Project

> **Copy-and-paste development prompt**  
> **Difficulty:** Beginner to intermediate | **Theme:** Light, clean, responsive | **Scope:** Small working MVP

## Project prompt

Act as a senior full-stack engineer and an approachable coding tutor. Build a **small, functional Classroom Management System** for a primary-school teacher. Use **Flask (Python)** for the REST API backend, **React + Vite (Node.js tooling)** for the frontend, and **SQLite with SQLAlchemy** for local persistence. Use a **light theme** throughout. Explain each major step and the purpose of its files so a learner can understand and run the system on a Windows laptop using VS Code.

### 1. Main goals

Build a teacher-friendly web application that supports:

1. **Student registration and portfolio:** Add, view, edit, search, and archive students. Each student's profile contains a unique roll number, full name, class/section, optional guardian contact, enrollment date, optional profile photo, and notes. Show an individual portfolio with attendance history, attendance percentage, and teacher notes.
2. **Daily attendance:** Select a class and date; mark each student **Present**, **Absent**, or **Late**. Save and edit attendance, prevent duplicate records for the same student/date, and show daily totals and a simple monthly attendance report.
3. **Photo-assisted attendance (experimental):** Provide two optional input modes: (a) a camera/photo capture of an individual student, or (b) a single group photo of the classroom. The group-photo flow should detect/count visible faces and let the teacher review them individually. **Do not automatically identify students by their faces or assign attendance from biometric matching.** Instead, show the detected face crops in a temporary review screen where the teacher selects a student from a class roster and confirms any attendance change. Clearly mark uncertain, hidden, absent-from-image, or duplicate faces for manual review. A student not visible in the image must **never** be marked absent automatically.
4. **Dashboard:** Show total students, today's present/absent/late counts, attendance rate, and recently updated student profiles.

### 2. Recommended stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite, JavaScript | Simple component-based UI; Node.js used for npm and the development server |
| Styling | Plain CSS or Tailwind CSS | Light theme, responsive design |
| Backend | Flask, Flask-CORS, Flask-SQLAlchemy | Straightforward Python REST API |
| Database | SQLite | Zero-cost local practice database |
| Image handling | OpenCV for face **detection only**, not recognition | Count/crop visible faces for teacher verification |
| API tests | pytest + Flask test client | Practice backend testing |

**Important:** Node.js is the frontend development runtime/tooling; **React** builds the browser UI. Flask serves the backend APIs.

### 3. Frontend pages

- **Dashboard:** Summary cards, class selector, today's attendance overview.
- **Students:** Searchable student list with Add/Edit/Archive actions.
- **Student Portfolio:** Profile details, attendance history, percentage, teacher notes, optional profile photo.
- **Daily Attendance:** Date selector, roster table, Present/Absent/Late toggles, Save and Edit buttons.
- **Photo-Assisted Review:** Upload a group-class photo or capture one from a camera with permission. Display detected face crops, a student selection dropdown, confirmed/unconfirmed status, and a final teacher-reviewed attendance preview before saving.
- **Reports:** Daily and monthly attendance counts, simple filters, optional CSV export.

### 4. Light UI design

- Background `#F8FAFC`, cards `#FFFFFF`, primary blue `#2563EB`, text `#0F172A`.
- Use a top navigation or simple sidebar, rounded cards, spacious tables, readable fonts, and accessible labels.
- Use clear status colors with text labels (not color alone).
- Support laptop and mobile widths; show helpful empty states and validation messages.

### 5. Data models

Create these initial tables (add essential IDs, timestamps, and constraints):

- **Student:** `id`, `roll_number` (unique within class), `full_name`, `class_name`, `section`, `guardian_contact` (optional), `enrollment_date`, `photo_path` (optional), `notes`, `is_active`.
- **Attendance:** `id`, `student_id` (foreign key), `date`, `status` (`present|absent|late`), `method` (`manual|photo_review`), `verified_by_teacher`, `created_at`, `updated_at`; enforce **unique (`student_id`, `date`)**.
- **PhotoReviewSession:** `id`, `class_name`, `date`, `temporary_image_path`, `face_count`, `review_status`, `created_at`; use short retention for images and delete them after review or expiry.

### 6. Flask REST API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET, POST | `/api/students` | List or create student |
| GET, PUT | `/api/students/<id>` | View or edit portfolio |
| PATCH | `/api/students/<id>/archive` | Archive student |
| GET | `/api/attendance?date=YYYY-MM-DD&class_name=...` | Fetch daily roster and attendance |
| POST | `/api/attendance/bulk` | Save/update teacher-approved attendance |
| GET | `/api/students/<id>/attendance` | Student attendance history |
| GET | `/api/reports/attendance` | Daily/monthly summaries |
| POST | `/api/photo-review/detect` | Upload authorized class photo and return **temporary detected face crops**, not identities |
| POST | `/api/photo-review/confirm` | Save teacher-verified roster-to-crop assignments and attendance |
| DELETE | `/api/photo-review/<id>` | Remove temporary photo and associated crops |

Return JSON, validate all inputs, use meaningful HTTP status codes, and handle missing students, invalid dates, duplicate submissions, and upload errors. Restrict image format and file size. Add basic teacher login before use with real student data.

### 7. Photo attendance requirements and safeguards

- This is **photo-assisted manual verification**, not automatic facial identification. **No face embeddings, face-recognition databases, face-to-name predictions, or background biometric surveillance.**
- Obtain appropriate school/guardian authorization before taking or uploading children's photos; provide a manual-only alternative for every student.
- Process images locally where practical; do not upload them to third-party AI services by default.
- Display detected face crops only for a brief review; avoid storing group photos or crops permanently. Allow immediate deletion.
- Detection may miss students, duplicate a face, or include visitors. Teacher confirmation is required before saving any attendance record.
- Avoid recording a student's absence merely because they were not detected in a photo. The teacher must finalize all missing/unreviewed students manually.
- Include a clear experimental-feature warning in the UI and do not present detection counts as proof of who attended.

### 8. Suggested folder structure

```text
classroom-management/
├── backend/
│   ├── app.py
│   ├── models.py
│   ├── routes/
│   │   ├── students.py
│   │   ├── attendance.py
│   │   └── photo_review.py
│   ├── services/
│   │   └── face_detection.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/api.js
│   │   ├── App.jsx
│   │   └── index.css
│   ├── package.json
│   └── index.html
├── .gitignore
└── README.md
```

### 9. Build order (incremental learning)

**Phase 1 — Basic MVP:** Scaffold React + Flask; configure CORS; create SQLite models; add student CRUD; build the light-themed dashboard and student portfolio.

**Phase 2 — Manual attendance:** Build date/class roster, mark Present/Absent/Late, implement bulk save, prevent duplicates, and display attendance history and monthly totals.

**Phase 3 — Photo-assisted workflow:** Add image upload/camera capture, run local face detection, display temporary face crops for teacher matching, and save attendance only after confirmation. Handle missed/duplicate faces.

**Phase 4 — Quality and documentation:** Add input validation, error handling, basic authentication, privacy controls, backend tests, sample/demo data, setup guide, and screenshots.

### 10. Acceptance criteria

- App runs locally with a Flask server and a React development server.
- Teacher can add at least 10 demo students and view each student's portfolio.
- Teacher can take attendance for different dates and edit entries without duplication.
- Dashboard and reports reflect saved records accurately.
- Photo review detects potential faces but **never** assigns student identities automatically.
- Teacher can manually match detected crops to students and approve attendance before saving.
- Manual attendance works when the camera is unavailable or the photo is poor.
- Temporary uploaded images can be removed and are not retained indefinitely.
- README explains installation, commands, API routes, configuration, and privacy limitations.

### 11. Developer instructions for the AI coding assistant

1. Start by showing the architecture and folder structure, then implement one phase at a time.
2. Generate complete, runnable files (not pseudocode), with clear file paths and commands for **Windows PowerShell / VS Code**.
3. After each phase, explain how to run, test, and troubleshoot it before proceeding.
4. Use free, open-source dependencies and keep the app lightweight for an 8 GB RAM laptop.
5. Prioritize readable code and small components; avoid Docker, cloud hosting, microservices, and complex infrastructure for this practice MVP.
6. Add seed data with fictional student names; do not use real children's photos or personal data for demonstrations.
7. Treat real-world deployment, authentication strength, parental consent, secure storage, and school policy review as separate requirements before using actual student records.

**Begin with Phase 1 now.**
