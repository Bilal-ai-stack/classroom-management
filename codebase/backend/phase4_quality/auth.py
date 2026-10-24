import hmac
import hashlib
import time
from functools import wraps
from flask import Blueprint, request, jsonify, current_app

auth_bp = Blueprint('auth', __name__)

# In-memory session store for lightweight local MVP
ACTIVE_TOKENS = {}

TEACHER_ACCOUNTS = {
    "teacher@school.edu": {
        "password": "classroom2026",
        "name": "Ms. Clara Vance",
        "role": "Lead Educator",
        "assigned_class": "Grade 4-A"
    },
    "admin@school.edu": {
        "password": "admin2026",
        "name": "Principal Arthur Davis",
        "role": "School Administrator",
        "assigned_class": "All Grades"
    }
}

def generate_token(email):
    secret = current_app.config.get('SECRET_KEY', 'classroom-secret-key-for-practice')
    timestamp = str(int(time.time()))
    raw = f"{email}:{timestamp}:{secret}"
    signature = hashlib.sha256(raw.encode('utf-8')).hexdigest()[:32]
    token = f"cls_{signature}"
    ACTIVE_TOKENS[token] = {
        "email": email,
        "created_at": time.time(),
        **TEACHER_ACCOUNTS.get(email, {})
    }
    return token

def require_auth(f):
    """Decorator to protect sensitive teacher routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip() if 'Bearer ' in auth_header else auth_header.strip()
        
        # In development/practice MVP, allow if token is in active store or request has valid bypass
        if not token or token not in ACTIVE_TOKENS:
            return jsonify({
                'success': False,
                'error': 'Authentication required. Please sign in as an authorized teacher.'
            }), 401
            
        request.current_teacher = ACTIVE_TOKENS[token]
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """Authenticate educator credentials."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({
            'success': False,
            'error': 'Email and password are required'
        }), 400

    account = TEACHER_ACCOUNTS.get(email)
    if not account or account['password'] != password:
        return jsonify({
            'success': False,
            'error': 'Invalid email or password'
        }), 401

    token = generate_token(email)
    return jsonify({
        'success': True,
        'message': f'Welcome back, {account["name"]}!',
        'token': token,
        'teacher': {
            'email': email,
            'name': account['name'],
            'role': account['role'],
            'assigned_class': account['assigned_class']
        }
    }), 200

@auth_bp.route('/auth/me', methods=['GET'])
def get_current_user():
    """Retrieve profile of authenticated educator."""
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if 'Bearer ' in auth_header else auth_header.strip()

    if token and token in ACTIVE_TOKENS:
        user = ACTIVE_TOKENS[token]
        return jsonify({
            'success': True,
            'authenticated': True,
            'teacher': {
                'email': user['email'],
                'name': user['name'],
                'role': user['role'],
                'assigned_class': user['assigned_class']
            }
        }), 200

    # Default teacher preview for practice environment
    default_account = TEACHER_ACCOUNTS['teacher@school.edu']
    return jsonify({
        'success': True,
        'authenticated': False,
        'default_teacher': {
            'email': 'teacher@school.edu',
            'name': default_account['name'],
            'role': default_account['role'],
            'assigned_class': default_account['assigned_class']
        }
    }), 200

@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    """Sign out and invalidate session token."""
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if 'Bearer ' in auth_header else auth_header.strip()
    if token in ACTIVE_TOKENS:
        del ACTIVE_TOKENS[token]

    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200
