import sys
import os
from datetime import date, timedelta

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance

DEMO_STUDENTS = [
    {
        "roll_number": "R-101",
        "full_name": "Aarav Patel",
        "class_name": "Grade 4",
        "section": "A",
        "guardian_contact": "+1 (555) 234-5678",
        "enrollment_date": "2026-01-15",
        "notes": "Loves mathematics and science puzzles. Very polite.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Aarav"
    },
    {
        "roll_number": "R-102",
        "full_name": "Sophia Chen",
        "class_name": "Grade 4",
        "section": "A",
        "guardian_contact": "+1 (555) 345-6789",
        "enrollment_date": "2026-01-15",
        "notes": "Avid reader, active in class debates.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Sophia"
    },
    {
        "roll_number": "R-103",
        "full_name": "Liam Johnson",
        "class_name": "Grade 4",
        "section": "A",
        "guardian_contact": "+1 (555) 456-7890",
        "enrollment_date": "2026-01-18",
        "notes": "Excels in art and creative writing.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Liam"
    },
    {
        "roll_number": "R-104",
        "full_name": "Maya Rodriguez",
        "class_name": "Grade 4",
        "section": "A",
        "guardian_contact": "+1 (555) 567-8901",
        "enrollment_date": "2026-01-20",
        "notes": "Class monitor helper; very organized.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Maya"
    },
    {
        "roll_number": "R-105",
        "full_name": "Ethan Williams",
        "class_name": "Grade 4",
        "section": "A",
        "guardian_contact": "+1 (555) 678-9012",
        "enrollment_date": "2026-01-22",
        "notes": "Plays football, great team player.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Ethan"
    },
    {
        "roll_number": "R-106",
        "full_name": "Fatima Zahra",
        "class_name": "Grade 4",
        "section": "A",
        "guardian_contact": "+1 (555) 789-0123",
        "enrollment_date": "2026-02-01",
        "notes": "Excellent cursive handwriting and spelling.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Fatima"
    },
    {
        "roll_number": "R-107",
        "full_name": "Noah Miller",
        "class_name": "Grade 4",
        "section": "B",
        "guardian_contact": "+1 (555) 890-1234",
        "enrollment_date": "2026-02-05",
        "notes": "Enjoys natural history and animals.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Noah"
    },
    {
        "roll_number": "R-108",
        "full_name": "Zoe Kim",
        "class_name": "Grade 4",
        "section": "B",
        "guardian_contact": "+1 (555) 901-2345",
        "enrollment_date": "2026-02-10",
        "notes": "Quiet learner, very meticulous with homework.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Zoe"
    },
    {
        "roll_number": "R-201",
        "full_name": "Oliver Davis",
        "class_name": "Grade 3",
        "section": "A",
        "guardian_contact": "+1 (555) 012-3456",
        "enrollment_date": "2026-01-10",
        "notes": "Very cheerful, loves morning circle time.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Oliver"
    },
    {
        "roll_number": "R-202",
        "full_name": "Emma Wilson",
        "class_name": "Grade 3",
        "section": "A",
        "guardian_contact": "+1 (555) 123-4567",
        "enrollment_date": "2026-01-12",
        "notes": "Gifted in music and storytelling.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Emma"
    },
    {
        "roll_number": "R-203",
        "full_name": "Lucas Martin",
        "class_name": "Grade 3",
        "section": "A",
        "guardian_contact": "+1 (555) 234-9876",
        "enrollment_date": "2026-01-15",
        "notes": "Curious problem solver.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Lucas"
    },
    {
        "roll_number": "R-204",
        "full_name": "Ananya Sharma",
        "class_name": "Grade 3",
        "section": "B",
        "guardian_contact": "+1 (555) 345-8765",
        "enrollment_date": "2026-01-18",
        "notes": "Always ready to assist peers with reading tasks.",
        "photo_path": "https://api.dicebear.com/7.x/bottts/svg?seed=Ananya"
    }
]

def seed_database():
    app = create_app()
    with app.app_context():
        count = Student.query.count()
        if count == 0:
            print("Seeding database with fictional demo student records...")
            students = []
            for data in DEMO_STUDENTS:
                student = Student(
                    roll_number=data["roll_number"],
                    full_name=data["full_name"],
                    class_name=data["class_name"],
                    section=data["section"],
                    guardian_contact=data["guardian_contact"],
                    enrollment_date=data["enrollment_date"],
                    notes=data["notes"],
                    photo_path=data["photo_path"],
                    is_active=True
                )
                db.session.add(student)
                students.append(student)

            db.session.commit()
            print(f"Successfully seeded {len(DEMO_STUDENTS)} students!")
        else:
            print(f"Database contains {count} students.")

        # Seed sample attendance records if none exist
        att_count = Attendance.query.count()
        if att_count == 0:
            print("Seeding sample attendance records...")
            students = Student.query.filter_by(is_active=True).all()
            today = date.today()
            # Seed 5 days of history
            for day_offset in range(5):
                cur_date = (today - timedelta(days=day_offset)).isoformat()
                for i, st in enumerate(students):
                    if (i + day_offset) % 7 == 0:
                        st_status = 'Absent'
                        remarks = 'Medical leave'
                    elif (i + day_offset) % 5 == 0:
                        st_status = 'Late'
                        remarks = 'Bus delay'
                    else:
                        st_status = 'Present'
                        remarks = None

                    att = Attendance(
                        student_id=st.id,
                        date=cur_date,
                        status=st_status,
                        remarks=remarks
                    )
                    db.session.add(att)
            db.session.commit()
            print(f"Successfully seeded {Attendance.query.count()} attendance records!")
        else:
            print(f"Database contains {att_count} attendance records.")

if __name__ == '__main__':
    seed_database()
