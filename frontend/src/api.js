/**
 * API client for MCAT Trainer backend
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// User API
export const api = {
  // Users
  getUsers: () => fetchAPI('/api/users'),
  getUser: (userId) => fetchAPI(`/api/users/${userId}`),
  getUserStats: (userId) => fetchAPI(`/api/users/${userId}/stats`),
  getUserWeakTopics: (userId, limit = 5) =>
    fetchAPI(`/api/users/${userId}/weak-topics?limit=${limit}`),
  getUserSessions: (userId, limit = 20) =>
    fetchAPI(`/api/users/${userId}/sessions?limit=${limit}`),

  // Subjects
  getSubjects: () => fetchAPI('/api/subjects'),

  // Sessions
  createSession: (data) =>
    fetchAPI('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSession: (sessionId) => fetchAPI(`/api/sessions/${sessionId}`),
  endSession: (sessionId) =>
    fetchAPI(`/api/sessions/${sessionId}/end`, { method: 'POST' }),
  getSessionAttempts: (sessionId) =>
    fetchAPI(`/api/sessions/${sessionId}/attempts`),

  // Questions
  getNextQuestion: (userId, sessionId, subjects = null) => {
    let url = `/api/questions/next?user_id=${userId}&session_id=${sessionId}`;
    if (subjects && subjects.length > 0) {
      url += `&subjects=${subjects.join(',')}`;
    }
    return fetchAPI(url);
  },
  getQuestion: (questionId, includeAnswer = false) =>
    fetchAPI(`/api/questions/${questionId}?include_answer=${includeAnswer}`),

  // Answers
  submitAnswer: (data) =>
    fetchAPI('/api/answer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Analytics
  getTopicAnalytics: (userId) =>
    fetchAPI(`/api/users/${userId}/analytics/topics`),
  getTrendAnalytics: (userId, days = 30) =>
    fetchAPI(`/api/users/${userId}/analytics/trends?days=${days}`),
};

export default api;
