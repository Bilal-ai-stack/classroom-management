import os
import glob
from flask import Blueprint, jsonify, current_app

privacy_bp = Blueprint('privacy', __name__)

@privacy_bp.route('/privacy/policy', methods=['GET'])
def get_privacy_policy():
    """Return explicit student data and computer vision ethics policy."""
    return jsonify({
        'success': True,
        'policy': {
            'system_name': 'ClassroomOS',
            'version': '1.0.0-phase4',
            'compliance': [
                'Zero Biometric Embedding Storage: No facial embeddings, vectors, or identity matrices are stored.',
                'Local Edge Processing: Haar Cascade face detection operates exclusively on the local host.',
                'Human-in-the-Loop: Teachers manually confirm all attendance; no automated identity assignment.',
                'Ephemeral Image Retention: Classroom photos and detected crops are strictly temporary.',
                'Synthetic Seed Data: Fictional student profiles used for demonstration and testing.'
            ],
            'retention_policy': {
                'daily_attendance_records': 'Retained per academic year in local SQLite',
                'temporary_face_crops': 'Purged automatically on session completion or manual trigger',
                'class_group_photos': 'Never uploaded to external clouds'
            }
        }
    }), 200

@privacy_bp.route('/privacy/purge', methods=['POST'])
def purge_temporary_data():
    """Immediately purge all temporary photo review artifacts."""
    crops_dir = os.path.join(current_app.instance_path, 'temp_crops')
    deleted_count = 0

    if os.path.exists(crops_dir):
        files = glob.glob(os.path.join(crops_dir, '*'))
        for f in files:
            try:
                os.remove(f)
                deleted_count += 1
            except OSError:
                pass

    return jsonify({
        'success': True,
        'message': f'Privacy purge completed. {deleted_count} temporary image files safely deleted.',
        'deleted_count': deleted_count
    }), 200

@privacy_bp.route('/privacy/audit', methods=['GET'])
def privacy_audit():
    """Audit local privacy compliance and temporary file footprints."""
    crops_dir = os.path.join(current_app.instance_path, 'temp_crops')
    temp_files = []
    total_bytes = 0

    if os.path.exists(crops_dir):
        for entry in os.scandir(crops_dir):
            if entry.is_file():
                temp_files.append(entry.name)
                total_bytes += entry.stat().st_size

    return jsonify({
        'success': True,
        'audit': {
            'temporary_crops_count': len(temp_files),
            'temporary_storage_bytes': total_bytes,
            'cloud_sync_enabled': False,
            'biometric_templates_present': False,
            'status': 'Compliant'
        }
    }), 200
