# ClassroomOS 2.1.0 — User & Administrator Manual

## 1. System Overview

ClassroomOS 2.1.0 is an enterprise-grade, offline-first classroom management system built specifically for Windows desktop and mobile web environments. It features complete student portfolio management, single-hand attendance marking, local OpenCV face detection, custom institutional branding, Guardian WhatsApp communication, automated SQLite backups, and FERPA-compliant privacy controls.

---

## 2. Administrator Guide

### 2.1 Institution Profile & School Logo
Navigate to **Admin Settings → Institution Profile**:
- **School Profile:** Edit Institution Name, School Code, Address, Contact Phone, Official Email, Description, Academic Year, and Warning Attendance Threshold (%).
- **Branding & Logo:**
  - **Upload Logo:** Click **Upload School Logo** and choose a PNG, JPG, or sanitized SVG file (up to 2MB).
  - **Raster Images:** Automatically validated with Pillow for dimensions up to 2048x2048 px with decompression bomb protection.
  - **SVG Files:** Automatically sanitized to eliminate scripts, external URLs, and XML entity injections.
  - **Default Crest:** If no custom logo is uploaded, ClassroomOS renders an embedded vector academic crest.
  - **Global Visibility:** Custom branding appears across the top navigation bar, login modal, dashboard welcome banner, student portfolios, and printable attendance reports.

### 2.2 Academic Classes & Sections
Navigate to **Admin Settings → Classes & Sections**:
- **Create Class:** Add Grade levels (e.g. `Grade 4`, `Grade 6`) and section identifiers (`A`, `B`, `C`).
- **Rename & Restructure:** Edit class names and section letters with one click.
  - *Automated Synchronization:* Renaming a class automatically and transactionally updates all enrolled student records, attendance histories, and session snapshot records.
- **Room Numbers & Capacity:** Set classroom locations and enrollment limits.
- **Assign Teacher:** Link staff accounts to specific classes.

### 2.3 Academic Terms Management
Navigate to **Admin Settings → Academic Terms**:
- **Create Terms:** Define semesters or terms (e.g., `Fall 2026`, `Spring 2027`) with start and end dates.
- **Edit & Adjust:** Modify term names, boundaries, and active status.
- **Delete Terms:** Remove obsolete terms safely with integrity protection.

### 2.4 Staff Account Provisioning & Security
Navigate to **Admin Settings → Staff Accounts**:
- **Create Users:** Provision `Admin` or `Teacher` accounts with mandatory minimum 12-character strong passwords.
- **Edit Staff Profiles:** Update full name, email, role, and assigned class/section.
- **Class Scoping:** Assign teachers to designated classes. Teachers have read/mark access only for their assigned grade.
- **Status Toggle:** Instantly activate or deactivate teacher accounts. Deactivated accounts cannot sign in.
- **Password Reset:** Administrators can issue password resets for staff members.

### 2.5 Guardian WhatsApp Notifications Configuration
Navigate to **Admin Settings → WhatsApp Notifications**:
- **Integration Mode:** Disabled by default. Can be enabled by administrators for institutions using the WhatsApp Business Cloud API.
- **API Credentials:** Securely configure Phone Number ID and Cloud API Access Token.
- **Message Templates:** Define template strings with parameter interpolation (`{student_name}`, `{date}`, `{school_name}`).
- **Interactive Sandbox:** Send simulated test messages to verify template interpolation without sending external network requests.
- **Notification Audit Log:** Review dispatch history, delivery status, and timestamps.

### 2.6 Database Storage & Backups
Navigate to **Admin Settings → Storage & Backups**:
- **Live Storage Metrics:** View active database file path, database size in MB, total backup storage volume, and available local disk free space via `shutil.disk_usage`.
- **Create Backup:** Click **Create Verified Backup** to trigger an online SQLite backup (`con.backup()`) with an accompanying SHA-256 cryptographic manifest.
- **Restore Snapshot:** Restore any previous backup snapshot with point-in-time accuracy.
  - *Pre-Restore Safety Snapshot:* ClassroomOS automatically creates a pre-restore backup of the live database before restoring, preventing accidental data loss.
- **Delete Backups:** Purge outdated backups with audit confirmation.

### 2.7 Security & Audit Trail
Navigate to **Admin Settings → Security & Audit Logs**:
- Every critical action is immutably logged with actor user ID, target entity, timestamp, and metadata diff.
- Logged operations include: user authentication, account creation, status toggles, password resets, institution settings changes, logo uploads, term creation, class renames, WhatsApp dispatches, and backup restorations.

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

### 3.2 Guardian WhatsApp Quick Notice
From the **Daily Attendance** roster or **Students** directory:
1. Click the **Send WhatsApp** button next to any student.
2. The preview modal opens, displaying the registered guardian name, relationship, and validated international phone number.
3. Select an attendance template: `Absent Today`, `Late Arrival`, or `General Notice`.
4. Review the auto-interpolated message text and make any custom adjustments.
5. Click **Send via WhatsApp** to launch WhatsApp Web or the WhatsApp Desktop app via secure `wa.me` deep links.
6. Click **Confirm Sent** to record the notification timestamp in the student's audit log.

### 3.3 Photo-Assisted Attendance Verification
Navigate to the **Photo Review** tab:
1. Tap **Take Photo / Select Image**:
   - On mobile devices, directly launches the device camera.
   - On desktop, opens the image file picker.
2. The local OpenCV Haar Cascade pipeline detects faces in real time.
3. Candidate student assignments are displayed for teacher review.
4. **Human-in-the-Loop:** Teachers confirm or adjust each student match before committing.
5. Click **Confirm & Commit Attendance** to update the daily attendance log.

### 3.4 Student Portfolios
Navigate to the **Students** tab:
- Search students by name or roll number.
- Filter by grade/class.
- View and edit guardian details, emergency contacts, and WhatsApp messaging consent.
- Tap any student card or row to open their comprehensive portfolio, attendance history, and risk indicators.
