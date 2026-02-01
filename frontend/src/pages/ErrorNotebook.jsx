import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const ERROR_TYPES = [
  { value: 'content_gap', label: 'Content Gap' },
  { value: 'misread', label: 'Misread' },
  { value: 'careless', label: 'Careless' },
  { value: 'time_pressure', label: 'Time Pressure' },
  { value: 'guessed', label: 'Guessed' },
];

function ErrorNotebook({ user }) {
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [errorStats, setErrorStats] = useState({});
  const [leeches, setLeeches] = useState([]);
  const [dueReviews, setDueReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    loadData();
  }, [user.id, selectedFilter, selectedSubject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [missed, stats, leechData, reviews] = await Promise.all([
        api.getMissedQuestions(
          user.id,
          selectedSubject === 'all' ? null : selectedSubject,
          selectedFilter === 'all' ? null : selectedFilter
        ),
        api.getErrorStats(user.id),
        api.getLeeches(user.id),
        api.getDueReviews(user.id),
      ]);

      setMissedQuestions(missed);
      setErrorStats(stats);
      setLeeches(leechData);
      setDueReviews(reviews);

      // Extract unique subjects from missed questions
      const uniqueSubjects = [...new Set(missed.map(q => q.subject))];
      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error('Failed to load error notebook:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalMissed = () => {
    return Object.values(errorStats).reduce((sum, count) => sum + count, 0);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading your error notebook...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="mb-6">
        <Link to="/dashboard" className="text-muted text-small">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-2">📓 Error Notebook</h1>
        <p className="text-muted">
          Review your mistakes to turn them into strengths
        </p>
      </div>

      {/* Due Reviews Alert */}
      {dueReviews.length > 0 && (
        <div className="card due-reviews-card mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h3>🔔 Questions Due for Review</h3>
              <p className="text-muted mt-1">
                You have <span className="due-reviews-count">{dueReviews.length}</span> questions
                scheduled for review today
              </p>
            </div>
            <Link to="/study/setup" className="btn btn-primary">
              Start Review Session
            </Link>
          </div>
        </div>
      )}

      {/* Leeches Section */}
      {leeches.length > 0 && (
        <div className="card mb-4">
          <h2 className="card-header">
            🩹 Leeches ({leeches.length})
          </h2>
          <p className="text-muted text-small mb-4">
            Questions you've missed 3+ times. These need extra attention.
          </p>
          <div className="flex flex-wrap gap-2">
            {leeches.slice(0, 5).map((leech) => (
              <div key={leech.id} className="missed-question-tag">
                <span className="leech-badge">
                  ❌ {leech.wrong_count}x wrong
                </span>
                {' '}{leech.subject} Ch.{leech.chapter}
              </div>
            ))}
            {leeches.length > 5 && (
              <span className="text-muted text-small">
                +{leeches.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Type Stats */}
      <div className="card mb-4">
        <h2 className="card-header">Error Type Breakdown</h2>
        <div className="stats-grid">
          {ERROR_TYPES.map((type) => (
            <div
              key={type.value}
              className="stat-card"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedFilter(
                selectedFilter === type.value ? 'all' : type.value
              )}
            >
              <div className="stat-value">
                {errorStats[type.value] || 0}
              </div>
              <div className="stat-label">{type.label}</div>
              {selectedFilter === type.value && (
                <div className="text-primary text-small mt-1">✓ Filtered</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="error-notebook-header">
        <button
          className={`error-filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('all')}
        >
          All Errors
        </button>
        {ERROR_TYPES.map((type) => (
          <button
            key={type.value}
            className={`error-filter-btn ${selectedFilter === type.value ? 'active' : ''}`}
            onClick={() => setSelectedFilter(type.value)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Subject Filter */}
      {subjects.length > 1 && (
        <div className="error-notebook-header">
          <button
            className={`error-filter-btn ${selectedSubject === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedSubject('all')}
          >
            All Subjects
          </button>
          {subjects.map((subject) => (
            <button
              key={subject}
              className={`error-filter-btn ${selectedSubject === subject ? 'active' : ''}`}
              onClick={() => setSelectedSubject(subject)}
            >
              {subject}
            </button>
          ))}
        </div>
      )}

      {/* Missed Questions List */}
      <div className="mb-4">
        <h2 className="card-header">
          Missed Questions ({missedQuestions.length})
        </h2>
      </div>

      {missedQuestions.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">
            {selectedFilter !== 'all' || selectedSubject !== 'all'
              ? 'No questions match your filters'
              : "No missed questions yet. Keep practicing!"}
          </p>
        </div>
      ) : (
        missedQuestions.map((question) => (
          <div key={question.attempt_id} className="missed-question-card">
            <div className="missed-question-meta">
              <span className="missed-question-tag">{question.subject}</span>
              <span className="missed-question-tag">
                Ch. {question.chapter}: {question.chapter_title}
              </span>
              {question.error_type && (
                <span className="missed-question-tag error-type">
                  {ERROR_TYPES.find(t => t.value === question.error_type)?.label || question.error_type}
                </span>
              )}
              <span className="missed-question-tag">
                {new Date(question.answered_at).toLocaleDateString()}
              </span>
            </div>

            <p className="mb-3" style={{ lineHeight: 1.6 }}>
              {question.question_text.length > 200
                ? question.question_text.substring(0, 200) + '...'
                : question.question_text}
            </p>

            <div className="flex gap-3 text-small">
              <span>
                Your answer: <strong className="text-error">{question.selected_answer}</strong>
              </span>
              <span>
                Correct: <strong className="text-success">{question.correct_answer}</strong>
              </span>
              <span className="text-muted">
                Time: {Math.round(question.time_taken_seconds)}s
              </span>
            </div>

            {question.short_reason && (
              <div className="memory-tip mt-3">
                <strong>💡 Remember:</strong> {question.short_reason}
              </div>
            )}
          </div>
        ))
      )}

      {/* Load More */}
      {missedQuestions.length >= 50 && (
        <div className="text-center mt-4">
          <button className="btn btn-secondary">
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

export default ErrorNotebook;
