import os
from flask import Flask, jsonify
from flask_cors import CORS
from db import db
from phase1_students.routes import students_bp
from phase1_students.models import Student

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    os.makedirs(app.instance_path, exist_ok=True)
    db_path = os.path.join(app.instance_path, 'classroom.db')

    app.config.from_mapping(
        SECRET_KEY='classroom-secret-key-for-practice',
        SQLALCHEMY_DATABASE_URI=f'sqlite:///{db_path}',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    if test_config:
        app.config.update(test_config)

    db.init_app(app)

    # Register Phase 1 Blueprints
    app.register_blueprint(students_bp, url_prefix='/api')

    with app.app_context():
        db.create_all()

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'healthy', 'service': 'Classroom Management API'}), 200

    @app.route('/api/dashboard/stats', methods=['GET'])
    def dashboard_stats():
        """Phase 1 initial dashboard statistics."""
        total_students = Student.query.filter_by(is_active=True).count()
        recent_students = Student.query.filter_by(is_active=True).order_by(Student.id.desc()).limit(5).all()

        return jsonify({
            'success': True,
            'stats': {
                'total_students': total_students,
                'today_present': 0,
                'today_absent': 0,
                'today_late': 0,
                'attendance_rate': 100 if total_students == 0 else 92, # Default demo or real calculation in Phase 2
                'recent_students': [s.to_dict() for s in recent_students]
            }
        }), 200

    return app

if __name__ == '__main__':
    app = create_app()
    print("Classroom Management API running on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
