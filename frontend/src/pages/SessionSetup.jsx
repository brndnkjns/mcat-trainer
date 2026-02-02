import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const QUESTION_PRESETS = [10, 20, 30, 50];

function SessionSetup({ user }) {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Form state
  const [mode, setMode] = useState('mixed'); // 'mixed' or 'focused'
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [customCount, setCustomCount] = useState('');

  useEffect(() => {
    api.getSubjects()
      .then(data => {
        setSubjects(data.subjects);
        setQuestionCounts(data.question_counts);
        setSelectedSubjects(data.subjects); // All selected by default
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSubject = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  const handleStart = async () => {
    const finalCount = customCount ? parseInt(customCount, 10) : questionCount;

    if (finalCount < 1 || finalCount > 100) {
      alert('Please select between 1 and 100 questions');
      return;
    }

    const subjectsToUse = mode === 'mixed' ? subjects : selectedSubjects;

    if (subjectsToUse.length === 0) {
      alert('Please select at least one subject');
      return;
    }

    setStarting(true);

    try {
      const session = await api.createSession({
        user_id: user.id,
        mode,
        subjects: subjectsToUse,
        total_questions: finalCount,
      });

      navigate(`/study/session/${session.id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to start session. Please try again.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  const totalAvailable = mode === 'mixed'
    ? Object.values(questionCounts).reduce((a, b) => a + b, 0)
    : selectedSubjects.reduce((sum, s) => sum + (questionCounts[s] || 0), 0);

  return (
    <div className="container">
      <div className="mb-6">
        <h1>Start Practice Session</h1>
        <p className="text-muted">Configure your study session</p>
      </div>

      {/* Mode Selection */}
      <div className="card">
        <h2 className="card-header">Study Mode</h2>

        <div className="flex gap-4">
          <button
            className={`btn ${mode === 'mixed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('mixed')}
          >
            Mixed Practice
          </button>
          <button
            className={`btn ${mode === 'focused' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('focused')}
          >
            Focus on Subject
          </button>
        </div>

        <p className="text-muted text-small mt-4">
          {mode === 'mixed'
            ? 'Questions from all subjects, weighted toward your weak areas'
            : 'Focus on specific subject(s) you want to review'}
        </p>
      </div>

      {/* Subject Selection (only for focused mode) */}
      {mode === 'focused' && (
        <div className="card">
          <h2 className="card-header">Select Subjects</h2>

          <div className="flex flex-wrap gap-2">
            {subjects.map(subject => (
              <button
                key={subject}
                className={`subject-chip ${selectedSubjects.includes(subject) ? 'selected' : ''}`}
                onClick={() => toggleSubject(subject)}
              >
                {subject} ({questionCounts[subject] || 0})
              </button>
            ))}
          </div>

          {selectedSubjects.length === 0 && (
            <p className="text-error text-small mt-4">
              Please select at least one subject
            </p>
          )}
        </div>
      )}

      {/* Question Count */}
      <div className="card">
        <h2 className="card-header">Number of Questions</h2>

        <div className="flex gap-2 flex-wrap mb-4">
          {QUESTION_PRESETS.map(count => (
            <button
              key={count}
              className={`btn ${questionCount === count && !customCount ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setQuestionCount(count);
                setCustomCount('');
              }}
            >
              {count}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-muted">Or custom:</span>
          <input
            type="number"
            className="form-input"
            style={{ width: 100 }}
            placeholder="1-100"
            min="1"
            max="100"
            value={customCount}
            onChange={(e) => setCustomCount(e.target.value)}
          />
        </div>

        <p className="text-muted text-small mt-4">
          {totalAvailable} questions available
          {mode === 'focused' && selectedSubjects.length > 0 && ` in selected subject(s)`}
        </p>
      </div>

      {/* Start Button */}
      <div className="card">
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={handleStart}
          disabled={starting || (mode === 'focused' && selectedSubjects.length === 0)}
        >
          {starting ? 'Starting...' : `Start ${customCount || questionCount} Questions`}
        </button>

        <button
          className="btn btn-secondary btn-block mt-4"
          onClick={() => navigate('/dashboard')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default SessionSetup;
