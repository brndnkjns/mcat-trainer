"""
Database module for MCAT Trainer
Uses SQLite for persistence
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# Database path - use environment variable or default
DB_PATH = os.environ.get("DATABASE_PATH", "mcat_trainer.db")


def get_db_path():
    """Get the database path, creating directory if needed."""
    db_path = Path(DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return str(db_path)


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database schema."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Questions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                chapter_title TEXT NOT NULL,
                question_number INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                options TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                explanation TEXT NOT NULL
            )
        """)

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                total_questions INTEGER DEFAULT 0,
                correct_count INTEGER DEFAULT 0,
                subjects TEXT,
                mode TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Attempts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question_id TEXT NOT NULL,
                session_id INTEGER,
                correct BOOLEAN NOT NULL,
                selected_answer TEXT,
                time_taken_seconds REAL,
                timed_out BOOLEAN DEFAULT FALSE,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # Create indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject)")

        # Create default users (Brandon and Porter)
        cursor.execute("INSERT OR IGNORE INTO users (name) VALUES (?)", ("Brandon",))
        cursor.execute("INSERT OR IGNORE INTO users (name) VALUES (?)", ("Porter",))


def load_questions_from_json():
    """Load questions from JSON files into the database."""
    data_dir = Path(__file__).parent / "data"

    subject_files = {
        "Biology": "mcat_biology_questions.json",
        "Biochemistry": "mcat_biochemistry_questions.json",
        "Behavioral Sciences": "mcat_behavioral_sciences_questions.json",
        "General Chemistry": "mcat_general_chemistry_questions.json",
        "Organic Chemistry": "mcat_organic_chemistry_questions.json",
        "Physics and Math": "mcat_physics_math_questions.json",
    }

    with get_connection() as conn:
        cursor = conn.cursor()

        for subject, filename in subject_files.items():
            filepath = data_dir / filename
            if not filepath.exists():
                print(f"Warning: {filename} not found")
                continue

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for q in data.get("questions", []):
                # Create unique ID with subject prefix
                question_id = f"{subject.lower().replace(' ', '_')}_{q['id']}"

                cursor.execute("""
                    INSERT OR REPLACE INTO questions
                    (id, subject, chapter, chapter_title, question_number,
                     question_text, options, correct_answer, explanation)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    question_id,
                    subject,
                    q['chapter'],
                    q['chapter_title'],
                    q['question_number'],
                    q['question_text'],
                    json.dumps(q['options']),
                    q['correct_answer'],
                    q['explanation']
                ))

        # Get count
        cursor.execute("SELECT COUNT(*) FROM questions")
        count = cursor.fetchone()[0]
        print(f"Loaded {count} questions into database")


# User operations
def get_all_users() -> List[Dict[str, Any]]:
    """Get all users."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, created_at FROM users ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get a user by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, created_at FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_user(name: str) -> Dict[str, Any]:
    """Create a new user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name) VALUES (?)", (name,))
        user_id = cursor.lastrowid
        return {"id": user_id, "name": name}


# Question operations
def get_question_by_id(question_id: str) -> Optional[Dict[str, Any]]:
    """Get a question by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM questions WHERE id = ?", (question_id,))
        row = cursor.fetchone()
        if row:
            q = dict(row)
            q['options'] = json.loads(q['options'])
            return q
        return None


def get_all_questions(subject: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all questions, optionally filtered by subject."""
    with get_connection() as conn:
        cursor = conn.cursor()
        if subject:
            cursor.execute("SELECT * FROM questions WHERE subject = ?", (subject,))
        else:
            cursor.execute("SELECT * FROM questions")
        questions = []
        for row in cursor.fetchall():
            q = dict(row)
            q['options'] = json.loads(q['options'])
            questions.append(q)
        return questions


def get_subjects() -> List[str]:
    """Get list of all subjects."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT subject FROM questions ORDER BY subject")
        return [row[0] for row in cursor.fetchall()]


# Session operations
def create_session(user_id: int, mode: str, subjects: List[str], total_questions: int) -> int:
    """Create a new study session."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (user_id, mode, subjects, total_questions)
            VALUES (?, ?, ?, ?)
        """, (user_id, mode, json.dumps(subjects), total_questions))
        return cursor.lastrowid


def get_session(session_id: int) -> Optional[Dict[str, Any]]:
    """Get a session by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        if row:
            s = dict(row)
            s['subjects'] = json.loads(s['subjects']) if s['subjects'] else []
            return s
        return None


def update_session(session_id: int, correct_count: int, ended: bool = False):
    """Update session statistics."""
    with get_connection() as conn:
        cursor = conn.cursor()
        if ended:
            cursor.execute("""
                UPDATE sessions
                SET correct_count = ?, ended_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (correct_count, session_id))
        else:
            cursor.execute("""
                UPDATE sessions SET correct_count = ? WHERE id = ?
            """, (correct_count, session_id))


def get_user_sessions(user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent sessions for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM sessions
            WHERE user_id = ?
            ORDER BY started_at DESC
            LIMIT ?
        """, (user_id, limit))
        sessions = []
        for row in cursor.fetchall():
            s = dict(row)
            s['subjects'] = json.loads(s['subjects']) if s['subjects'] else []
            sessions.append(s)
        return sessions


# Attempt operations
def record_attempt(user_id: int, question_id: str, session_id: int,
                   correct: bool, selected_answer: str,
                   time_taken_seconds: float, timed_out: bool = False):
    """Record a question attempt."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO attempts
            (user_id, question_id, session_id, correct, selected_answer,
             time_taken_seconds, timed_out)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, question_id, session_id, correct, selected_answer,
              time_taken_seconds, timed_out))


def get_session_attempts(session_id: int) -> List[Dict[str, Any]]:
    """Get all attempts for a session."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, q.subject, q.chapter, q.chapter_title
            FROM attempts a
            JOIN questions q ON a.question_id = q.id
            WHERE a.session_id = ?
            ORDER BY a.answered_at
        """, (session_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_topic_accuracy(user_id: int) -> Dict[str, Dict[str, Any]]:
    """Get accuracy statistics by topic for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                q.subject,
                q.chapter,
                q.chapter_title,
                SUM(CASE WHEN a.correct THEN 1 ELSE 0 END) as correct,
                COUNT(*) as total,
                JULIANDAY('now') - JULIANDAY(MAX(a.answered_at)) as days_since
            FROM attempts a
            JOIN questions q ON a.question_id = q.id
            WHERE a.user_id = ?
            GROUP BY q.subject, q.chapter
        """, (user_id,))

        results = {}
        for row in cursor.fetchall():
            key = f"{row['subject']}_{row['chapter']}"
            results[key] = {
                "subject": row['subject'],
                "chapter": row['chapter'],
                "chapter_title": row['chapter_title'],
                "correct": row['correct'],
                "total": row['total'],
                "accuracy": row['correct'] / row['total'] if row['total'] > 0 else 0,
                "days_since_last": row['days_since'] or 0
            }
        return results


def get_user_stats(user_id: int) -> Dict[str, Any]:
    """Get overall statistics for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Overall stats
        cursor.execute("""
            SELECT
                COUNT(*) as total_attempts,
                SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_attempts,
                AVG(time_taken_seconds) as avg_time
            FROM attempts WHERE user_id = ?
        """, (user_id,))
        overall = dict(cursor.fetchone())

        # Stats by subject
        cursor.execute("""
            SELECT
                q.subject,
                COUNT(*) as total,
                SUM(CASE WHEN a.correct THEN 1 ELSE 0 END) as correct
            FROM attempts a
            JOIN questions q ON a.question_id = q.id
            WHERE a.user_id = ?
            GROUP BY q.subject
        """, (user_id,))
        by_subject = {row['subject']: {
            "total": row['total'],
            "correct": row['correct'],
            "accuracy": row['correct'] / row['total'] if row['total'] > 0 else 0
        } for row in cursor.fetchall()}

        # Recent trend (last 7 days)
        cursor.execute("""
            SELECT
                DATE(answered_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct
            FROM attempts
            WHERE user_id = ? AND answered_at >= DATE('now', '-7 days')
            GROUP BY DATE(answered_at)
            ORDER BY date
        """, (user_id,))
        trend = [dict(row) for row in cursor.fetchall()]

        # Session count
        cursor.execute("""
            SELECT COUNT(*) as count FROM sessions WHERE user_id = ?
        """, (user_id,))
        session_count = cursor.fetchone()['count']

        return {
            "total_attempts": overall['total_attempts'] or 0,
            "correct_attempts": overall['correct_attempts'] or 0,
            "accuracy": (overall['correct_attempts'] / overall['total_attempts'] * 100) if overall['total_attempts'] else 0,
            "avg_time_seconds": overall['avg_time'] or 0,
            "by_subject": by_subject,
            "recent_trend": trend,
            "session_count": session_count
        }


def get_questions_asked_in_session(session_id: int) -> List[str]:
    """Get list of question IDs already asked in a session."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT question_id FROM attempts WHERE session_id = ?
        """, (session_id,))
        return [row[0] for row in cursor.fetchall()]


def get_recent_question_ids(user_id: int, limit: int = 50) -> List[str]:
    """Get recently asked question IDs for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT question_id FROM attempts
            WHERE user_id = ?
            ORDER BY answered_at DESC
            LIMIT ?
        """, (user_id, limit))
        return [row[0] for row in cursor.fetchall()]


if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Loading questions from JSON files...")
    load_questions_from_json()
    print("Database setup complete!")
