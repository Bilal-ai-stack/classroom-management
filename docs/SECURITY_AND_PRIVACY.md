# Security & Privacy Architecture — ClassroomOS 2.0

**Classification:** Official Product Documentation  
**Product:** ClassroomOS 2.0 (Windows Desktop Release)  
**Applicability:** Version 2.0.0+  
**Standard Compliance:** Local-First FERPA Compliance, GDPR-K Privacy Guardrails, Zero-Biometric Identification Policy

---

## 1. Executive Summary

ClassroomOS 2.0 is designed from the ground up as a **zero-cloud, local-first, privacy-by-design desktop operating system** for K-12 and higher-education classroom management. Educational data—especially student rosters, attendance ledgers, identity photographs, and audit logs—demands the highest standards of data confidentiality, forensic integrity, and physical custody.

Unlike conventional cloud-hosted classroom management tools that transmit sensitive minor data to multi-tenant servers, ClassroomOS executes entirely within the school or educator's trusted local environment.

---

## 2. Threat Model & Attack Surface Analysis

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WINDOWS WORKSTATION BOUNDARY                         │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │                     Chrome / Edge / WebView2                 │     │
│   │                 (http://127.0.0.1:[5000-5050])              │     │
│   └──────────────────────────────▲───────────────────────────────┘     │
│                                  │ Loopback HTTP (Bearer Auth)         │
│   ┌──────────────────────────────▼───────────────────────────────┐     │
│   │               Flask WSGI Application Supervisor              │     │
│   │         • Bind Address: 127.0.0.1 (Strict Loopback Only)      │     │
│   │         • Port Supervisor: Dynamic collision search (5000-5050)│    │
│   │         • Session Token Verifier (SHA-256 Digest Matching)   │     │
│   │         • RBAC Middleware (@require_roles, Class Scope Gate) │     │
│   └──────────────┬───────────────────────────────┬───────────────┘     │
│                  │                               │                     │
│                  ▼                               ▼                     │
│   ┌──────────────────────────────┐ ┌──────────────────────────────┐    │
│   │    SQLite Database (WAL)     │ │   Local File System Storage  │    │
│   │  %LOCALAPPDATA%\ClassroomOS\ │ │  %LOCALAPPDATA%\ClassroomOS\ │    │
│   │  data\classroom.db           │ │  data\branding\ & uploads\   │    │
│   │  • PRAGMA foreign_keys = ON  │ │  • Isolated User AppData     │    │
│   │  • PRAGMA busy_timeout = 5000│ │  • Non-executable directory  │    │
│   └──────────────────────────────┘ └──────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                           [BLOCKED BOUNDARY]
                                   ✕
               No Remote Inbound Network Sockets (0.0.0.0)
               No Outbound Cloud Biometric Telemetry / APIs
```

### 2.1 Threat Vectors & Mitigations

| Threat Vector | Severity | Attack Scenario | ClassroomOS Defense Mechanism |
|---|---|---|---|
| **Remote Network Exposure** | Critical | External attacker on the LAN attempts to access student data or API endpoints. | **Loopback Only (`127.0.0.1`)**: Backend binds exclusively to IPv4 loopback. No sockets open on `0.0.0.0` or external network adapters. |
| **Credential Harvesting / Brute-Force** | High | Unauthorized user attempts automated password guessing against `/api/auth/login`. | **Adaptive Lockout**: 5 consecutive failed login attempts trigger an immediate, persistent 15-minute account lock. |
| **Biometric Surveillance / Facial Scraping** | Critical | Facial images extracted or used for mass facial recognition / profiling. | **Zero-Biometric Policy**: Local Haar Cascade face *detection* only. No face *recognition*, embeddings, or biometric templates. |
| **Decompression Bomb (DoS)** | High | Attacker uploads malicious high-resolution image to exhaust server memory. | **Pillow Bounds**: Strict 25-megapixel limit (`Image.MAX_IMAGE_PIXELS = 25_000_000`) and dimension limit (≤ 2048×2048 px). |
| **SVG XSS & XXE Injection** | High | Uploaded SVG logo contains malicious `<script>` tags, event handlers, or external entity definitions. | **Strict XML Sanitizer**: Parses via `xml.etree.ElementTree`, bans `<!DOCTYPE`, `<!ENTITY`, script tags, event attributes, and foreign objects. |
| **Data Bleed across Classrooms** | Medium | Teacher attempts to inspect or tamper with another instructor's attendance roster. | **RBAC & Class Scoping**: Queries for teachers are restricted to `User.assigned_class` and `User.assigned_section`. |
| **Database Corruption / Loss** | High | Power failure or unexpected OS shutdown during bulk attendance save. | **SQLite WAL Mode & Auto-Backup**: `PRAGMA synchronous = NORMAL`, `journal_mode = WAL`, and automated migration backups. |

---

## 3. Cryptography & Authentication Architecture

### 3.1 Secret Key Management
- When launched in Desktop mode, ClassroomOS automatically generates a cryptographically secure 384-bit secret key (`secrets.token_hex(48)`).
- The secret key is persisted in `%LOCALAPPDATA%\ClassroomOS\secret.key` with standard Windows ACLs (readable only by the local user profile).
- If the file is missing or corrupted, a new key is provisioned with high-entropy system entropy (`os.urandom`).

### 3.2 Password Hashing
- User passwords must meet minimum complexity requirements (≥ 12 characters, containing both letters and numbers).
- Passwords are encrypted using **scrypt** (or hardened `pbkdf2:sha256` with 600,000 rounds) through Werkzeug's security framework.
- Plaintext passwords are never written to disk, stored in memory beyond the request lifecycle, or recorded in audit trails.

### 3.3 Session Tokens & Verification
- Authentication sessions use opaque high-entropy tokens:
  ```python
  raw_token = secrets.token_urlsafe(32)
  token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
  ```
- **Only the SHA-256 hash** of the token is saved in the SQLite `user_sessions` table. A database compromise does not yield valid session tokens.
- **Session Duration:** Tokens expire after 12 hours.
- **Revocation:** All sessions are instantly invalidated upon explicit logout or administrator password reset.

---

## 4. Role-Based Access Control (RBAC) Matrix

ClassroomOS implements a strict dual-tier authorization matrix:

| Endpoint / Capability | Admin Role | Teacher Role | Unauthenticated |
|---|:---:|:---:|:---:|
| Initial Bootstrap (`POST /api/auth/bootstrap`) | ✕ (Only when 0 users) | ✕ | ✓ (Only when 0 users) |
| User Login (`POST /api/auth/login`) | ✓ | ✓ | ✓ |
| Public Profile (`GET /api/institution/profile`) | ✓ | ✓ | ✓ |
| School Logo (`GET /api/institution/logo`) | ✓ | ✓ | ✓ |
| Institution Settings (`PUT /api/admin/institution`) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Upload/Remove Logo (`POST/DELETE /api/admin/institution/logo`) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Staff Management (`POST/PUT/DELETE /api/auth/users/*`) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Audit Trail Inspection (`GET /api/admin/audit-logs`) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Database Backup & Restore (`POST /api/admin/backup/*`) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Data Retention Purge (`POST /api/admin/privacy/purge`) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Student CRUD (Add/Edit/Archive) | ✓ | ✕ (403 Forbidden) | ✕ (401 Unauthorized) |
| Student Roster View (`GET /api/students`) | All Classes | Assigned Class Only | ✕ (401 Unauthorized) |
| Record Daily Attendance (`POST /attendance/bulk`) | All Classes | Assigned Class Only | ✕ (401 Unauthorized) |
| Finalize/Reopen Session (`POST /attendance/session/*`) | All Classes | Assigned Class Only | ✕ (401 Unauthorized) |
| Photo Face Detection (`POST /api/detect_faces`) | All Classes | Assigned Class Only | ✕ (401 Unauthorized) |
| Reports & CSV Export (`GET /attendance/report`) | All Classes | Assigned Class Only | ✕ (401 Unauthorized) |

---

## 5. Ethical AI & Student Biometric Privacy

### 5.1 The Zero-Biometric Guarantee
ClassroomOS adheres strictly to ethical computing standards for minors in education:
1. **Detection Only, Never Recognition:** The system utilizes OpenCV Haar Cascade classifiers (`haarcascade_frontalface_default.xml`) solely to verify the physical presence and count of faces in classroom group photos.
2. **No Facial Feature Embeddings:** The system does not compute, generate, or store facial landmark vectors, embeddings, or biometric signatures.
3. **No Automated Marking Without Human Review:** Photo detection outputs candidate bounding boxes to the educator's UI. Attendance is never finalized without explicit teacher confirmation.
4. **No Third-Party Telemetry:** Photo processing is 100% offline and executes on the local CPU. No external AI APIs, cloud services, or remote neural networks are invoked.

### 5.2 FERPA & GDPR-K Compliance
- **Local Custody:** All student educational records remain within the school's local physical possession.
- **Right to Erasure (Purge Engine):** Administrators can execute automated retention purges (`POST /api/admin/privacy/purge`), permanently removing inactive student records, attendance histories, and photo assets older than the institution's retention threshold.
- **Forensic Audit Logging:** Every data alteration, attendance correction, session reopen, and authentication event generates an immutable `AuditEvent` with actor, timestamp, and delta.

---

## 6. Institution Branding & SVG Security Sanitization

To allow schools to customize their software without introducing Remote Code Execution (RCE) or Cross-Site Scripting (XSS), the Institution Profile logo upload engine implements rigorous validation:

1. **Strict Content-Type Whitelist:** Allowed formats are restricted to `image/png`, `image/jpeg`, and `image/svg+xml`.
2. **Payload Size Limits:** Hard maximum upload ceiling of **2 MB** (2,097,152 bytes).
3. **Raster Image Safety:**
   - Evaluated using Pillow (`PIL.Image`).
   - Format integrity verified (`image.verify()`).
   - Dimension ceiling enforced: Maximum width and height of **2048 px**.
   - Decompression bomb guard: `Image.MAX_IMAGE_PIXELS = 25_000_000`.
4. **Vector SVG Sanitization:**
   - Parsed with `xml.etree.ElementTree` without entity resolution.
   - Immediate rejection if payload contains `<!DOCTYPE` or `<!ENTITY` (XXE defense).
   - Rejection of active elements: `<script>`, `<foreignObject>`, `<iframe`, `<embed>`, `<object>`.
   - Rejection of inline event handlers: `onload`, `onerror`, `onclick`, `onmouseover`, etc.
   - Rejection of suspicious URI protocols: attributes containing `javascript:`, `data:text/html`, or external URLs.

---

## 7. Operational Security Best Practices for Administrators

1. **Windows User Isolation:** Run ClassroomOS under a standard user account rather than an unrestricted Local Administrator account.
2. **Backups to Air-Gapped Media:** Periodically export database backups (`%LOCALAPPDATA%\ClassroomOS\backups`) to an external encrypted USB drive or secured network share.
3. **Workstation Screen Lock:** Configure Windows to automatically lock after 5 minutes of inactivity to protect teacher sessions in shared classrooms.
4. **Operating System Patches:** Maintain the host Windows machine with current Windows Defender / security definitions.
