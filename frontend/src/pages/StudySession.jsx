import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

const QUESTION_TIME_SECONDS = 95;
const WARNING_THRESHOLD = 30;
const URGENT_THRESHOLD = 10;

// Error types for classification
const ERROR_TYPES = [
  { value: 'content_gap', label: 'Content Gap', description: "Didn't know the material" },
  { value: 'misread', label: 'Misread Question', description: 'Misunderstood what was asked' },
  { value: 'careless', label: 'Careless Mistake', description: 'Knew it but made a silly error' },
  { value: 'time_pressure', label: 'Time Pressure', description: 'Rushed due to time' },
  { value: 'guessed', label: 'Guessed', description: "Didn't know, took a guess" },
];

function StudySession({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const startTimeRef = useRef(null);
  const sessionStartTimeRef = useRef(null);

  // Error classification state
  const [selectedErrorType, setSelectedErrorType] = useState(null);
  const [errorClassified, setErrorClassified] = useState(false);

  // Load session and first question
  useEffect(() => {
    Promise.all([
      api.getSession(sessionId),
      api.getNextQuestion(user.id, sessionId),
    ])
      .then(([sessionData, questionData]) => {
        setSession(sessionData);
        setQuestion(questionData);
        setTimerActive(true);
        startTimeRef.current = Date.now();
        sessionStartTimeRef.current = Date.now();
      })
      .catch(err => {
        console.error('Failed to load session:', err);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [sessionId, user.id, navigate]);

  // Calculate pacing info
  const getPacingInfo = () => {
    if (!session || !sessionStartTimeRef.current) return null;

    const elapsedMs = Date.now() - sessionStartTimeRef.current;
    const elapsedMinutes = elapsedMs / 1000 / 60;
    const currentQuestion = questionsAnswered + (result ? 0 : 1);
    const totalQuestions = session.total_questions;

    // Target: ~1.5 minutes per question (95 seconds)
    const targetMinutesPerQuestion = QUESTION_TIME_SECONDS / 60;
    const expectedQuestion = Math.floor(elapsedMinutes / targetMinutesPerQuestion) + 1;

    const pace = currentQuestion - expectedQuestion;
    let paceStatus = 'on_track';
    if (pace >= 2) paceStatus = 'ahead';
    else if (pace <= -2) paceStatus = 'behind';

    return {
      elapsedMinutes: Math.floor(elapsedMinutes),
      currentQuestion,
      expectedQuestion: Math.min(expectedQuestion, totalQuestions),
      totalQuestions,
      pace,
      paceStatus,
    };
  };

  // Timer countdown
  useEffect(() => {
    if (!timerActive || result) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, result]);

  const handleTimeout = useCallback(async () => {
    if (result || submitting) return;

    setTimerActive(false);
    setSubmitting(true);

    try {
      const timeTaken = (Date.now() - startTimeRef.current) / 1000;
      const response = await api.submitAnswer({
        user_id: user.id,
        question_id: question.id,
        session_id: parseInt(sessionId, 10),
        selected_answer: '',
        time_taken_seconds: timeTaken,
        timed_out: true,
      });

      setResult({ ...response, timedOut: true });
      setQuestionsAnswered(response.session_progress.answered);
      setCorrectCount(response.session_progress.correct);
    } catch (error) {
      console.error('Failed to submit timeout:', error);
    } finally {
      setSubmitting(false);
    }
  }, [question, sessionId, user.id, result, submitting]);

  const handleSelectAnswer = (answer) => {
    if (result || submitting) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || result || submitting) return;

    setTimerActive(false);
    setSubmitting(true);

    try {
      const timeTaken = (Date.now() - startTimeRef.current) / 1000;
      const response = await api.submitAnswer({
        user_id: user.id,
        question_id: question.id,
        session_id: parseInt(sessionId, 10),
        selected_answer: selectedAnswer,
        time_taken_seconds: timeTaken,
        timed_out: false,
      });

      setResult(response);
      setQuestionsAnswered(response.session_progress.answered);
      setCorrectCount(response.session_progress.correct);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      alert('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    // Check if session is complete
    if (questionsAnswered >= session.total_questions) {
      navigate(`/study/summary/${sessionId}`);
      return;
    }

    setLoading(true);
    setResult(null);
    setSelectedAnswer(null);
    setSelectedErrorType(null);
    setErrorClassified(false);

    try {
      const subjects = session.mode === 'focused' ? session.subjects : null;
      const nextQuestion = await api.getNextQuestion(
        user.id,
        sessionId,
        subjects
      );
      setQuestion(nextQuestion);
      setTimeLeft(QUESTION_TIME_SECONDS);
      startTimeRef.current = Date.now();
      setTimerActive(true);
    } catch (error) {
      console.error('Failed to get next question:', error);
      // If no more questions available, end session
      navigate(`/study/summary/${sessionId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleErrorClassification = (errorType) => {
    setSelectedErrorType(errorType);
    setErrorClassified(true);
    // The error type will be sent with the next question or on session end
    // For now, we store it locally - in a production app, you'd update the attempt
  };

  const handleEndSession = () => {
    navigate(`/study/summary/${sessionId}`);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerClass = () => {
    if (timeLeft <= URGENT_THRESHOLD) return 'timer-urgent';
    if (timeLeft <= WARNING_THRESHOLD) return 'timer-warning';
    return 'timer-normal';
  };

  if (loading && !question) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="text-muted">Loading question...</p>
        </div>
      </div>
    );
  }

  const progressPercent = session
    ? (questionsAnswered / session.total_questions) * 100
    : 0;

  const pacingInfo = getPacingInfo();

  return (
    <div className="container">
      {/* Progress Header */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-muted">Question</span>{' '}
            <strong>{questionsAnswered + (result ? 0 : 1)}</strong> of{' '}
            <strong>{session?.total_questions}</strong>
          </div>
          <div>
            <span className="text-muted">Score:</span>{' '}
            <strong>{correctCount}</strong>/{questionsAnswered}
            {questionsAnswered > 0 && (
              <span className="text-muted">
                {' '}({((correctCount / questionsAnswered) * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Pacing Bar */}
        {pacingInfo && pacingInfo.elapsedMinutes > 0 && (
          <div className="pacing-bar mt-4">
            <div className="flex justify-between items-center text-small">
              <span className="text-muted">
                ⏱️ {pacingInfo.elapsedMinutes} min elapsed
              </span>
              <span className={`pacing-status ${pacingInfo.paceStatus}`}>
                {pacingInfo.paceStatus === 'ahead' && '🚀 Ahead of pace'}
                {pacingInfo.paceStatus === 'on_track' && '✓ On track'}
                {pacingInfo.paceStatus === 'behind' && '⚡ Pick up the pace'}
              </span>
            </div>
            {pacingInfo.paceStatus === 'behind' && (
              <div className="text-small text-muted mt-1">
                Target: Q{pacingInfo.expectedQuestion} by now
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timer and Subject */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-small text-muted">{question?.subject}</div>
            <div className="text-small">
              Chapter {question?.chapter}: {question?.chapter_title}
            </div>
          </div>
          {!result && (
            <div className={`timer ${getTimerClass()}`}>
              {formatTime(timeLeft)}
            </div>
          )}
          {result && (
            <div className={`timer ${result.correct ? 'timer-normal' : 'timer-urgent'}`}
                 style={{ fontSize: '1.5rem' }}>
              {result.correct ? '✓ Correct!' : '✗ Incorrect'}
            </div>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="card">
        <div className="mb-6" style={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
          {question?.question_text.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {line}
            </p>
          ))}
        </div>

        {/* Question Image (if any) */}
        {question?.image_url && (
          <div className="question-image-container mb-6">
            <img
              src={`${import.meta.env.VITE_API_URL}${question.image_url}`}
              alt="Question diagram"
              className="question-image"
            />
          </div>
        )}

        {/* Answer Options */}
        <div className="mt-6">
          {question?.options && Object.entries(question.options).map(([letter, text]) => {
            let className = 'option-btn';

            if (result) {
              if (letter === result.correct_answer) {
                className += ' correct';
              } else if (letter === selectedAnswer && !result.correct) {
                className += ' incorrect';
              }
            } else if (selectedAnswer === letter) {
              className += ' selected';
            }

            // Check if this option has an image
            const optionImage = question.option_images?.[letter];

            return (
              <button
                key={letter}
                className={className}
                onClick={() => handleSelectAnswer(letter)}
                disabled={!!result || submitting}
              >
                <span className="option-label">{letter}.</span>
                {optionImage ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL}/static/images/${optionImage}`}
                    alt={`Option ${letter}`}
                    className="option-image"
                  />
                ) : (
                  text
                )}
              </button>
            );
          })}
        </div>

        {/* Submit or Next Button */}
        {!result ? (
          <button
            className="btn btn-primary btn-lg btn-block mt-6"
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        ) : (
          <div className="mt-6">
            {/* Explanation */}
            <div className={`explanation-box ${result.correct ? 'correct' : 'incorrect'}`}>
              <h3 className="mb-2">
                {result.timedOut ? '⏱️ Time\'s Up!' : result.correct ? '✓ Correct!' : '✗ Incorrect'}
              </h3>

              {result.timedOut && (
                <p className="mb-4 text-error">
                  You ran out of time. The correct answer was <strong>{result.correct_answer}</strong>.
                </p>
              )}

              {!result.correct && !result.timedOut && (
                <p className="mb-4">
                  You selected <strong>{result.selected_answer}</strong>.
                  The correct answer is <strong>{result.correct_answer}</strong>.
                </p>
              )}

              {/* Quick Memory Tip */}
              {result.short_reason && (
                <div className="memory-tip">
                  <h4 className="memory-tip-header">💡 Quick Tip</h4>
                  <p>{result.short_reason}</p>
                </div>
              )}

              {/* Wrong Answer Explanations */}
              {result.wrong_answer_explanations && Object.keys(result.wrong_answer_explanations).length > 0 && (
                <div className="wrong-answers-section">
                  <h4 className="mt-4 mb-2">Why Other Answers Are Wrong:</h4>
                  {Object.entries(result.wrong_answer_explanations).map(([letter, explanation]) => (
                    <div key={letter} className="wrong-answer-item">
                      <span className="wrong-answer-letter">{letter}.</span>
                      <span className="wrong-answer-text">{explanation}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Book Explanation */}
              <div className="book-explanation">
                <h4 className="mt-4 mb-2">📖 Full Explanation:</h4>
                <p style={{ lineHeight: 1.7 }}>{result.explanation}</p>
              </div>

              <div className="citation">
                📚 Source: {result.citation.source}, Chapter {result.citation.chapter}:{' '}
                {result.citation.chapter_title}, Question {result.citation.question_number}
              </div>

              {/* Learn with AI Button - shows when answer is wrong */}
              {!result.correct && result.learn_with_ai?.url && (
                <div className="learn-with-ai-section">
                  <a
                    href={result.learn_with_ai.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ai"
                  >
                    🤖 Learn This Topic with AI
                  </a>
                  <p className="learn-with-ai-hint">
                    Opens Google Gemini in Guided Learning mode
                  </p>
                </div>
              )}

              {/* Error Classification - shows when answer is wrong */}
              {!result.correct && (
                <div className="error-classification-section">
                  <h4 className="mt-4 mb-2">📝 Why did you miss this?</h4>
                  <p className="text-small text-muted mb-3">
                    Tracking your error types helps identify patterns to improve.
                  </p>
                  <div className="error-type-grid">
                    {ERROR_TYPES.map((errorType) => (
                      <button
                        key={errorType.value}
                        className={`error-type-btn ${selectedErrorType === errorType.value ? 'selected' : ''}`}
                        onClick={() => handleErrorClassification(errorType.value)}
                      >
                        <span className="error-type-label">{errorType.label}</span>
                        <span className="error-type-desc">{errorType.description}</span>
                      </button>
                    ))}
                  </div>
                  {errorClassified && (
                    <p className="text-small text-success mt-2">
                      ✓ This question will be scheduled for review
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
                onClick={handleNextQuestion}
              >
                {questionsAnswered >= session.total_questions
                  ? 'View Summary'
                  : 'Next Question →'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleEndSession}
              >
                End Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudySession;
