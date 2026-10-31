const BASE_URL = '/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  const token = localStorage.getItem('classroom_token');

  const headers = isFormData
    ? { ...(options.headers || {}) }
    : {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// Student Portfolio API endpoints
export const studentApi = {
  getStats: () => apiRequest('/dashboard/stats'),
  getStudents: (q = '', className = '', includeArchived = false) => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (className) params.append('class_name', className);
    if (includeArchived) params.append('include_archived', 'true');
    return apiRequest(`/students?${params.toString()}`);
  },
  getStudent: (id) => apiRequest(`/students/${id}`),
  createStudent: (data) => apiRequest('/students', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateStudent: (id, data) => apiRequest(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  archiveStudent: (id, is_active) => apiRequest(`/students/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active })
  }),
  getClasses: () => apiRequest('/classes')
};

// Daily Attendance & Reports API endpoints
export const attendanceApi = {
  getDailyAttendance: (date = '', className = '') => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (className && className !== 'All Classes') params.append('class_name', className);
    return apiRequest(`/attendance?${params.toString()}`);
  },
  saveBulkAttendance: (date, records) => apiRequest('/attendance/bulk', {
    method: 'POST',
    body: JSON.stringify({ date, records })
  }),
  getStudentHistory: (studentId) => apiRequest(`/students/${studentId}/attendance`),
  getReport: (startDate = '', endDate = '', className = '') => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (className && className !== 'All Classes') params.append('class_name', className);
    return apiRequest(`/reports/attendance?${params.toString()}`);
  },
  getSession: (date, className, section = 'A') => {
    const params = new URLSearchParams({ date, class_name: className, section });
    return apiRequest(`/attendance/session?${params.toString()}`);
  },
  finalizeSession: (date, className, section = 'A') => apiRequest('/attendance/session/finalize', {
    method: 'POST',
    body: JSON.stringify({ date, class_name: className, section })
  }),
  reopenSession: (date, className, reason, section = 'A') => apiRequest('/attendance/session/reopen', {
    method: 'POST',
    body: JSON.stringify({ date, class_name: className, section, reason })
  })
};

// Phase 3 Photo-Assisted Attendance API endpoints
export const photoApi = {
  detectFaces: (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiRequest('/photo/detect-faces', {
      method: 'POST',
      body: formData
    });
  },
  verifyAttendance: (date, verifiedStudents) => apiRequest('/photo/verify-attendance', {
    method: 'POST',
    body: JSON.stringify({ date, verified_students: verifiedStudents })
  }),
  cleanupPhotos: () => apiRequest('/photo/cleanup', {
    method: 'DELETE'
  })
};

// Phase 4 Teacher Authentication & Session API
export const authApi = {
  getStatus: () => apiRequest('/auth/status'),
  bootstrap: (data) => apiRequest('/auth/bootstrap', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  getCurrentUser: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', {
    method: 'POST'
  })
};

// Phase 4 Privacy & Audit Controls API
export const privacyApi = {
  getPolicy: () => apiRequest('/privacy/policy'),
  audit: () => apiRequest('/privacy/audit'),
  purgeTemporaryData: () => apiRequest('/privacy/purge', {
    method: 'POST'
  })
};

// Phase 1 Administration & Institution Configuration API
export const adminApi = {
  getPublicProfile: () => apiRequest('/institution/profile'),
  getInstitution: () => apiRequest('/admin/institution'),
  updateInstitution: (data) => apiRequest('/admin/institution', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getClasses: (includeInactive = false) => apiRequest(`/admin/classes${includeInactive ? '?include_inactive=true' : ''}`),
  createClass: (data) => apiRequest('/admin/classes', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateClass: (id, data) => apiRequest(`/admin/classes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteClass: (id) => apiRequest(`/admin/classes/${id}`, {
    method: 'DELETE'
  }),
  getUsers: () => apiRequest('/admin/users'),
  createUser: (data) => apiRequest('/auth/users', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  toggleUserStatus: (id, isActive) => apiRequest(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive })
  }),
  resetPassword: (id, newPassword) => apiRequest(`/auth/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword })
  }),
  getTerms: () => apiRequest('/admin/terms'),
  createTerm: (data) => apiRequest('/admin/terms', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getAuditEvents: () => apiRequest('/admin/audit-events'),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return apiRequest('/admin/institution/logo', {
      method: 'POST',
      body: formData
    });
  },
  removeLogo: () => apiRequest('/admin/institution/logo', {
    method: 'DELETE'
  })
};


