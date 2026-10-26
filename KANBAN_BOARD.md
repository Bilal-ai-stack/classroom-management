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
│                 │                 │                 │                 │ • Issue #2      │
│                 │                 │                 │                 │ • Issue #3      │
│                 │                 │                 │                 │ • Issue #4      │
│                 │                 │                 │                 │ • Issue #5      │
│                 │                 │                 │                 │ • Issue #6      │
│                 │                 │                 │                 │ • Issue #7      │
│                 │                 │                 │                 │ • Issue #8      │
│                 │                 │                 │                 │ • Issue #9      │
│                 │                 │                 │                 │ • Issue #10     │
│                 │                 │                 │                 │ • Issue #11     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## Column Definitions & Policies

### 1. 📋 Backlog (Future Work)
- **Policy:** Contains scoped issues not yet scheduled for immediate development.
- **Current Cards:** All primary roadmap epics have been completed!

### 2. 🎯 Ready / To Do (WIP Limit: 3)
- **Policy:** Clear acceptance criteria defined, dependencies resolved, ready for immediate assignment.
- **Current Cards:** None

### 3. 🚧 In Progress (WIP Limit: 2)
- **Policy:** Actively being coded on the designated feature branch.
- **Current Cards:** None

### 4. 👀 In Review / PR (WIP Limit: 2)
- **Policy:** Code complete, tests passing locally, PR opened against `develop`.
- **Review Checklist:**
  - [x] Linting & automated CI pass
  - [x] No biometric recognition code introduced (ethical policy)
  - [x] Tested on Windows / PowerShell
  - [x] Docker containerization & Docker Hub workflow configured

### 5. ✅ Done
- **Policy:** PR reviewed, approved, merged into `develop` and `main`, acceptance criteria verified.
- **Current Cards on GitHub:**
  - [x] `[#2]` [Epic] Backend Foundation & Student CRUD API *(Phase 1 / Milestone 1)*
  - [x] `[#3]` [Epic] React + Vite Frontend Scaffolding & Light UI Design System *(Phase 1 / Milestone 1)*
  - [x] `[#4]` [Feature] Student Management & Portfolio View *(Phase 1 / Milestone 1)*
  - [x] `[#5]` [Epic] Attendance Data Model & Bulk REST Endpoints *(Phase 2 / Milestone 2)*
  - [x] `[#6]` [Feature] Daily Attendance Roster UI *(Phase 2 / Milestone 2)*
  - [x] `[#7]` [Feature] Attendance Analytics & Reports *(Phase 2 / Milestone 2)*
  - [x] `[#8]` [Epic] Local Face Detection Service (OpenCV) *(Phase 3 / Milestone 3)*
  - [x] `[#9]` [Feature] Teacher Photo-Verification Review Screen *(Phase 3 / Milestone 3)*
  - [x] `[#10]` [Testing] Backend Pytest Suite & Validation Hardening *(Phase 4 / Milestone 4)*
  - [x] `[#11]` [Documentation & Infra] Complete Setup Guide, Docker Compose & Docker Hub CI/CD *(Phase 4 / Milestone 4)*

---

## Customizing the GitHub Kanban Board

### Step 1: Open Your Board
1. Go to your repository: [Bilal-ai-stack/classroom-management](https://github.com/Bilal-ai-stack/classroom-management)
2. Click the **Projects** tab at the top (or open your existing Project board).

### Step 2: Configure Kanban Columns (Status Field)
1. In your project board, click the dropdown next to the view name (e.g. **Board**) or click the column header options.
2. Under the **Status** field settings (click the small down arrow next to Status column headers or click **Settings**):
   - Rename / arrange columns as:
     - `📋 Backlog`
     - `🎯 Ready`
     - `🚧 In Progress`
     - `👀 In Review`
     - `✅ Done`

### Step 3: Populate the Board with the Developed Issues
1. Click **+ Add item** at the bottom of the `✅ Done` column (or press `Ctrl+Space` / click **+ Add item**).
2. Type `#` and select repository `Bilal-ai-stack/classroom-management`.
3. Select all closed issues (`#2` through `#11`) or click each one to add them to `✅ Done`.
4. All 10 issues will appear as cards with their respective Milestones and color-coded Phase labels!
