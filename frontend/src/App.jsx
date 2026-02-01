import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserSelect from './pages/UserSelect';
import Dashboard from './pages/Dashboard';
import SessionSetup from './pages/SessionSetup';
import StudySession from './pages/StudySession';
import SessionSummary from './pages/SessionSummary';
import Analytics from './pages/Analytics';
import FlashcardSetup from './pages/FlashcardSetup';
import FlashcardSession from './pages/FlashcardSession';
import FlashcardSummary from './pages/FlashcardSummary';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('mcatUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('mcatUser');
      }
    }
  }, []);

  const handleUserSelect = (user) => {
    setCurrentUser(user);
    localStorage.setItem('mcatUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('mcatUser');
  };

  return (
    <BrowserRouter>
      {currentUser && (
        <nav className="nav">
          <div className="nav-content">
            <a href="/" className="nav-brand">Porter's MCAT Trainer</a>
            <div className="nav-user">
              <span className="text-muted text-small">Studying as</span>
              <div className="nav-avatar">{currentUser.name[0]}</div>
              <span>{currentUser.name}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>
                Switch User
              </button>
            </div>
          </div>
        </nav>
      )}

      <Routes>
        <Route
          path="/"
          element={
            currentUser ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <UserSelect onSelect={handleUserSelect} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            currentUser ? (
              <Dashboard user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/study/setup"
          element={
            currentUser ? (
              <SessionSetup user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/study/session/:sessionId"
          element={
            currentUser ? (
              <StudySession user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/study/summary/:sessionId"
          element={
            currentUser ? (
              <SessionSummary user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/analytics"
          element={
            currentUser ? (
              <Analytics user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/flashcards/setup"
          element={
            currentUser ? (
              <FlashcardSetup user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/flashcards/session/:sessionId"
          element={
            currentUser ? (
              <FlashcardSession user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/flashcards/summary/:sessionId"
          element={
            currentUser ? (
              <FlashcardSummary user={currentUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
