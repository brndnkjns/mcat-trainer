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
                explanation TEXT NOT NULL,
                short_reason TEXT,
                wrong_answer_explanations TEXT,
                image_filename TEXT
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

        # Flashcards table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcards (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                chapter_title TEXT NOT NULL,
                term TEXT NOT NULL,
                definition TEXT NOT NULL,
                mnemonic TEXT,
                category TEXT
            )
        """)

        # Flashcard sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcard_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                total_cards INTEGER DEFAULT 0,
                correct_count INTEGER DEFAULT 0,
                subjects TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Flashcard reviews table (spaced repetition tracking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcard_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                flashcard_id TEXT NOT NULL,
                session_id INTEGER,
                correct BOOLEAN NOT NULL,
                time_taken_seconds REAL,
                reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ease_factor REAL DEFAULT 2.5,
                interval_days INTEGER DEFAULT 1,
                next_review_date DATE,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (flashcard_id) REFERENCES flashcards(id),
                FOREIGN KEY (session_id) REFERENCES flashcard_sessions(id)
            )
        """)

        # Create flashcard indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON flashcards(subject)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user ON flashcard_reviews(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_flashcard ON flashcard_reviews(flashcard_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_next ON flashcard_reviews(user_id, next_review_date)")

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
                     question_text, options, correct_answer, explanation,
                     short_reason, wrong_answer_explanations, image_filename)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    question_id,
                    subject,
                    q['chapter'],
                    q['chapter_title'],
                    q['question_number'],
                    q['question_text'],
                    json.dumps(q['options']),
                    q['correct_answer'],
                    q['explanation'],
                    q.get('short_reason', ''),
                    json.dumps(q.get('wrong_answer_explanations', {})),
                    q.get('image_filename', '')
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
            # Parse wrong_answer_explanations JSON if present
            if q.get('wrong_answer_explanations'):
                try:
                    q['wrong_answer_explanations'] = json.loads(q['wrong_answer_explanations'])
                except (json.JSONDecodeError, TypeError):
                    q['wrong_answer_explanations'] = {}
            else:
                q['wrong_answer_explanations'] = {}
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
            # Parse wrong_answer_explanations JSON if present
            if q.get('wrong_answer_explanations'):
                try:
                    q['wrong_answer_explanations'] = json.loads(q['wrong_answer_explanations'])
                except (json.JSONDecodeError, TypeError):
                    q['wrong_answer_explanations'] = {}
            else:
                q['wrong_answer_explanations'] = {}
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


def load_flashcards_from_json():
    """Load flashcards from JSON files into the database."""
    data_dir = Path(__file__).parent / "data" / "flashcards"

    if not data_dir.exists():
        print(f"Warning: Flashcards directory not found at {data_dir}")
        return

    flashcard_files = list(data_dir.glob("flashcards_*.json"))

    with get_connection() as conn:
        cursor = conn.cursor()

        total_loaded = 0
        for filepath in flashcard_files:
            if filepath.name == "flashcards_summary.json":
                continue

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                for fc in data.get("flashcards", []):
                    cursor.execute("""
                        INSERT OR REPLACE INTO flashcards
                        (id, subject, chapter, chapter_title, term, definition, mnemonic, category)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        fc['id'],
                        fc['subject'],
                        fc['chapter'],
                        fc['chapter_title'],
                        fc['term'],
                        fc['definition'],
                        fc.get('mnemonic', ''),
                        fc.get('category', 'general')
                    ))
                    total_loaded += 1

                print(f"Loaded {len(data.get('flashcards', []))} flashcards from {filepath.name}")
            except Exception as e:
                print(f"Error loading {filepath}: {e}")

        print(f"Total flashcards loaded: {total_loaded}")


# Flashcard operations
def get_flashcard_by_id(flashcard_id: str) -> Optional[Dict[str, Any]]:
    """Get a flashcard by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM flashcards WHERE id = ?", (flashcard_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_all_flashcards(subject: Optional[str] = None, chapter: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get all flashcards, optionally filtered by subject and/or chapter."""
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM flashcards WHERE 1=1"
        params = []

        if subject:
            query += " AND subject = ?"
            params.append(subject)
        if chapter:
            query += " AND chapter = ?"
            params.append(chapter)

        query += " ORDER BY subject, chapter, id"
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_flashcard_subjects() -> List[str]:
    """Get list of all flashcard subjects."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT subject FROM flashcards ORDER BY subject")
        return [row[0] for row in cursor.fetchall()]


def get_flashcard_chapters(subject: str) -> List[Dict[str, Any]]:
    """Get chapters available for a subject with flashcard counts."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT chapter, chapter_title, COUNT(*) as count
            FROM flashcards
            WHERE subject = ?
            GROUP BY chapter
            ORDER BY chapter
        """, (subject,))
        return [dict(row) for row in cursor.fetchall()]


def get_flashcard_count(subject: Optional[str] = None, chapter: Optional[int] = None) -> int:
    """Get count of flashcards."""
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT COUNT(*) FROM flashcards WHERE 1=1"
        params = []

        if subject:
            query += " AND subject = ?"
            params.append(subject)
        if chapter:
            query += " AND chapter = ?"
            params.append(chapter)

        cursor.execute(query, params)
        return cursor.fetchone()[0]


# Flashcard session operations
def create_flashcard_session(user_id: int, subjects: List[str], total_cards: int) -> int:
    """Create a new flashcard study session."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO flashcard_sessions (user_id, subjects, total_cards)
            VALUES (?, ?, ?)
        """, (user_id, json.dumps(subjects), total_cards))
        return cursor.lastrowid


def get_flashcard_session(session_id: int) -> Optional[Dict[str, Any]]:
    """Get a flashcard session by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM flashcard_sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        if row:
            s = dict(row)
            s['subjects'] = json.loads(s['subjects']) if s['subjects'] else []
            return s
        return None


def update_flashcard_session(session_id: int, correct_count: int, ended: bool = False):
    """Update flashcard session statistics."""
    with get_connection() as conn:
        cursor = conn.cursor()
        if ended:
            cursor.execute("""
                UPDATE flashcard_sessions
                SET correct_count = ?, ended_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (correct_count, session_id))
        else:
            cursor.execute("""
                UPDATE flashcard_sessions SET correct_count = ? WHERE id = ?
            """, (correct_count, session_id))


# Flashcard review operations (spaced repetition)
def record_flashcard_review(user_id: int, flashcard_id: str, session_id: int,
                            correct: bool, time_taken_seconds: float):
    """Record a flashcard review with spaced repetition calculations."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Get the last review for this flashcard to calculate new interval
        cursor.execute("""
            SELECT ease_factor, interval_days
            FROM flashcard_reviews
            WHERE user_id = ? AND flashcard_id = ?
            ORDER BY reviewed_at DESC
            LIMIT 1
        """, (user_id, flashcard_id))
        last_review = cursor.fetchone()

        if last_review:
            ease_factor = last_review['ease_factor']
            interval = last_review['interval_days']
        else:
            ease_factor = 2.5
            interval = 1

        # SM-2 algorithm for spaced repetition
        if correct:
            if interval == 1:
                interval = 6
            else:
                interval = int(interval * ease_factor)
            ease_factor = max(1.3, ease_factor + 0.1)
        else:
            interval = 1
            ease_factor = max(1.3, ease_factor - 0.2)

        # Calculate next review date
        next_review = f"DATE('now', '+{interval} days')"

        cursor.execute(f"""
            INSERT INTO flashcard_reviews
            (user_id, flashcard_id, session_id, correct, time_taken_seconds,
             ease_factor, interval_days, next_review_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, {next_review})
        """, (user_id, flashcard_id, session_id, correct, time_taken_seconds,
              ease_factor, interval))


def get_due_flashcards(user_id: int, subject: Optional[str] = None,
                       limit: int = 20) -> List[Dict[str, Any]]:
    """Get flashcards that are due for review (spaced repetition)."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # First get cards due for review
        query = """
            SELECT DISTINCT f.*, fr.next_review_date, fr.ease_factor, fr.interval_days
            FROM flashcards f
            LEFT JOIN (
                SELECT flashcard_id, next_review_date, ease_factor, interval_days,
                       ROW_NUMBER() OVER (PARTITION BY flashcard_id ORDER BY reviewed_at DESC) as rn
                FROM flashcard_reviews
                WHERE user_id = ?
            ) fr ON f.id = fr.flashcard_id AND fr.rn = 1
            WHERE (fr.next_review_date IS NULL OR fr.next_review_date <= DATE('now'))
        """
        params = [user_id]

        if subject:
            query += " AND f.subject = ?"
            params.append(subject)

        # Order: due cards first (by date), then new cards
        query += " ORDER BY fr.next_review_date IS NULL, fr.next_review_date LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_flashcard_stats(user_id: int) -> Dict[str, Any]:
    """Get flashcard statistics for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Overall stats
        cursor.execute("""
            SELECT
                COUNT(*) as total_reviews,
                SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_reviews,
                AVG(time_taken_seconds) as avg_time
            FROM flashcard_reviews
            WHERE user_id = ?
        """, (user_id,))
        overall = dict(cursor.fetchone())

        # Cards mastered (interval >= 21 days)
        cursor.execute("""
            SELECT COUNT(DISTINCT flashcard_id) as mastered
            FROM flashcard_reviews
            WHERE user_id = ? AND interval_days >= 21
        """, (user_id,))
        mastered = cursor.fetchone()['mastered']

        # Cards in learning
        cursor.execute("""
            SELECT COUNT(DISTINCT flashcard_id) as learning
            FROM flashcard_reviews
            WHERE user_id = ? AND interval_days < 21
        """, (user_id,))
        learning = cursor.fetchone()['learning']

        # Total cards available
        cursor.execute("SELECT COUNT(*) FROM flashcards")
        total_cards = cursor.fetchone()[0]

        # Cards due today
        cursor.execute("""
            SELECT COUNT(DISTINCT fr.flashcard_id) as due_count
            FROM flashcard_reviews fr
            INNER JOIN (
                SELECT flashcard_id, MAX(reviewed_at) as max_review
                FROM flashcard_reviews
                WHERE user_id = ?
                GROUP BY flashcard_id
            ) latest ON fr.flashcard_id = latest.flashcard_id
                     AND fr.reviewed_at = latest.max_review
            WHERE fr.user_id = ?
              AND fr.next_review_date <= DATE('now')
        """, (user_id, user_id))
        due_today = cursor.fetchone()['due_count']

        # New cards (never reviewed)
        cursor.execute("""
            SELECT COUNT(*) as new_cards
            FROM flashcards f
            WHERE NOT EXISTS (
                SELECT 1 FROM flashcard_reviews fr
                WHERE fr.flashcard_id = f.id AND fr.user_id = ?
            )
        """, (user_id,))
        new_cards = cursor.fetchone()['new_cards']

        # Stats by subject
        cursor.execute("""
            SELECT
                f.subject,
                COUNT(DISTINCT fr.flashcard_id) as reviewed,
                SUM(CASE WHEN fr.correct THEN 1 ELSE 0 END) as correct,
                COUNT(*) as total_reviews
            FROM flashcard_reviews fr
            JOIN flashcards f ON fr.flashcard_id = f.id
            WHERE fr.user_id = ?
            GROUP BY f.subject
        """, (user_id,))
        by_subject = {row['subject']: {
            "reviewed": row['reviewed'],
            "correct": row['correct'],
            "total_reviews": row['total_reviews'],
            "accuracy": row['correct'] / row['total_reviews'] if row['total_reviews'] > 0 else 0
        } for row in cursor.fetchall()}

        return {
            "total_reviews": overall['total_reviews'] or 0,
            "correct_reviews": overall['correct_reviews'] or 0,
            "accuracy": (overall['correct_reviews'] / overall['total_reviews'] * 100)
                        if overall['total_reviews'] else 0,
            "avg_time_seconds": overall['avg_time'] or 0,
            "total_cards": total_cards,
            "mastered": mastered,
            "learning": learning,
            "new_cards": new_cards,
            "due_today": due_today,
            "by_subject": by_subject
        }


def get_user_flashcard_sessions(user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent flashcard sessions for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM flashcard_sessions
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


if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Loading questions from JSON files...")
    load_questions_from_json()
    print("Loading flashcards from JSON files...")
    load_flashcards_from_json()
    print("Database setup complete!")
