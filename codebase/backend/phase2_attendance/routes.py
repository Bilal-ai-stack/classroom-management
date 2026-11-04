import csv
import io
from datetime import date
from flask import Blueprint, request, jsonify, Response
from sqlalchemy import func
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance, AttendanceSession, utcnow
from phase4_quality.auth import require_auth
from phase4_quality.models import record_audit, AuditEvent

attendance_bp = Blueprint('attendance', __name__)

VALID_STATUSES = {'Present', 'Absent', 'Late', 'Excused', 'Unverified'}
STATUS_NORMALIZATION = {
    'present': 'Present',
    'absent': 'Absent',
    'late': 'Late',
    'excused': 'Excused',
    'unverified': 'Unverified',
}


def parse_iso_date(value):
    """Return a normalized ISO date string or None when invalid."""
    try:
        return date.fromisoformat(str(value).strip()).isoformat()
    except (TypeError, ValueError):
        return None


def calculate_attendance_rates(present_count, late_count, absent_count, unverified_count=0, excused_count=0):
    """
    Calculate attendance rate following educational policy:
    - Excused absences are excluded from the denominator.
    - Rate = (Present + Late) / (Present + Late + Absent + Unverified).
    - Returns 0.0 (not 100%) when eligible denominator is 0.
    """
    eligible_count = present_count + late_count + absent_count + unverified_count
    if eligible_count == 0:
        return 0.0, 0.0, 0
    attendance_rate = round(((present_count + late_count) / eligible_count * 100), 1)
    present_rate = round((present_count / eligible_count * 100), 1)
    return attendance_rate, present_rate, eligible_count


@attendance_bp.route('/attendance', methods=['GET'])
@require_auth
def get_daily_attendance():
    """Fetch class roster with recorded attendance and session state for a specific date."""
    target_date = request.args.get('date', '').strip()
    if not target_date:
        target_date = date.today().isoformat()
    elif not parse_iso_date(target_date):
        return jsonify({'success': False, 'error': 'Date must be a valid calendar date in YYYY-MM-DD format.'}), 400

    class_name = request.args.get('class_name', '').strip()
    section = request.args.get('section', '').strip()

    if request.current_user.role == 'teacher':
        if class_name and class_name != request.current_user.assigned_class:
            return jsonify({'success': False, 'error': 'You do not have permission to view this class.'}), 403
        class_name = request.current_user.assigned_class or ''

    # Query active students
    student_query = Student.query.filter_by(is_active=True)
    if class_name and class_name != 'All Classes':
        student_query = student_query.filter_by(class_name=class_name)
    if section:
        student_query = student_query.filter_by(section=section)

    students = student_query.order_by(Student.class_name, Student.section, Student.roll_number).all()

    # Query attendance records
    student_ids = [s.id for s in students]
    existing_records = {}
    if student_ids:
        attendances = Attendance.query.filter(
            Attendance.student_id.in_(student_ids),
            Attendance.date == target_date
        ).all()
        for att in attendances:
            existing_records[att.student_id] = att

    roster = []
    present_count = 0
    absent_count = 0
    late_count = 0
    excused_count = 0
    unverified_count = 0
    unrecorded_count = 0

    for s in students:
        att = existing_records.get(s.id)
        if att:
            current_status = att.status
            remarks = att.remarks
            att_id = att.id
            if current_status == 'Present':
                present_count += 1
            elif current_status == 'Absent':
                absent_count += 1
            elif current_status == 'Late':
                late_count += 1
            elif current_status == 'Excused':
                excused_count += 1
            elif current_status == 'Unverified':
                unverified_count += 1
        else:
            current_status = 'Unrecorded'
            remarks = None
            att_id = None
            unrecorded_count += 1

        roster.append({
            'student_id': s.id,
            'roll_number': s.roll_number,
            'full_name': s.full_name,
            'class_name': att.snapshot_class_name if (att and att.snapshot_class_name) else s.class_name,
            'section': att.snapshot_section if (att and att.snapshot_section) else s.section,
            'status': current_status,
            'remarks': remarks,
            'attendance_id': att_id,
            'guardian_name': s.guardian_name or '',
            'guardian_contact': s.guardian_contact or '',
            'whatsapp_number': s.whatsapp_number or '',
            'guardian_relationship': s.guardian_relationship or 'Guardian',
            'whatsapp_consent': bool(s.whatsapp_consent)
        })

    attendance_rate, present_rate, eligible_count = calculate_attendance_rates(
        present_count, late_count, absent_count, unverified_count, excused_count
    )

    # Check for session status if specific class is queried
    session_data = None
    if class_name and class_name != 'All Classes':
        session_query = AttendanceSession.query.filter_by(class_name=class_name, date=target_date)
        if section:
            session_query = session_query.filter_by(section=section)
        session = session_query.first()
        if session:
            session_data = session.to_dict()

    if not session_data:
        session_data = {
            'id': None,
            'class_name': class_name or 'All Classes',
            'section': section or 'A',
            'date': target_date,
            'session_type': 'Daily',
            'status': 'open',
            'is_finalized': False,
            'finalized_at': None,
            'finalized_by_user_id': None,
            'finalized_by_name': None,
            'reopened_at': None,
            'reopened_by_user_id': None,
            'reopened_by_name': None,
            'reopen_reason': None
        }

    return jsonify({
        'success': True,
        'date': target_date,
        'class_name': class_name or 'All Classes',
        'section': section or '',
        'session': session_data,
        'summary': {
            'total_students': len(students),
            'present_count': present_count,
            'absent_count': absent_count,
            'late_count': late_count,
            'excused_count': excused_count,
            'unverified_count': unverified_count,
            'unrecorded_count': unrecorded_count,
            'eligible_count': eligible_count,
            'attendance_rate': attendance_rate,
            'present_rate': present_rate
        },
        'roster': roster
    }), 200


@attendance_bp.route('/attendance/bulk', methods=['POST'])
@require_auth
def save_bulk_attendance():
    """Bulk upsert attendance records with finalization gate, snapshotting, and correction audit."""
    data = request.get_json() or {}
    target_date = str(data.get('date', '')).strip()
    records = data.get('records', [])

    if not target_date:
        return jsonify({'success': False, 'error': 'Date is required in YYYY-MM-DD format.'}), 400

    target_date = parse_iso_date(target_date)
    if not target_date:
        return jsonify({'success': False, 'error': 'Date must be a valid calendar date in YYYY-MM-DD format.'}), 400

    if not isinstance(records, list) or len(records) == 0:
        return jsonify({'success': False, 'error': 'Records array cannot be empty.'}), 400

    errors = []
    validated_records = []
    seen_student_ids = set()

    for index, item in enumerate(records):
        if not isinstance(item, dict):
            errors.append(f'Record {index + 1} must be an object.')
            continue
        student_id = item.get('student_id')
        raw_status = str(item.get('status', '')).strip().lower()
        remarks = str(item.get('remarks', '')).strip() or None

        if not student_id:
            errors.append(f'Record {index + 1} is missing student_id.')
            continue

        if raw_status not in STATUS_NORMALIZATION:
            allowed = ', '.join(sorted(VALID_STATUSES))
            errors.append(f'Record {index + 1} has invalid status. Allowed statuses: {allowed}.')
            continue
        status = STATUS_NORMALIZATION[raw_status]

        if student_id in seen_student_ids:
            errors.append(f'Student ID {student_id} appears more than once in the request.')
            continue
        seen_student_ids.add(student_id)

        student = db.session.get(Student, student_id)
        if not student:
            errors.append(f'Student with ID {student_id} not found.')
            continue

        if not student.is_active:
            errors.append(f'Student with ID {student_id} is archived and cannot receive new attendance.')
            continue
        if request.current_user.role == 'teacher' and student.class_name != request.current_user.assigned_class:
            errors.append(f'Student ID {student_id} is outside your assigned class.')
            continue

        validated_records.append((student, status, remarks))

    if errors:
        return jsonify({
            'success': False,
            'error': 'Attendance was not saved because one or more records are invalid.',
            'errors': errors
        }), 400

    # Gate check: Verify none of the classes/sections are finalized
    class_sections = {(s.class_name, s.section or 'A') for s, _, _ in validated_records}
    sessions_by_key = {}
    for c_name, c_sec in class_sections:
        sess = AttendanceSession.query.filter_by(
            class_name=c_name,
            section=c_sec,
            date=target_date
        ).first()
        if sess and sess.is_finalized:
            return jsonify({
                'success': False,
                'error': f"Attendance for class '{c_name}' (section '{c_sec}') on {target_date} is finalized and cannot be modified without reopening."
            }), 409
        if not sess:
            sess = AttendanceSession(
                class_name=c_name,
                section=c_sec,
                date=target_date,
                status='open'
            )
            db.session.add(sess)
            db.session.flush()
        sessions_by_key[(c_name, c_sec)] = sess

    correction_count = 0
    for student, status, remarks in validated_records:
        sess = sessions_by_key[(student.class_name, student.section or 'A')]
        existing = Attendance.query.filter_by(
            student_id=student.id,
            date=target_date
        ).first()

        if existing:
            # Audit any correction / change to status or remarks
            if existing.status != status or (existing.remarks or None) != (remarks or None):
                record_audit(
                    'attendance.correction',
                    'attendance',
                    existing.id,
                    {
                        'student_id': student.id,
                        'student_name': student.full_name,
                        'class_name': student.class_name,
                        'date': target_date,
                        'old_status': existing.status,
                        'new_status': status,
                        'old_remarks': existing.remarks,
                        'new_remarks': remarks,
                    },
                    request.current_user.id
                )
                correction_count += 1

            existing.status = status
            existing.remarks = remarks
            existing.session_id = sess.id
            existing.snapshot_class_name = student.class_name
            existing.snapshot_section = student.section or 'A'
            existing.updated_by_user_id = request.current_user.id
            existing.updated_at = utcnow()
        else:
            new_att = Attendance(
                student_id=student.id,
                date=target_date,
                status=status,
                remarks=remarks,
                session_id=sess.id,
                snapshot_class_name=student.class_name,
                snapshot_section=student.section or 'A',
                updated_by_user_id=request.current_user.id,
                created_at=utcnow(),
                updated_at=utcnow()
            )
            db.session.add(new_att)

    record_audit('attendance.bulk_save', 'attendance', target_date, {'student_ids': sorted(seen_student_ids), 'corrections': correction_count}, request.current_user.id)
    db.session.commit()

    saved_count = len(validated_records)

    return jsonify({
        'success': True,
        'message': f'Successfully saved attendance for {saved_count} student(s) on {target_date}.',
        'saved_count': saved_count,
        'corrections_count': correction_count,
        'errors': []
    }), 200


@attendance_bp.route('/attendance/session/finalize', methods=['POST'])
@require_auth
def finalize_attendance_session():
    """Finalize an attendance session, preventing further mutations until explicitly reopened."""
    data = request.get_json() or {}
    target_date = str(data.get('date', '')).strip()
    class_name = str(data.get('class_name', '')).strip()
    section = str(data.get('section', 'A')).strip() or 'A'

    if not target_date or not parse_iso_date(target_date):
        return jsonify({'success': False, 'error': 'Valid date in YYYY-MM-DD format is required.'}), 400
    target_date = parse_iso_date(target_date)

    if not class_name:
        return jsonify({'success': False, 'error': 'Class name is required.'}), 400

    if request.current_user.role == 'teacher' and class_name != request.current_user.assigned_class:
        return jsonify({'success': False, 'error': 'You do not have permission to finalize attendance for this class.'}), 403

    session = AttendanceSession.query.filter_by(
        class_name=class_name,
        section=section,
        date=target_date
    ).first()

    if not session:
        session = AttendanceSession(
            class_name=class_name,
            section=section,
            date=target_date,
            status='open'
        )
        db.session.add(session)
        db.session.flush()

    if session.is_finalized:
        return jsonify({
            'success': True,
            'message': 'Session is already finalized.',
            'session': session.to_dict()
        }), 200

    session.status = 'finalized'
    session.finalized_at = utcnow()
    session.finalized_by_user_id = request.current_user.id
    session.updated_at = utcnow()

    # Link any unlinked attendances for this class/section on this date
    unlinked = Attendance.query.join(Student).filter(
        Attendance.date == target_date,
        Student.class_name == class_name,
        Student.section == section,
        Attendance.session_id.is_(None)
    ).all()
    for att in unlinked:
        att.session_id = session.id
        att.snapshot_class_name = class_name
        att.snapshot_section = section

    record_audit(
        'attendance.session_finalize',
        'attendance_session',
        session.id,
        {'class_name': class_name, 'section': section, 'date': target_date},
        request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Attendance session for '{class_name}' ({section}) on {target_date} finalized successfully.",
        'session': session.to_dict()
    }), 200


@attendance_bp.route('/attendance/session/reopen', methods=['POST'])
@require_auth
def reopen_attendance_session():
    """Reopen a finalized attendance session with an audited justification reason."""
    data = request.get_json() or {}
    target_date = str(data.get('date', '')).strip()
    class_name = str(data.get('class_name', '')).strip()
    section = str(data.get('section', 'A')).strip() or 'A'
    reason = str(data.get('reason', '')).strip()

    if not target_date or not parse_iso_date(target_date):
        return jsonify({'success': False, 'error': 'Valid date in YYYY-MM-DD format is required.'}), 400
    target_date = parse_iso_date(target_date)

    if not class_name:
        return jsonify({'success': False, 'error': 'Class name is required.'}), 400

    if len(reason) < 5:
        return jsonify({'success': False, 'error': 'A detailed reopen reason is required (at least 5 characters).'}), 400

    if request.current_user.role == 'teacher' and class_name != request.current_user.assigned_class:
        return jsonify({'success': False, 'error': 'You do not have permission to reopen attendance for this class.'}), 403

    session = AttendanceSession.query.filter_by(
        class_name=class_name,
        section=section,
        date=target_date
    ).first()

    if not session or not session.is_finalized:
        return jsonify({'success': False, 'error': 'No finalized session found for this class, section, and date.'}), 400

    session.status = 'open'
    session.reopened_at = utcnow()
    session.reopened_by_user_id = request.current_user.id
    session.reopen_reason = reason
    session.updated_at = utcnow()

    record_audit(
        'attendance.session_reopen',
        'attendance_session',
        session.id,
        {'class_name': class_name, 'section': section, 'date': target_date, 'reason': reason},
        request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Attendance session for '{class_name}' ({section}) on {target_date} reopened.",
        'session': session.to_dict()
    }), 200


@attendance_bp.route('/attendance/session', methods=['GET'])
@require_auth
def get_attendance_session():
    """Retrieve details and audit trail for a class/date attendance session."""
    target_date = request.args.get('date', '').strip()
    class_name = request.args.get('class_name', '').strip()
    section = request.args.get('section', 'A').strip() or 'A'

    if not target_date or not parse_iso_date(target_date):
        return jsonify({'success': False, 'error': 'Valid date in YYYY-MM-DD format is required.'}), 400
    target_date = parse_iso_date(target_date)

    if not class_name:
        return jsonify({'success': False, 'error': 'Class name is required.'}), 400

    if request.current_user.role == 'teacher' and class_name != request.current_user.assigned_class:
        return jsonify({'success': False, 'error': 'You do not have permission to view session for this class.'}), 403

    session = AttendanceSession.query.filter_by(
        class_name=class_name,
        section=section,
        date=target_date
    ).first()

    if not session:
        return jsonify({
            'success': True,
            'session': None,
            'is_finalized': False,
            'status': 'open'
        }), 200

    # Retrieve audit history related to this session
    audit_events = AuditEvent.query.filter(
        AuditEvent.entity_type == 'attendance_session',
        AuditEvent.entity_id == str(session.id)
    ).order_by(AuditEvent.created_at.desc()).all()

    return jsonify({
        'success': True,
        'session': session.to_dict(),
        'audit_history': [e.to_dict() for e in audit_events]
    }), 200


@attendance_bp.route('/students/<int:student_id>/attendance', methods=['GET'])
@require_auth
def get_student_attendance_history(student_id):
    """Fetch complete attendance history and percentage metrics for a student with policy math."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404
    if request.current_user.role == 'teacher' and student.class_name != request.current_user.assigned_class:
        return jsonify({'success': False, 'error': 'You do not have permission to view this student.'}), 403

    records = Attendance.query.filter_by(student_id=student_id).order_by(Attendance.date.desc()).all()

    total_days = len(records)
    present_days = sum(1 for r in records if r.status == 'Present')
    late_days = sum(1 for r in records if r.status == 'Late')
    absent_days = sum(1 for r in records if r.status == 'Absent')
    excused_days = sum(1 for r in records if r.status == 'Excused')
    unverified_days = sum(1 for r in records if r.status == 'Unverified')

    attendance_rate, present_rate, eligible_days = calculate_attendance_rates(
        present_days, late_days, absent_days, unverified_days, excused_days
    )

    return jsonify({
        'success': True,
        'student': student.to_dict(),
        'metrics': {
            'total_days': total_days,
            'present_days': present_days,
            'late_days': late_days,
            'absent_days': absent_days,
            'excused_days': excused_days,
            'unverified_days': unverified_days,
            'eligible_days': eligible_days,
            'attendance_rate': attendance_rate,
            'present_rate': present_rate
        },
        'history': [r.to_dict() for r in records]
    }), 200


@attendance_bp.route('/reports/attendance', methods=['GET'])
@require_auth
def get_attendance_report():
    """Generate attendance summary and trends across date range, respecting historical snapshots."""
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()
    class_name = request.args.get('class_name', '').strip()

    if request.current_user.role == 'teacher':
        if class_name and class_name != request.current_user.assigned_class:
            return jsonify({'success': False, 'error': 'You do not have permission to view this class.'}), 403
        class_name = request.current_user.assigned_class or ''

    query = Attendance.query.join(Student)
    if class_name and class_name != 'All Classes':
        # Honor historical snapshot first, fallback to student's current class
        query = query.filter(func.coalesce(Attendance.snapshot_class_name, Student.class_name) == class_name)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    attendances = query.order_by(Attendance.date.asc()).all()

    total_records = len(attendances)
    present_count = sum(1 for a in attendances if a.status == 'Present')
    late_count = sum(1 for a in attendances if a.status == 'Late')
    absent_count = sum(1 for a in attendances if a.status == 'Absent')
    excused_count = sum(1 for a in attendances if a.status == 'Excused')
    unverified_count = sum(1 for a in attendances if a.status == 'Unverified')

    overall_rate, present_rate, eligible_count = calculate_attendance_rates(
        present_count, late_count, absent_count, unverified_count, excused_count
    )

    # Aggregate by date for trend timeline
    daily_stats = {}
    for a in attendances:
        if a.date not in daily_stats:
            daily_stats[a.date] = {
                'date': a.date,
                'present': 0,
                'absent': 0,
                'late': 0,
                'excused': 0,
                'unverified': 0,
                'total': 0
            }
        daily_stats[a.date]['total'] += 1
        if a.status == 'Present':
            daily_stats[a.date]['present'] += 1
        elif a.status == 'Late':
            daily_stats[a.date]['late'] += 1
        elif a.status == 'Absent':
            daily_stats[a.date]['absent'] += 1
        elif a.status == 'Excused':
            daily_stats[a.date]['excused'] += 1
        elif a.status == 'Unverified':
            daily_stats[a.date]['unverified'] += 1

    timeline = []
    for d_stat in sorted(daily_stats.values(), key=lambda x: x['date']):
        d_rate, _, _ = calculate_attendance_rates(
            d_stat['present'], d_stat['late'], d_stat['absent'], d_stat['unverified'], d_stat['excused']
        )
        d_stat['rate'] = d_rate
        timeline.append(d_stat)

    return jsonify({
        'success': True,
        'summary': {
            'total_records': total_records,
            'present_count': present_count,
            'late_count': late_count,
            'absent_count': absent_count,
            'excused_count': excused_count,
            'unverified_count': unverified_count,
            'eligible_count': eligible_count,
            'overall_rate': overall_rate,
            'present_rate': present_rate
        },
        'timeline': timeline,
        'records': [a.to_dict() for a in attendances]
    }), 200


@attendance_bp.route('/reports/attendance/csv', methods=['GET'])
@require_auth
def export_attendance_csv():
    """Stream an RFC 4180 compliant CSV export for the selected date range and class."""
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()
    class_name = request.args.get('class_name', '').strip()

    if request.current_user.role == 'teacher':
        if class_name and class_name != request.current_user.assigned_class:
            return jsonify({'success': False, 'error': 'You do not have permission to export this class.'}), 403
        class_name = request.current_user.assigned_class or ''

    query = Attendance.query.join(Student)
    if class_name and class_name != 'All Classes':
        query = query.filter(func.coalesce(Attendance.snapshot_class_name, Student.class_name) == class_name)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    attendances = query.order_by(Attendance.date.asc(), Student.roll_number.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output, lineterminator='\r\n')
    writer.writerow(['Date', 'Roll Number', 'Student Name', 'Class', 'Section', 'Status', 'Remarks'])

    for att in attendances:
        st = att.student
        c_name = att.snapshot_class_name or (st.class_name if st else '')
        sec = att.snapshot_section or (st.section if st else '')
        writer.writerow([
            att.date,
            st.roll_number if st else '',
            st.full_name if st else '',
            c_name,
            sec,
            att.status,
            att.remarks or ''
        ])

    csv_data = output.getvalue()
    safe_class = (class_name or 'All_Classes').replace(' ', '_')
    filename = f"attendance_report_{safe_class}_{start_date or 'start'}_to_{end_date or 'end'}.csv"
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': 'text/csv; charset=utf-8'
        }
    )

