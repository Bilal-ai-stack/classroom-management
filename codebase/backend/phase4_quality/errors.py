from flask import jsonify

def register_error_handlers(app):
    """Register standard JSON error handlers across the application."""
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'success': False,
            'error': str(error.description) if hasattr(error, 'description') else 'Bad Request',
            'status_code': 400
        }), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': str(error.description) if hasattr(error, 'description') else 'Resource not found',
            'status_code': 404
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            'success': False,
            'error': 'Method not allowed on this endpoint',
            'status_code': 405
        }), 405

    @app.errorhandler(422)
    def unprocessable(error):
        return jsonify({
            'success': False,
            'error': str(error.description) if hasattr(error, 'description') else 'Unprocessable Entity',
            'status_code': 422
        }), 422

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            'success': False,
            'error': 'Internal server error occurred. Please contact system administrator.',
            'status_code': 500
        }), 500
