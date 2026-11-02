import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from db import db
from phase4_quality.models import AuthSession, AuditEvent, User, record_audit


auth_bp = Blueprint('auth', __name__)
VALID_ROLES = {'admin', 'teacher'}
MIN_PASSWORD_LENGTH = 12


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def password_error(password):
    if len(password) < MIN_PASSWORD_LENGTH:
        return f'Password must contain at least {MIN_PASSWORD_LENGTH} characters.'
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        return 'Password must contain at least one letter and one number.'
    return None


def issue_session(user):
    token = secrets.token_urlsafe(32)
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(hours=current_app.config['AUTH_SESSION_HOURS']),
    )
    db.session.add(session)
    return token, session


def bearer_token():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    return header[7:].strip() or None


def current_session():
    token = bearer_token()
    if not token:
        return None
    session = AuthSession.query.filter_by(token_hash=hash_token(token), revoked_at=None).first()
    if not session or session.expires_at <= utcnow() or not session.user.is_active:
        return None
    return session


def require_auth(view):
    @wraps(view)
    def decorated(*args, **kwargs):
        session = current_session()
        if not session:
            return jsonify({'success': False, 'error': 'Authentication required.'}), 401
        request.current_user = session.user
        request.current_session = session
        return view(*args, **kwargs)
    return decorated


def require_roles(*roles):
    def decorator(view):
        @wraps(view)
        @require_auth
        def decorated(*args, **kwargs):
            if request.current_user.role not in roles:
                return jsonify({'success': False, 'error': 'You do not have permission to perform this action.'}), 403
            return view(*args, **kwargs)
        return decorated
    return decorator


@auth_bp.route('/auth/status', methods=['GET'])
@auth_bp.route('/auth/bootstrap', methods=['GET'])
def get_auth_status():
    """Return whether the system requires initial administrator bootstrap.
    Safe and public: exposes only a boolean indicating whether any user account exists.
    """
    user_count = User.query.count()
    return jsonify({
        'success': True,
        'bootstrap_required': user_count == 0,
        'has_users': user_count > 0,
        'user_count': user_count
    }), 200


@auth_bp.route('/auth/bootstrap', methods=['POST'])
def bootstrap_admin():
    """Create the first administrator exactly once."""
    if User.query.count() != 0:
        return jsonify({'success': False, 'error': 'Administrator bootstrap has already been completed.'}), 409
    data = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()
    full_name = str(data.get('full_name', '')).strip()
    password = str(data.get('password', ''))
    error = password_error(password)
    if not email or '@' not in email or not full_name or error:
        return jsonify({'success': False, 'error': error or 'A valid email and full name are required.'}), 400

    user = User(
        email=email,
        full_name=full_name,
        role='admin',
        password_hash=generate_password_hash(password, method='scrypt'),
        password_changed_at=utcnow(),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.session.add(user)
    db.session.flush()
    record_audit('admin.bootstrap', 'user', user.id, {'email': email}, user.id)
    token, _ = issue_session(user)
    db.session.commit()
    return jsonify({'success': True, 'token': token, 'teacher': user.public_dict()}), 201


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    now = utcnow()
    if user and user.locked_until and user.locked_until > now:
        return jsonify({'success': False, 'error': 'Account temporarily locked after repeated failed login attempts.'}), 429

    if not user or not user.is_active or not check_password_hash(user.password_hash, password):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= current_app.config['AUTH_MAX_FAILED_LOGINS']:
                user.locked_until = now + timedelta(minutes=current_app.config['AUTH_LOCKOUT_MINUTES'])
                user.failed_login_count = 0
            db.session.commit()
        return jsonify({'success': False, 'error': 'Invalid email or password.'}), 401

    user.failed_login_count = 0
    user.locked_until = None
    token, _ = issue_session(user)
    record_audit('auth.login', 'user', user.id, actor_user_id=user.id)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Welcome back, {user.full_name}!', 'token': token, 'teacher': user.public_dict()}), 200


@auth_bp.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    return jsonify({'success': True, 'authenticated': True, 'teacher': request.current_user.public_dict()}), 200


@auth_bp.route('/auth/logout', methods=['POST'])
@require_auth
def logout():
    request.current_session.revoked_at = utcnow()
    record_audit('auth.logout', 'user', request.current_user.id, actor_user_id=request.current_user.id)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Logged out successfully.'}), 200


@auth_bp.route('/auth/users', methods=['POST'])
@require_roles('admin')
def create_user():
    data = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()
    full_name = str(data.get('full_name', '')).strip()
    role = str(data.get('role', '')).strip().lower()
    password = str(data.get('password', ''))
    assigned_class = str(data.get('assigned_class', '')).strip() or None
    error = password_error(password)
    if not email or '@' not in email or not full_name or role not in VALID_ROLES or error:
        return jsonify({'success': False, 'error': error or 'Valid email, full name, and role are required.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'error': 'An account with this email already exists.'}), 409
    if role == 'teacher' and not assigned_class:
        return jsonify({'success': False, 'error': 'Teachers must be assigned to a class.'}), 400

    user = User(
        email=email,
        full_name=full_name,
        role=role,
        assigned_class=assigned_class,
        password_hash=generate_password_hash(password, method='scrypt'),
        password_changed_at=utcnow(),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.session.add(user)
    db.session.flush()
    record_audit('user.create', 'user', user.id, {'email': email, 'role': role, 'assigned_class': assigned_class}, request.current_user.id)
    db.session.commit()
    return jsonify({'success': True, 'user': user.public_dict()}), 201


@auth_bp.route('/auth/users/<int:user_id>', methods=['PUT'])
@auth_bp.route('/admin/users/<int:user_id>', methods=['PUT'])
@require_roles('admin')
def update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 404
    data = request.get_json() or {}
    full_name = str(data.get('full_name', user.full_name)).strip()
    email = str(data.get('email', user.email)).strip().lower()
    role = str(data.get('role', user.role)).strip().lower()
    assigned_class = str(data.get('assigned_class', user.assigned_class or '')).strip() or None

    if not full_name or not email or '@' not in email or role not in VALID_ROLES:
        return jsonify({'success': False, 'error': 'Valid full name, email, and role are required.'}), 400

    if role == 'teacher' and not assigned_class:
        return jsonify({'success': False, 'error': 'Teachers must be assigned to a class.'}), 400

    if email != user.email:
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return jsonify({'success': False, 'error': 'An account with this email already exists.'}), 409

    # Prevent an admin from demoting themselves if they are the sole active admin
    if user.id == request.current_user.id and role != 'admin':
        active_admins = User.query.filter_by(role='admin', is_active=True).count()
        if active_admins <= 1:
            return jsonify({'success': False, 'error': 'Cannot change role of the sole active administrator.'}), 400

    old_data = user.public_dict()
    user.full_name = full_name
    user.email = email
    user.role = role
    user.assigned_class = assigned_class if role == 'teacher' else None
    user.updated_at = utcnow()

    record_audit('user.update', 'user', user.id, {'previous': old_data, 'updated': user.public_dict()}, request.current_user.id)
    db.session.commit()
    return jsonify({'success': True, 'message': 'User account updated successfully.', 'user': user.public_dict()}), 200


@auth_bp.route('/auth/users/<int:user_id>/reset-password', methods=['POST'])
@require_roles('admin')
def reset_password(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 404
    password = str((request.get_json() or {}).get('new_password', ''))
    error = password_error(password)
    if error:
        return jsonify({'success': False, 'error': error}), 400
    user.password_hash = generate_password_hash(password, method='scrypt')
    user.password_changed_at = utcnow()
    user.failed_login_count = 0
    user.locked_until = None
    AuthSession.query.filter_by(user_id=user.id, revoked_at=None).update({'revoked_at': utcnow()})
    record_audit('user.password_reset', 'user', user.id, actor_user_id=request.current_user.id)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Password reset; existing sessions were revoked.'}), 200


@auth_bp.route('/admin/audit-events', methods=['GET'])
@require_roles('admin')
def list_audit_events():
    events = AuditEvent.query.order_by(AuditEvent.created_at.desc()).limit(200).all()
    return jsonify({'success': True, 'events': [event.to_dict() for event in events]}), 200
