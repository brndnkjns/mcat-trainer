import { useState, useEffect } from 'react';
import api from '../api';

function UserSelect({ onSelect }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  if (error) {
    return (
      <div className="container">
        <div className="card text-center">
          <h2 className="text-error">Error</h2>
          <p className="text-muted mt-4">{error}</p>
          <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="text-center mt-8 mb-8">
        <h1>MCAT Trainer</h1>
        <p className="text-muted mt-2">Adaptive practice questions to ace your MCAT</p>
      </div>

      <div className="card">
        <h2 className="text-center mb-6">Who's studying today?</h2>

        <div className="flex justify-center gap-6 flex-wrap">
          {users.map(user => (
            <div
              key={user.id}
              className="user-card"
              onClick={() => onSelect(user)}
            >
              <div className="user-avatar">
                {user.name[0]}
              </div>
              <div className="user-name">{user.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-6 text-muted text-small">
        <p>1,080 practice questions from Kaplan MCAT Review 2026-2027</p>
        <p className="mt-2">Biology • Biochemistry • Behavioral Sciences • Chemistry • Physics</p>
      </div>
    </div>
  );
}

export default UserSelect;
