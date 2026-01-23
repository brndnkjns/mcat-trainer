import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';

function SessionSummary({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.endSession(sessionId),
      api.getSessionAttempts(sessionId),
    ])
      .then(([summaryData, attemptsData]) => {
        setSummary(summaryData);
        setAttempts(attemptsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Calculating results...</p>
        </div>
      </div>
    );
  }

  const getPerformanceMessage = (accuracy) => {
    if (accuracy >= 90) return { emoji: '🌟', message: 'Outstanding!' };
    if (accuracy >= 80) return { emoji: '🎉', message: 'Excellent work!' };
    if (accuracy >= 70) return { emoji: '👍', message: 'Good job!' };
    if (accuracy >= 60) return { emoji: '💪', message: 'Keep practicing!' };
    return { emoji: '📚', message: 'More review needed' };
  };

  const performance = getPerformanceMessage(summary?.accuracy || 0);

  return (
    <div className="container">
      {/* Header */}
      <div className="card text-center">
        <div style={{ fontSize: '4rem' }}>{performance.emoji}</div>
        <h1 className="mt-4">{performance.message}</h1>
        <p className="text-muted mt-2">Session Complete</p>
      </div>

      {/* Score Summary */}
      <div className="card">
        <h2 className="card-header">Your Results</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">
              {summary?.correct_count}/{summary?.total_questions}
            </div>
            <div className="stat-label">Correct Answers</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{
              color: summary?.accuracy >= 70 ? 'var(--success)' :
                     summary?.accuracy >= 50 ? 'var(--warning)' : 'var(--error)'
            }}>
              {(summary?.accuracy || 0).toFixed(1)}%
            </div>
            <div className="stat-label">Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {Math.round(summary?.avg_time_seconds || 0)}s
            </div>
            <div className="stat-label">Avg Time/Question</div>
          </div>
        </div>
      </div>

      {/* Performance by Subject */}
      {summary?.by_subject && Object.keys(summary.by_subject).length > 0 && (
        <div className="card">
          <h2 className="card-header">Performance by Subject</h2>
          {Object.entries(summary.by_subject).map(([subject, data]) => {
            const accuracy = data.total > 0
              ? ((data.correct / data.total) * 100).toFixed(0)
              : 0;
            const level = accuracy >= 70 ? 'high' : accuracy >= 50 ? 'medium' : 'low';
            return (
              <div key={subject} className="accuracy-bar">
                <div className="accuracy-label">{subject}</div>
                <div className="accuracy-track">
                  <div
                    className={`accuracy-fill ${level}`}
                    style={{ width: `${Math.max(accuracy, 5)}%` }}
                  >
                    {data.correct}/{data.total}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Question Review */}
      <div className="card">
        <h2 className="card-header">Question Review</h2>
        <div className="text-muted text-small mb-4">
          {attempts.filter(a => !a.correct).length} incorrect answers to review
        </div>

        {attempts.map((attempt, idx) => (
          <div
            key={attempt.id}
            className="p-4 mb-2"
            style={{
              background: attempt.correct ? 'var(--success-light)' : 'var(--error-light)',
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${attempt.correct ? 'var(--success)' : 'var(--error)'}`,
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-small text-muted">
                  Q{idx + 1} • {attempt.subject} • Ch. {attempt.chapter}
                </div>
                <div className="mt-1">
                  {attempt.correct ? '✓ Correct' : `✗ Incorrect (answered ${attempt.selected_answer || 'timeout'})`}
                </div>
              </div>
              <div className="text-small text-muted">
                {attempt.time_taken_seconds ? `${Math.round(attempt.time_taken_seconds)}s` : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="card">
        <div className="flex gap-4 flex-wrap">
          <Link to="/study/setup" className="btn btn-primary btn-lg" style={{ flex: 1 }}>
            Start New Session
          </Link>
          <Link to="/analytics" className="btn btn-secondary btn-lg">
            View Analytics
          </Link>
          <Link to="/dashboard" className="btn btn-secondary btn-lg">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SessionSummary;
