import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function Analytics({ user }) {
  const [stats, setStats] = useState(null);
  const [topicData, setTopicData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [weakTopics, setWeakTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getUserStats(user.id),
      api.getTopicAnalytics(user.id),
      api.getTrendAnalytics(user.id, 30),
      api.getUserWeakTopics(user.id, 10),
    ])
      .then(([statsData, topicAnalytics, trends, weak]) => {
        setStats(statsData);
        setTopicData(topicAnalytics);
        setTrendData(trends);
        setWeakTopics(weak);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Calculate predicted MCAT score based on accuracy
  // This is a rough estimate: ~500 is average, each % point ~= 1.5 points
  const predictedScore = stats?.accuracy
    ? Math.round(472 + (stats.accuracy * 0.56))
    : null;

  return (
    <div className="container-wide">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1>Performance Analytics</h1>
          <p className="text-muted">Track your progress over time</p>
        </div>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Overall Stats */}
      <div className="card">
        <h2 className="card-header">Overall Performance</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats?.total_attempts || 0}</div>
            <div className="stat-label">Total Questions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{
              color: stats?.accuracy >= 70 ? 'var(--success)' :
                     stats?.accuracy >= 50 ? 'var(--warning)' : 'var(--error)'
            }}>
              {(stats?.accuracy || 0).toFixed(1)}%
            </div>
            <div className="stat-label">Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.session_count || 0}</div>
            <div className="stat-label">Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {stats?.avg_time_seconds ? Math.round(stats.avg_time_seconds) : 0}s
            </div>
            <div className="stat-label">Avg Time</div>
          </div>
          {predictedScore && stats?.total_attempts >= 50 && (
            <div className="stat-card">
              <div className="stat-value">{predictedScore}</div>
              <div className="stat-label">Est. MCAT Score*</div>
            </div>
          )}
        </div>
        {predictedScore && stats?.total_attempts >= 50 && (
          <p className="text-muted text-small mt-4">
            *Estimated score is based on your current accuracy. Actual MCAT scores depend on many factors.
            Continue practicing to improve your estimate's reliability.
          </p>
        )}
      </div>

      {/* 30-Day Trend */}
      {trendData.length > 0 && (
        <div className="card">
          <h2 className="card-header">30-Day Progress</h2>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minWidth: 600, height: 200, padding: '20px 0' }}>
              {trendData.map((day, idx) => {
                const height = Math.max(day.accuracy, 5);
                const color = day.accuracy >= 70 ? 'var(--success)' :
                              day.accuracy >= 50 ? 'var(--warning)' : 'var(--error)';
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title={`${day.date}: ${day.correct}/${day.total} (${day.accuracy.toFixed(0)}%)`}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${height}%`,
                        background: color,
                        borderRadius: 4,
                        minHeight: 4,
                      }}
                    />
                    <div className="text-small text-muted" style={{ fontSize: '0.65rem' }}>
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-muted text-small">
              Daily accuracy (%) • Hover for details
            </div>
          </div>
        </div>
      )}

      {/* Subject Breakdown */}
      {topicData && Object.keys(topicData).length > 0 && (
        <div className="card">
          <h2 className="card-header">Performance by Subject</h2>

          {Object.entries(topicData).map(([subject, data]) => (
            <div key={subject} className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3>{subject}</h3>
                <span className={`text-${data.accuracy >= 70 ? 'success' : data.accuracy >= 50 ? 'warning' : 'error'}`}>
                  {data.accuracy.toFixed(1)}% overall
                </span>
              </div>

              {data.chapters.map((chapter) => {
                const level = chapter.accuracy >= 70 ? 'high' :
                              chapter.accuracy >= 50 ? 'medium' : 'low';
                return (
                  <div key={chapter.chapter} className="accuracy-bar">
                    <div className="accuracy-label" style={{ minWidth: 200 }}>
                      Ch. {chapter.chapter}: {chapter.chapter_title.substring(0, 25)}
                      {chapter.chapter_title.length > 25 ? '...' : ''}
                    </div>
                    <div className="accuracy-track">
                      <div
                        className={`accuracy-fill ${level}`}
                        style={{ width: `${Math.max(chapter.accuracy, 5)}%` }}
                      >
                        {chapter.accuracy.toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-muted text-small" style={{ minWidth: 50 }}>
                      {chapter.attempts} Qs
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Weak Topics to Focus On */}
      {weakTopics.length > 0 && (
        <div className="card">
          <h2 className="card-header">🎯 Areas to Focus On</h2>
          <p className="text-muted text-small mb-4">
            These topics need the most improvement (minimum 3 attempts)
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Topic</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)' }}>Subject</th>
                <th style={{ textAlign: 'center', padding: 'var(--space-3)' }}>Accuracy</th>
                <th style={{ textAlign: 'center', padding: 'var(--space-3)' }}>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {weakTopics.map((topic, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--gray-200)',
                    background: idx % 2 === 0 ? 'var(--gray-50)' : 'white',
                  }}
                >
                  <td style={{ padding: 'var(--space-3)' }}>
                    Ch. {topic.chapter}: {topic.chapter_title}
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>{topic.subject}</td>
                  <td style={{
                    padding: 'var(--space-3)',
                    textAlign: 'center',
                    color: topic.accuracy < 0.5 ? 'var(--error)' : 'var(--warning)',
                    fontWeight: 600,
                  }}>
                    {(topic.accuracy * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                    {topic.total_attempts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6">
            <Link to="/study/setup" className="btn btn-primary">
              Practice Weak Areas
            </Link>
          </div>
        </div>
      )}

      {/* No data message */}
      {stats?.total_attempts === 0 && (
        <div className="card text-center">
          <h2>No Data Yet</h2>
          <p className="text-muted mt-2 mb-4">
            Complete some practice sessions to see your analytics!
          </p>
          <Link to="/study/setup" className="btn btn-primary btn-lg">
            Start Practicing
          </Link>
        </div>
      )}
    </div>
  );
}

export default Analytics;
