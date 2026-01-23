import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getUserStats(user.id),
      api.getUserWeakTopics(user.id, 5),
      api.getUserSessions(user.id, 5),
    ])
      .then(([statsData, topicsData, sessionsData]) => {
        setStats(statsData);
        setWeakTopics(topicsData);
        setSessions(sessionsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="mb-6">
        <h1>Welcome back, {user.name}!</h1>
        <p className="text-muted">Ready to continue your MCAT prep?</p>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="flex gap-4 flex-wrap">
          <Link to="/study/setup" className="btn btn-primary btn-lg">
            Start Practice Session
          </Link>
          <Link to="/analytics" className="btn btn-secondary btn-lg">
            View Analytics
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="card">
        <h2 className="card-header">Your Progress</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats?.total_attempts || 0}</div>
            <div className="stat-label">Questions Answered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{(stats?.accuracy || 0).toFixed(1)}%</div>
            <div className="stat-label">Overall Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.session_count || 0}</div>
            <div className="stat-label">Study Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {stats?.avg_time_seconds ? Math.round(stats.avg_time_seconds) : 0}s
            </div>
            <div className="stat-label">Avg. Time/Question</div>
          </div>
        </div>
      </div>

      {/* Performance by Subject */}
      {stats?.by_subject && Object.keys(stats.by_subject).length > 0 && (
        <div className="card">
          <h2 className="card-header">Performance by Subject</h2>
          {Object.entries(stats.by_subject).map(([subject, data]) => {
            const accuracy = (data.accuracy * 100).toFixed(0);
            const level = accuracy >= 70 ? 'high' : accuracy >= 50 ? 'medium' : 'low';
            return (
              <div key={subject} className="accuracy-bar">
                <div className="accuracy-label">{subject}</div>
                <div className="accuracy-track">
                  <div
                    className={`accuracy-fill ${level}`}
                    style={{ width: `${Math.max(accuracy, 5)}%` }}
                  >
                    {accuracy}%
                  </div>
                </div>
                <div className="text-muted text-small" style={{ minWidth: 60 }}>
                  {data.total} Qs
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weak Topics */}
      {weakTopics.length > 0 && (
        <div className="card">
          <h2 className="card-header">Topics to Review</h2>
          <p className="text-muted text-small mb-4">
            Based on your performance, focus on these areas:
          </p>
          {weakTopics.map((topic, idx) => (
            <div key={idx} className="flex justify-between items-center p-4" style={{
              background: idx % 2 === 0 ? 'var(--gray-50)' : 'white',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>
                <div className="font-medium">{topic.chapter_title}</div>
                <div className="text-muted text-small">
                  {topic.subject} • Chapter {topic.chapter}
                </div>
              </div>
              <div className={`text-${topic.accuracy < 50 ? 'error' : 'warning'}`}>
                {(topic.accuracy * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="card">
          <h2 className="card-header">Recent Sessions</h2>
          {sessions.map((session) => {
            const accuracy = session.total_questions > 0
              ? ((session.correct_count / session.total_questions) * 100).toFixed(0)
              : 0;
            return (
              <div
                key={session.id}
                className="flex justify-between items-center p-4"
                style={{
                  borderBottom: '1px solid var(--gray-200)',
                }}
              >
                <div>
                  <div className="text-small text-muted">
                    {new Date(session.started_at).toLocaleDateString()}
                  </div>
                  <div>
                    {session.mode === 'mixed' ? 'Mixed Practice' : session.subjects?.join(', ')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-medium">
                    {session.correct_count}/{session.total_questions}
                  </div>
                  <div className="text-small text-muted">{accuracy}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* First time user message */}
      {stats?.total_attempts === 0 && (
        <div className="card text-center">
          <h2>Ready to Start?</h2>
          <p className="text-muted mt-2 mb-4">
            You haven't answered any questions yet. Start your first practice session!
          </p>
          <Link to="/study/setup" className="btn btn-primary btn-lg">
            Begin Practice
          </Link>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
