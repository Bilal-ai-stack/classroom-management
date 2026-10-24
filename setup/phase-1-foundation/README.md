# Phase 1: Foundation & Student Portfolio MVP

## Scope
1. Scaffold Python Flask backend and React + Vite frontend.
2. Establish SQLite database with SQLAlchemy `Student` model.
3. Build REST endpoints for Student CRUD (`GET`, `POST`, `PUT`, `PATCH /archive`).
4. Build responsive, accessible light-theme frontend:
   - Navigation & Dashboard overview
   - Searchable Student Directory with Add/Edit modals
   - Detailed Student Portfolio view with attendance metrics summary
5. Seed initial fictional student records for testing.

## Backend Endpoints (Phase 1)
- `GET /api/students` — List active students (supports search query `?q=...` & `class_name=...`)
- `POST /api/students` — Create new student
- `GET /api/students/<id>` — View single student portfolio details
- `PUT /api/students/<id>` — Update student profile
- `PATCH /api/students/<id>/archive` — Soft archive a student
