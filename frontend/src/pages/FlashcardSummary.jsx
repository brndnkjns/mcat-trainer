import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../api';

function FlashcardSummary({ user }) {
  const { sessionId } = useParams();
  const location = useLocation();
  const { correctCount = 0, reviewedCount = 0 } = location.state || {};

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getUserFlashcardStats(user.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  const accuracy = reviewedCount > 0 ? ((correctCount / reviewedCount) * 100).toFixed(0) : 0;
  const getGrade = () => {
    if (accuracy >= 90) return { emoji: '🌟', text: 'Excellent!', class: 'text-success' };
    if (accuracy >= 70) return { emoji: '👍', text: 'Good job!', class: 'text-success' };
    if (accuracy >= 50) return { emoji: '📚', text: 'Keep practicing!', class: 'text-warning' };
    return { emoji: '💪', text: 'Don\'t give up!', class: 'text-error' };
  };
  const grade = getGrade();

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card text-center">
        <div className="mb-4">
          <span style={{ fontSize: '4rem' }}>{grade.emoji}</span>
        </div>
        <h1 className={grade.class}>{grade.text}</h1>
        <p className="text-muted">Flashcard Session Complete</p>
      </div>

      {/* Session Results */}
      <div className="card">
        <h2 className="card-header">Session Results</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{reviewedCount}</div>
            <div className="stat-label">Cards Reviewed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-success">{correctCount}</div>
            <div className="stat-label">Correct</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-error">{reviewedCount - correctCount}</div>
            <div className="stat-label">To Review Again</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{accuracy}%</div>
            <div className="stat-label">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      {stats && (
        <div className="card">
          <h2 className="card-header">Your Overall Progress</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total_cards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-success">{stats.mastered}</div>
              <div className="stat-label">Mastered</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-warning">{stats.learning}</div>
              <div className="stat-label">Learning</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.new_cards}</div>
              <div className="stat-label">New</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="progress-label">
              <span>Overall Mastery</span>
              <span>{stats.total_cards > 0 ? ((stats.mastered / stats.total_cards) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="progress-bar-lg">
              <div
                className="progress-fill-mastered"
                style={{ width: `${stats.total_cards > 0 ? (stats.mastered / stats.total_cards) * 100 : 0}%` }}
              ></div>
              <div
                className="progress-fill-learning"
                style={{
                  width: `${stats.total_cards > 0 ? (stats.learning / stats.total_cards) * 100 : 0}%`,
                  left: `${stats.total_cards > 0 ? (stats.mastered / stats.total_cards) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <div className="progress-legend mt-2">
              <span><span className="legend-dot mastered"></span> Mastered</span>
              <span><span className="legend-dot learning"></span> Learning</span>
              <span><span className="legend-dot new"></span> New</span>
            </div>
          </div>
        </div>
      )}

      {/* Next Steps */}
      <div className="card">
        <h2 className="card-header">What's Next?</h2>
        <div className="flex gap-4 flex-wrap">
          <Link to="/flashcards/setup" className="btn btn-primary btn-lg">
            Study More Flashcards
          </Link>
          <Link to="/study/setup" className="btn btn-secondary btn-lg">
            Practice Questions
          </Link>
          <Link to="/dashboard" className="btn btn-secondary btn-lg">
            Return to Dashboard
          </Link>
        </div>
      </div>

      {/* Encouragement */}
      <div className="card text-center">
        <p className="text-muted">
          {stats?.due_today > 0 ? (
            <>You have <strong>{stats.due_today}</strong> cards due for review. Keep up the momentum!</>
          ) : (
            <>Great work! Come back tomorrow for your scheduled reviews.</>
          )}
        </p>
      </div>
    </div>
  );
}

export default FlashcardSummary;
