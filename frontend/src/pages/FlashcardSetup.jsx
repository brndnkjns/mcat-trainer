import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

function FlashcardSetup({ user }) {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [cardCount, setCardCount] = useState(20);
  const [mode, setMode] = useState('due'); // 'due', 'new', or 'all'
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getFlashcardSubjects(),
      api.getUserFlashcardStats(user.id),
    ])
      .then(([subjectsData, statsData]) => {
        setSubjects(subjectsData);
        setStats(statsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  const selectedSubjectData = subjects.find(s => s.subject === selectedSubject);

  const handleChapterToggle = (chapter) => {
    if (selectedChapters.includes(chapter)) {
      setSelectedChapters(selectedChapters.filter(c => c !== chapter));
    } else {
      setSelectedChapters([...selectedChapters, chapter]);
    }
  };

  const handleSelectAllChapters = () => {
    if (selectedSubjectData) {
      setSelectedChapters(selectedSubjectData.chapters.map(c => c.chapter));
    }
  };

  const handleClearChapters = () => {
    setSelectedChapters([]);
  };

  const startSession = async () => {
    setStarting(true);
    try {
      const session = await api.createFlashcardSession({
        user_id: user.id,
        subjects: selectedSubject ? [selectedSubject] : subjects.map(s => s.subject),
        total_cards: cardCount,
      });
      navigate(`/flashcards/session/${session.id}`, {
        state: {
          mode,
          subject: selectedSubject,
          chapters: selectedChapters.length > 0 ? selectedChapters : null,
        },
      });
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start flashcard session');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="mb-6">
        <Link to="/dashboard" className="btn btn-secondary mb-4">
          ← Back to Dashboard
        </Link>
        <h1>Flashcard Study</h1>
        <p className="text-muted">Review terms and definitions with spaced repetition.</p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="card">
          <h2 className="card-header">Your Flashcard Progress</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.due_today || 0}</div>
              <div className="stat-label">Due Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.new_cards || 0}</div>
              <div className="stat-label">New Cards</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.learning || 0}</div>
              <div className="stat-label">In Learning</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.mastered || 0}</div>
              <div className="stat-label">Mastered</div>
            </div>
          </div>
        </div>
      )}

      {/* Study Mode */}
      <div className="card">
        <h2 className="card-header">Study Mode</h2>
        <div className="flex gap-4 flex-wrap">
          <button
            className={`btn ${mode === 'due' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('due')}
          >
            📅 Due for Review ({stats?.due_today || 0})
          </button>
          <button
            className={`btn ${mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('new')}
          >
            ✨ New Cards
          </button>
          <button
            className={`btn ${mode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('all')}
          >
            📚 All Cards
          </button>
        </div>
        <p className="text-muted text-small mt-4">
          {mode === 'due' && 'Review cards that are due based on spaced repetition schedule.'}
          {mode === 'new' && 'Learn new cards you haven\'t seen before.'}
          {mode === 'all' && 'Practice with all available cards.'}
        </p>
      </div>

      {/* Subject Selection */}
      <div className="card">
        <h2 className="card-header">Select Subject</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            className={`btn ${selectedSubject === '' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setSelectedSubject('');
              setSelectedChapters([]);
            }}
          >
            All Subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s.subject}
              className={`btn ${selectedSubject === s.subject ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setSelectedSubject(s.subject);
                setSelectedChapters([]);
              }}
            >
              {s.subject} ({s.total_cards})
            </button>
          ))}
        </div>
      </div>

      {/* Chapter Selection (if subject selected) */}
      {selectedSubject && selectedSubjectData && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-header" style={{ margin: 0 }}>Select Chapters</h2>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={handleSelectAllChapters}>
                Select All
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleClearChapters}>
                Clear
              </button>
            </div>
          </div>
          <div className="chapter-grid">
            {selectedSubjectData.chapters.map((ch) => (
              <label key={ch.chapter} className="chapter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedChapters.includes(ch.chapter)}
                  onChange={() => handleChapterToggle(ch.chapter)}
                />
                <span className="chapter-label">
                  <span className="font-medium">Ch {ch.chapter}</span>
                  <span className="text-muted text-small">{ch.chapter_title}</span>
                  <span className="text-muted text-small">{ch.count} cards</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Card Count */}
      <div className="card">
        <h2 className="card-header">Number of Cards</h2>
        <div className="flex gap-2 flex-wrap">
          {[10, 20, 30, 50, 100].map((count) => (
            <button
              key={count}
              className={`btn ${cardCount === count ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCardCount(count)}
            >
              {count} cards
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <div className="card text-center">
        <button
          className="btn btn-primary btn-lg"
          onClick={startSession}
          disabled={starting}
        >
          {starting ? (
            <>
              <span className="spinner-small"></span>
              Starting...
            </>
          ) : (
            `Start Flashcard Session (${cardCount} cards)`
          )}
        </button>
      </div>
    </div>
  );
}

export default FlashcardSetup;
