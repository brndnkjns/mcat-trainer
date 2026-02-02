import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [streak, setStreak] = useState(null);
  const [dailyProgress, setDailyProgress] = useState(null);
  const [scoreTrend, setScoreTrend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getUserStats(user.id),
      api.getUserWeakTopics(user.id, 5),
      api.getUserSessions(user.id, 5),
      api.getStreak(user.id),
      api.getDailyProgress(user.id),
      api.getScoreTrend(user.id, 14),
    ])
      .then(([statsData, topicsData, sessionsData, streakData, dailyData, trendData]) => {
        setStats(statsData);
        setWeakTopics(topicsData);
        setSessions(sessionsData);
        setStreak(streakData);
        setDailyProgress(dailyData);
        setScoreTrend(trendData);
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

      {/* Streak and Daily Progress Row */}
      <div className="flex gap-4 flex-wrap mb-4">
        {/* Study Streak */}
        {streak && streak.current_streak > 0 && (
          <div className="streak-card" style={{ flex: 1, minWidth: 200 }}>
            <span className="streak-icon">🔥</span>
            <div>
              <div className="streak-count">{streak.current_streak}</div>
              <div className="streak-label">Day Streak</div>
            </div>
          </div>
        )}

        {/* Daily Progress */}
        {dailyProgress && (
          <div className="daily-progress-card" style={{ flex: 2, minWidth: 280 }}>
            <div className="flex justify-between items-center">
              <h3>Today's Goal</h3>
              <span className="text-muted">
                {dailyProgress.answered}/{dailyProgress.goal} questions
              </span>
            </div>
            <div className="daily-progress-bar">
              <div
                className={`daily-progress-fill ${dailyProgress.goal_met ? 'complete' : ''}`}
                style={{ width: `${dailyProgress.progress_percent}%` }}
              />
            </div>
            {dailyProgress.goal_met ? (
              <p className="text-success text-small">🎉 Goal achieved! Keep going!</p>
            ) : (
              <p className="text-muted text-small">
                {dailyProgress.goal - dailyProgress.answered} more to reach your goal
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="flex gap-4 flex-wrap">
          <Link to="/study/setup" className="btn btn-primary btn-lg">
            📝 Practice Questions
          </Link>
          <Link to="/flashcards/setup" className="btn btn-primary btn-lg">
            🗂️ Study Flashcards
          </Link>
          <Link to="/error-notebook" className="btn btn-secondary btn-lg">
            📓 Error Notebook
          </Link>
          <Link to="/analytics" className="btn btn-secondary btn-lg">
            📊 View Analytics
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-header" style={{ marginBottom: 0 }}>Your Progress</h2>
          {scoreTrend && scoreTrend.trend_direction !== 'insufficient_data' && (
            <span className={`trend-indicator ${scoreTrend.trend_direction}`}>
              {scoreTrend.trend_direction === 'improving' && '📈'}
              {scoreTrend.trend_direction === 'declining' && '📉'}
              {scoreTrend.trend_direction === 'stable' && '➡️'}
              {' '}
              {scoreTrend.trend_direction === 'improving' && `+${scoreTrend.trend_percent}%`}
              {scoreTrend.trend_direction === 'declining' && `${scoreTrend.trend_percent}%`}
              {scoreTrend.trend_direction === 'stable' && 'Stable'}
              {' '}this week
            </span>
          )}
        </div>
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
