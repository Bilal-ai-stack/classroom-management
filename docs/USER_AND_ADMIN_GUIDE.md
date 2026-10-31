# ClassroomOS 2.0.0 — User & Administrator Manual

## 1. System Overview

ClassroomOS 2.0.0 is an enterprise-grade, offline-first classroom management system built specifically for Windows desktop and mobile web environments. It features complete student portfolio management, single-hand attendance marking, local OpenCV face detection, custom institutional branding, and FERPA-compliant privacy controls.

---

## 2. Administrator Guide

### 2.1 Institution Profile & School Logo
Navigate to **Admin Settings → Institution Profile**:
- **School Parameters:** Configure Institution Name, Institution Code (e.g. `SCH-001`), Academic Year (`2026-2027`), Current Academic Term, Contact Email, and Timezone.
- **Attendance Warning Threshold:** Set minimum required attendance percentage (defaults to 75.0%).
- **School Logo & Crest:**
  - **Upload Logo:** Click **Upload School Logo** and choose a PNG, JPG, or SVG file (up to 2MB).
  - **Raster Images:** Automatically validated with Pillow for dimensions up to 2048x2048 px with decompression bomb protection.
  - **SVG Files:** Automatically sanitized to eliminate scripts, external URLs, and XML entity injections.
  - **Default Crest:** If no custom logo is uploaded, ClassroomOS renders an elegant default academic crest.
  - **Restore Default:** Click **Restore Default Crest** to revert to the default crest at any time.
  - **Global Visibility:** The active school logo appears across the top navigation bar, login modal, dashboard welcome banner, student portfolios, and printable attendance reports.

### 2.2 Academic Classes & Sections
Navigate to **Admin Settings → Classes & Sections**:
- **Create Class:** Add Grade levels (e.g. `Grade 4`, `Grade 6`) and section identifiers (`A`, `B`, `C`).
- **Room Numbers & Capacity:** Set classroom locations and enrollment limits.
- **Assign Teacher:** Link staff accounts to specific classes.

### 2.3 Staff Account Provisioning & Security
Navigate to **Admin Settings → Staff Accounts**:
- **Create Users:** Provision `Admin` or `Teacher` accounts with mandatory minimum 12-character strong passwords.
- **Class Scoping:** Assign teachers to designated classes. Teachers have read/mark access only for their assigned grade.
- **Status Toggle:** Instantly activate or deactivate teacher accounts. Deactivated accounts cannot sign in.
- **Password Reset:** Administrators can issue password resets for staff members.

### 2.4 Security & Audit Trail
Navigate to **Admin Settings → Security & Audit Logs**:
- Every critical action is immutably logged with actor user ID, target entity, timestamp, and metadata diff.
- Logged operations include: user authentication, account creation, status toggles, password resets, institution settings changes, logo uploads, logo removals, term creation, and data purges.

---

## 3. Educator / Teacher Guide

### 3.1 Daily Roll Call Attendance
Navigate to the **Attendance** tab:
1. Select the current date and class section.
2. The enrolled student roster appears in alphabetical or roll-number order.
3. **One-Handed Mobile Marking:**
   - Tap **Present** (Green), **Late** (Amber), or **Absent** (Red).
   - Touch targets are optimized with a minimum 44px height for single-hand thumb tapping.
4. **Remarks:** Add optional notes (e.g., "Doctor note provided", "Excused absence").
5. Click **Save Attendance** to persist the session.
6. **Session Finalization:** Lock completed sessions to prevent accidental modifications.

### 3.2 Photo-Assisted Attendance Verification
Navigate to the **Photo Review** tab:
1. Tap **Take Photo / Select Image**:
   - On mobile devices, directly launches the device camera.
   - On desktop, opens the image file picker.
2. The local OpenCV Haar Cascade pipeline detects faces in real time.
3. Candidate student assignments are displayed for teacher review.
4. **Human-in-the-Loop:** Teachers confirm or adjust each student match before committing.
5. Click **Confirm & Commit Attendance** to update the daily attendance log.

### 3.3 Student Portfolios
Navigate to the **Students** tab:
- Search students by name or roll number.
- Filter by grade/class.
- Tap any student card or row to open their comprehensive portfolio:
  - Total attendance rate and status metrics.
  - Complete chronological attendance log.
  - Guardian contact information.
  - Medical/special notes.
  - Official school branding badge.

### 3.4 Longitudinal Reports & Printing
Navigate to the **Reports** tab:
- Select date range (e.g., last 30 days, term-to-date) and class filter.
- View aggregate attendance rates, daily trend tables, and absent student lists.
- **Print / Save as PDF:** Click **Print / Save PDF** to generate an official institutional ledger featuring the school logo, institution name, and formatted tabular records.
- **RFC 4180 CSV Export:** Click **Export CSV Report** for an RFC 4180 compliant spreadsheet export.

### 3.5 Privacy & Ethics Controls
Click the **Privacy** badge in the navigation bar:
- View FERPA compliance status and ethical guardrails.
- Inspect the local storage footprint of temporary photo analysis crops.
- Click **Purge Temporary Photo Data** to immediately wipe all ephemeral face crops.
