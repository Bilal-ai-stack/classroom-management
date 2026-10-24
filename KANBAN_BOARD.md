# Classroom Management System — Kanban Board

**Project Type:** GitHub Projects (Kanban Board)  
**Methodology:** Agile Kanban with Work-In-Progress (WIP) limits  
**Board URL:** `https://github.com/Bilal-ai-stack/classroom-management/projects`

---

## Kanban Board Overview

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   📋 Backlog    │ 🎯 Ready (To Do)│ 🚧 In Progress  │ 👀 In Review/PR │     ✅ Done     │
│                 │   (WIP Max: 3)  │   (WIP Max: 2)  │   (WIP Max: 2)  │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ • Issue #4      │ • Issue #1      │                 │                 │                 │
│ • Issue #5      │ • Issue #2      │                 │                 │                 │
│ • Issue #6      │ • Issue #3      │                 │                 │                 │
│ • Issue #7      │                 │                 │                 │                 │
│ • Issue #8      │                 │                 │                 │                 │
│ • Issue #9      │                 │                 │                 │                 │
│ • Issue #10     │                 │                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## Column Definitions & Policies

### 1. 📋 Backlog (Future Work)
- **Policy:** Contains scoped issues not yet scheduled for immediate development.
- **Current Cards:**
  - `[#4]` [Epic] Attendance Data Model & Bulk REST Endpoints *(Phase 2)*
  - `[#5]` [Feature] Daily Attendance Roster UI *(Phase 2)*
  - `[#6]` [Feature] Attendance Analytics & Reports *(Phase 2)*
  - `[#7]` [Epic] Local Face Detection Service (OpenCV) *(Phase 3)*
  - `[#8]` [Feature] Teacher Photo-Verification Review Screen *(Phase 3)*
  - `[#9]` [Testing] Backend Pytest Suite & Validation Hardening *(Phase 4)*
  - `[#10]` [Documentation] Complete Setup Guide & Seed Data *(Phase 4)*

### 2. 🎯 Ready / To Do (WIP Limit: 3)
- **Policy:** Clear acceptance criteria defined, dependencies resolved, ready for immediate assignment.
- **Current Cards (Phase 1 MVP):**
  - [ ] `[#1]` **[Epic] Backend Foundation & Student CRUD API**  
    *Assignee:* Bilal Ahmad | *Branch:* `feature/phase1-student-portfolio`
  - [ ] `[#2]` **[Epic] React + Vite Frontend Scaffolding & Light UI Design System**  
    *Assignee:* Bilal Ahmad | *Branch:* `feature/phase1-student-portfolio`
  - [ ] `[#3]` **[Feature] Student Management & Portfolio View**  
    *Assignee:* Bilal Ahmad | *Branch:* `feature/phase1-student-portfolio`

### 3. 🚧 In Progress (WIP Limit: 2)
- **Policy:** Actively being coded on the designated feature branch. A developer should not work on more than 2 items simultaneously to avoid context switching.
- **Current Cards:** None (Ready to move Issue #1 & #2 upon kickoff)

### 4. 👀 In Review / PR (WIP Limit: 2)
- **Policy:** Code complete, tests passing locally, PR opened against `develop`.
- **Review Checklist:**
  - [ ] Linting & automated CI pass
  - [ ] No biometric recognition code introduced (ethical policy)
  - [ ] Tested on Windows / PowerShell

### 5. ✅ Done
- **Policy:** PR reviewed, approved, merged into `develop` (or `main`), acceptance criteria verified.
- **Current Cards:**
  - [x] Initial GitHub project configuration & governance setup (`.github/`, templates, CI, Kanban definitions)

---

## How to Set Up the Kanban Board on GitHub

1. Navigate to your repository: `https://github.com/Bilal-ai-stack/classroom-management`
2. Click the **Projects** tab at the top.
3. Click **New project** -> Select **Board** template (Kanban).
4. Name the project: `Classroom Management Kanban`.
5. Set the columns to:
   - `📋 Backlog`
   - `🎯 Ready`
   - `🚧 In Progress`
   - `👀 In Review`
   - `✅ Done`
6. Click **+ Add item** and link issues `#1` through `#10`.
