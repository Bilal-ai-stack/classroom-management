const BASE_URL = '/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

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

// Phase 1 API endpoints
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
