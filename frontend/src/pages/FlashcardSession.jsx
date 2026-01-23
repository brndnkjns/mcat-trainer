import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

function FlashcardSession({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, subject, chapters } = location.state || {};

  const [session, setSession] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Load session and cards
  useEffect(() => {
    const loadData = async () => {
      try {
        const sessionData = await api.getFlashcardSession(sessionId);
        setSession(sessionData);

        // Get cards based on mode
        let cardsData;
        if (mode === 'due') {
          cardsData = await api.getDueFlashcards(user.id, subject, sessionData.total_cards);
          setCards(cardsData.flashcards || []);
        } else {
          cardsData = await api.getFlashcards(subject, chapters?.[0], sessionData.total_cards, 0);
          // Shuffle the cards
          const shuffled = [...(cardsData.flashcards || [])].sort(() => Math.random() - 0.5);
          setCards(shuffled);
        }

        setStartTime(Date.now());
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId, user.id, mode, subject, chapters]);

  const currentCard = cards[currentIndex];
  const isLastCard = currentIndex === cards.length - 1;
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleResponse = async (correct) => {
    const timeTaken = startTime ? (Date.now() - startTime) / 1000 : 0;

    // Submit review
    try {
      await api.submitFlashcardReview({
        user_id: user.id,
        flashcard_id: currentCard.id,
        session_id: parseInt(sessionId),
        correct,
        time_taken_seconds: timeTaken,
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
    }

    if (correct) {
      setCorrectCount((prev) => prev + 1);
    }
    setReviewedCount((prev) => prev + 1);

    // Move to next card or end session
    if (isLastCard) {
      await endSession();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
      setShowMnemonic(false);
      setStartTime(Date.now());
    }
  };

  const endSession = async () => {
    try {
      await api.endFlashcardSession(sessionId);
      navigate(`/flashcards/summary/${sessionId}`, {
        state: { correctCount, reviewedCount: reviewedCount + 1 },
      });
    } catch (error) {
      console.error('Failed to end session:', error);
      navigate('/dashboard');
    }
  };

  const handleKeyPress = useCallback(
    (e) => {
      if (!currentCard) return;

      if (!showAnswer) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleReveal();
        }
      } else {
        if (e.key === '1' || e.key === 'h') {
          // Hard / Didn't know
          handleResponse(false);
        } else if (e.key === '2' || e.key === 'e') {
          // Easy / Knew it
          handleResponse(true);
        } else if (e.key === 'm') {
          setShowMnemonic((prev) => !prev);
        }
      }
    },
    [showAnswer, currentCard]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

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

  if (cards.length === 0) {
    return (
      <div className="container">
        <div className="card text-center">
          <h2>No Cards Available</h2>
          <p className="text-muted mt-2 mb-4">
            {mode === 'due'
              ? "Great job! You have no cards due for review right now."
              : "No flashcards found for your selection."}
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/flashcards/setup')}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container flashcard-container">
      {/* Progress Bar */}
      <div className="flashcard-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-text">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span className="text-muted">
            {correctCount} / {reviewedCount} correct
          </span>
        </div>
      </div>

      {/* Subject/Chapter Info */}
      <div className="flashcard-meta">
        <span className="badge">{currentCard.subject}</span>
        <span className="text-muted">Chapter {currentCard.chapter}: {currentCard.chapter_title}</span>
      </div>

      {/* Flashcard */}
      <div className={`flashcard ${showAnswer ? 'flipped' : ''}`}>
        <div className="flashcard-inner">
          {/* Front: Definition */}
          <div className="flashcard-front">
            <div className="flashcard-label">Definition</div>
            <div className="flashcard-content">
              <p className="flashcard-text">{currentCard.definition}</p>
            </div>
            <div className="flashcard-hint">
              <span className="text-muted text-small">What is the term?</span>
            </div>
          </div>

          {/* Back: Term + Mnemonic */}
          <div className="flashcard-back">
            <div className="flashcard-label">Term</div>
            <div className="flashcard-content">
              <h2 className="flashcard-term">{currentCard.term}</h2>
              {currentCard.category && (
                <span className="badge badge-secondary">{currentCard.category}</span>
              )}
            </div>

            {/* Mnemonic toggle */}
            {currentCard.mnemonic && (
              <div className="flashcard-mnemonic">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMnemonic(!showMnemonic)}
                >
                  {showMnemonic ? 'Hide' : 'Show'} Mnemonic (M)
                </button>
                {showMnemonic && (
                  <div className="mnemonic-content">
                    <span className="mnemonic-icon">💡</span>
                    {currentCard.mnemonic}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flashcard-actions">
        {!showAnswer ? (
          <button className="btn btn-primary btn-lg" onClick={handleReveal}>
            Show Answer (Space)
          </button>
        ) : (
          <div className="response-buttons">
            <button
              className="btn btn-response btn-hard"
              onClick={() => handleResponse(false)}
            >
              <span className="response-icon">❌</span>
              <span>Didn't Know</span>
              <span className="response-key">(1 or H)</span>
            </button>
            <button
              className="btn btn-response btn-easy"
              onClick={() => handleResponse(true)}
            >
              <span className="response-icon">✅</span>
              <span>Knew It</span>
              <span className="response-key">(2 or E)</span>
            </button>
          </div>
        )}
      </div>

      {/* End Session Button */}
      <div className="text-center mt-6">
        <button className="btn btn-secondary" onClick={endSession}>
          End Session Early
        </button>
      </div>
    </div>
  );
}

export default FlashcardSession;
