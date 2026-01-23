# MCAT Trainer - Architecture Document

## Overview

The MCAT Trainer is a web-based study application that serves practice questions from Kaplan MCAT Review books, tracks user performance, and adaptively focuses on weak areas.

## Technology Stack

| Layer | Technology | Hosting | Cost |
|-------|------------|---------|------|
| Frontend | React + Vite | Netlify | Free |
| Backend | Python + FastAPI | Railway | Free tier |
| Database | SQLite | Railway (persistent volume) | Included |
| Data | JSON question banks | Bundled with backend | N/A |

### Why This Stack?
- **React + Vite**: Fast, modern frontend with excellent timer/UX support
- **FastAPI**: Simple Python backend, easy to modify, great performance
- **SQLite**: No external database needed, persists on Railway's volume
- **Netlify + Railway**: Both have generous free tiers, easy deployment

---

## Data Model

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│   Users     │       │    Attempts     │       │  Questions   │
├─────────────┤       ├─────────────────┤       ├──────────────┤
│ id (PK)     │──────<│ id (PK)         │>──────│ id (PK)      │
│ name        │       │ user_id (FK)    │       │ subject      │
│ created_at  │       │ question_id(FK) │       │ chapter      │
└─────────────┘       │ correct (bool)  │       │ chapter_title│
                      │ time_taken_sec  │       │ question_num │
      ┌───────────────│ answered_at     │       │ question_text│
      │               │ session_id      │       │ options (JSON│
      │               └─────────────────┘       │ correct_ans  │
      │                                         │ explanation  │
      │               ┌─────────────────┐       └──────────────┘
      │               │    Sessions     │
      │               ├─────────────────┤
      └──────────────>│ id (PK)         │
                      │ user_id (FK)    │
                      │ started_at      │
                      │ ended_at        │
                      │ total_questions │
                      │ correct_count   │
                      │ subjects (JSON) │
                      └─────────────────┘
```

### Tables

#### `users`
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `questions`
```sql
CREATE TABLE questions (
    id TEXT PRIMARY KEY,  -- e.g., "biology_ch1_q1"
    subject TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    chapter_title TEXT NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL,  -- JSON: {"A": "...", "B": "...", ...}
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL
);
```

#### `attempts`
```sql
CREATE TABLE attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    session_id INTEGER,
    correct BOOLEAN NOT NULL,
    time_taken_seconds REAL,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

#### `sessions`
```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    total_questions INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    subjects TEXT,  -- JSON array of subjects included
    mode TEXT,  -- "mixed" or "focused"
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Question Selection Algorithm

### Overview
The algorithm balances three goals:
1. **Weakness bias**: Prioritize topics where the user struggles
2. **Coverage**: Ensure all topics get some attention
3. **No immediate repeats**: Avoid asking the same question twice in a session

### Algorithm: Weighted Random Selection

```python
def select_next_question(user_id, session_questions, subjects=None):
    """
    Select the next question using weakness-biased weighted random selection.

    Args:
        user_id: Current user
        session_questions: Questions already asked this session (to avoid repeats)
        subjects: Optional list of subjects to filter (None = all subjects)

    Returns:
        Selected question
    """

    # Step 1: Get user's performance by topic (subject + chapter)
    topic_accuracy = get_topic_accuracy(user_id)

    # Step 2: Calculate weights for each topic
    # Lower accuracy = higher weight (more likely to be selected)
    topic_weights = {}
    for topic, stats in topic_accuracy.items():
        if stats['total'] == 0:
            # Never attempted: medium-high priority (0.7)
            weight = 0.7
        else:
            # Inverse of accuracy: 0% accuracy → weight 1.0, 100% accuracy → weight 0.1
            accuracy = stats['correct'] / stats['total']
            weight = max(0.1, 1.0 - accuracy)

        # Boost weight for topics not seen recently
        days_since_last = stats.get('days_since_last', 30)
        recency_boost = min(1.0, days_since_last / 14)  # Max boost after 2 weeks
        weight *= (1 + recency_boost * 0.5)

        topic_weights[topic] = weight

    # Step 3: Get candidate questions
    candidates = get_questions(
        subjects=subjects,
        exclude_ids=session_questions
    )

    # Step 4: Assign weight to each question based on its topic
    weighted_candidates = []
    for q in candidates:
        topic = f"{q.subject}_{q.chapter}"
        weight = topic_weights.get(topic, 0.5)
        weighted_candidates.append((q, weight))

    # Step 5: Weighted random selection
    return weighted_random_choice(weighted_candidates)
```

### Topic Accuracy Calculation

```python
def get_topic_accuracy(user_id):
    """
    Calculate accuracy for each topic (subject + chapter).

    Returns:
        Dict[topic_key, {correct: int, total: int, days_since_last: int}]
    """
    query = """
        SELECT
            q.subject || '_' || q.chapter as topic,
            SUM(CASE WHEN a.correct THEN 1 ELSE 0 END) as correct,
            COUNT(*) as total,
            JULIANDAY('now') - JULIANDAY(MAX(a.answered_at)) as days_since
        FROM attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE a.user_id = ?
        GROUP BY topic
    """
    # Execute and return results
```

### Anti-Repeat Logic

1. **Session-level**: Track all question IDs asked in current session
2. **Recency penalty**: Questions asked in last 3 sessions get lower priority
3. **Mastery threshold**: Questions answered correctly 3+ times in a row can be deprioritized

---

## Timer Implementation

### Constants
```python
QUESTION_TIME_SECONDS = 95  # Standard MCAT science timing
WARNING_THRESHOLD = 30      # Yellow warning at 30 seconds
URGENT_THRESHOLD = 10       # Red warning at 10 seconds
```

### Frontend Timer Component

```jsx
function QuestionTimer({ timeLimit, onTimeUp }) {
    const [timeLeft, setTimeLeft] = useState(timeLimit);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLimit, onTimeUp]);

    // Color coding
    const getColor = () => {
        if (timeLeft <= URGENT_THRESHOLD) return 'red';
        if (timeLeft <= WARNING_THRESHOLD) return 'yellow';
        return 'green';
    };

    return (
        <div className={`timer timer-${getColor()}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
    );
}
```

### Timer States
1. **Running (green)**: > 30 seconds remaining
2. **Warning (yellow)**: 10-30 seconds remaining, subtle pulse animation
3. **Urgent (red)**: < 10 seconds, rapid pulse, audio beep option
4. **Expired**: Auto-submit as incorrect, show explanation, move to next

---

## Session Flow

### Start Session
```
User selects:
├── Number of questions (10, 20, 30, 50, or custom)
├── Mode:
│   ├── Mixed (all subjects, weakness-biased)
│   └── Focused (single subject)
└── If Focused: select subject
```

### During Session
```
For each question:
├── Display question with timer
├── User selects answer OR timer expires
├── Show result:
│   ├── If correct: Brief confirmation + citation
│   └── If wrong: Detailed explanation including:
│       ├── Why correct answer is right
│       ├── Why each wrong answer is wrong
│       ├── Tips/tricks for this topic
│       └── Source citation (book, chapter, page)
├── Record attempt
└── Next question
```

### End Session
```
Show summary:
├── Score: X/Y (Z%)
├── Time stats: avg time per question
├── By topic breakdown
├── Improvement vs. previous sessions
└── Weak areas to review
```

---

## API Endpoints

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/{id}/stats` - Get user statistics

### Questions
- `GET /api/questions/next` - Get next question (with algorithm)
- `GET /api/questions/{id}` - Get specific question

### Sessions
- `POST /api/sessions` - Start new session
- `GET /api/sessions/{id}` - Get session details
- `PUT /api/sessions/{id}` - End session
- `GET /api/users/{id}/sessions` - Get user's session history

### Attempts
- `POST /api/attempts` - Record an attempt
- `GET /api/users/{id}/attempts` - Get user's attempt history

### Analytics
- `GET /api/users/{id}/analytics/topics` - Performance by topic
- `GET /api/users/{id}/analytics/trends` - Performance over time
- `GET /api/users/{id}/analytics/predictions` - Predicted scores

---

## Citation System

Every question includes citation information:

```json
{
    "citation": {
        "source": "Kaplan MCAT Biology Review 2026-2027",
        "chapter": 1,
        "chapter_title": "The Cell",
        "question_number": 1
    }
}
```

Citations are displayed:
1. After answering (with explanation)
2. In review mode
3. In analytics (to identify which chapters need review)

---

## Deployment Architecture

```
                    ┌─────────────────┐
                    │    Internet     │
                    └────────┬────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ▼                                 ▼
    ┌───────────────┐                ┌───────────────┐
    │   Netlify     │                │   Railway     │
    │  (Frontend)   │───── API ─────>│  (Backend)    │
    │               │                │               │
    │  React App    │                │  FastAPI      │
    │  Static Files │                │  SQLite DB    │
    └───────────────┘                └───────────────┘
```

### Deployment Steps
1. **Backend (Railway)**:
   - Push backend code to GitHub
   - Connect Railway to GitHub repo
   - Railway auto-deploys on push
   - SQLite persists on Railway volume

2. **Frontend (Netlify)**:
   - Push frontend code to GitHub
   - Connect Netlify to GitHub repo
   - Set `VITE_API_URL` environment variable
   - Netlify auto-deploys on push

---

## Security Considerations

- No passwords (simple name selection as requested)
- API is public but stateless for question serving
- User data is isolated by user_id
- No sensitive data stored
- CORS configured for frontend domain only
