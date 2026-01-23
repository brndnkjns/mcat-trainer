"""
MCAT Trainer API
FastAPI backend for the MCAT training application
"""

import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

import database as db
from question_selector import (
    select_next_question,
    get_weak_topics,
    get_topic_distribution
)

# Initialize FastAPI app
app = FastAPI(
    title="MCAT Trainer API",
    description="API for MCAT practice question training",
    version="1.0.0"
)

# CORS configuration
# In production, replace with your actual frontend URL
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://*.netlify.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class UserResponse(BaseModel):
    id: int
    name: str
    created_at: Optional[str] = None


class StartSessionRequest(BaseModel):
    user_id: int
    mode: str  # "mixed" or "focused"
    subjects: List[str]
    total_questions: int


class SessionResponse(BaseModel):
    id: int
    user_id: int
    mode: str
    subjects: List[str]
    total_questions: int
    correct_count: int
    started_at: Optional[str] = None
    ended_at: Optional[str] = None


class AnswerRequest(BaseModel):
    user_id: int
    question_id: str
    session_id: int
    selected_answer: str
    time_taken_seconds: float
    timed_out: bool = False


class QuestionResponse(BaseModel):
    id: str
    subject: str
    chapter: int
    chapter_title: str
    question_number: int
    question_text: str
    options: dict
    # Note: correct_answer and explanation are NOT included here
    # They're only revealed after answering


class AnswerResultResponse(BaseModel):
    correct: bool
    correct_answer: str
    explanation: str
    citation: dict
    session_progress: dict


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    print("Initializing database...")
    db.init_db()
    db.load_questions_from_json()
    print("Database ready!")


# Health check
@app.get("/")
async def root():
    return {"status": "healthy", "app": "MCAT Trainer API"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


# User endpoints
@app.get("/api/users", response_model=List[UserResponse])
async def get_users():
    """Get all users."""
    users = db.get_all_users()
    return users


@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    """Get a specific user."""
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/api/users/{user_id}/stats")
async def get_user_stats(user_id: int):
    """Get statistics for a user."""
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    stats = db.get_user_stats(user_id)
    return stats


@app.get("/api/users/{user_id}/weak-topics")
async def get_user_weak_topics(user_id: int, limit: int = 5):
    """Get weakest topics for a user."""
    return get_weak_topics(user_id, limit)


@app.get("/api/users/{user_id}/sessions")
async def get_user_sessions(user_id: int, limit: int = 20):
    """Get recent sessions for a user."""
    return db.get_user_sessions(user_id, limit)


# Subject endpoints
@app.get("/api/subjects")
async def get_subjects():
    """Get list of all available subjects."""
    subjects = db.get_subjects()
    distribution = get_topic_distribution()
    return {
        "subjects": subjects,
        "question_counts": distribution
    }


# Session endpoints
@app.post("/api/sessions")
async def create_session(request: StartSessionRequest):
    """Start a new study session."""
    session_id = db.create_session(
        user_id=request.user_id,
        mode=request.mode,
        subjects=request.subjects,
        total_questions=request.total_questions
    )
    session = db.get_session(session_id)
    return session


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: int):
    """Get session details."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/api/sessions/{session_id}/attempts")
async def get_session_attempts(session_id: int):
    """Get all attempts for a session."""
    return db.get_session_attempts(session_id)


@app.post("/api/sessions/{session_id}/end")
async def end_session(session_id: int):
    """End a session and get summary."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    attempts = db.get_session_attempts(session_id)
    correct_count = sum(1 for a in attempts if a['correct'])

    db.update_session(session_id, correct_count, ended=True)

    # Calculate summary
    by_subject = {}
    total_time = 0
    for a in attempts:
        subject = a['subject']
        if subject not in by_subject:
            by_subject[subject] = {"correct": 0, "total": 0}
        by_subject[subject]['total'] += 1
        if a['correct']:
            by_subject[subject]['correct'] += 1
        if a['time_taken_seconds']:
            total_time += a['time_taken_seconds']

    return {
        "session_id": session_id,
        "total_questions": len(attempts),
        "correct_count": correct_count,
        "accuracy": (correct_count / len(attempts) * 100) if attempts else 0,
        "avg_time_seconds": (total_time / len(attempts)) if attempts else 0,
        "by_subject": by_subject,
        "ended_at": datetime.now().isoformat()
    }


# Question endpoints
@app.get("/api/questions/next")
async def get_next_question(
    user_id: int,
    session_id: int,
    subjects: Optional[str] = None
):
    """
    Get the next question for a session.
    Uses weighted random selection biased toward weak topics.
    """
    subject_list = subjects.split(",") if subjects else None

    question = select_next_question(
        user_id=user_id,
        session_id=session_id,
        subjects=subject_list
    )

    if not question:
        raise HTTPException(
            status_code=404,
            detail="No more questions available"
        )

    # Return question without answer/explanation
    return {
        "id": question['id'],
        "subject": question['subject'],
        "chapter": question['chapter'],
        "chapter_title": question['chapter_title'],
        "question_number": question['question_number'],
        "question_text": question['question_text'],
        "options": question['options']
    }


@app.get("/api/questions/{question_id}")
async def get_question(question_id: str, include_answer: bool = False):
    """Get a specific question."""
    question = db.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if not include_answer:
        # Remove answer and explanation
        return {
            "id": question['id'],
            "subject": question['subject'],
            "chapter": question['chapter'],
            "chapter_title": question['chapter_title'],
            "question_number": question['question_number'],
            "question_text": question['question_text'],
            "options": question['options']
        }

    return question


# Answer submission
@app.post("/api/answer")
async def submit_answer(request: AnswerRequest):
    """
    Submit an answer and get result with explanation.
    """
    question = db.get_question_by_id(request.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Determine if correct
    correct = request.selected_answer == question['correct_answer']

    # Record the attempt
    db.record_attempt(
        user_id=request.user_id,
        question_id=request.question_id,
        session_id=request.session_id,
        correct=correct,
        selected_answer=request.selected_answer,
        time_taken_seconds=request.time_taken_seconds,
        timed_out=request.timed_out
    )

    # Update session stats
    session = db.get_session(request.session_id)
    attempts = db.get_session_attempts(request.session_id)
    correct_count = sum(1 for a in attempts if a['correct'])
    db.update_session(request.session_id, correct_count)

    # Build citation
    citation = {
        "source": f"Kaplan MCAT {question['subject']} Review 2026-2027",
        "chapter": question['chapter'],
        "chapter_title": question['chapter_title'],
        "question_number": question['question_number']
    }

    # Build response
    return {
        "correct": correct,
        "correct_answer": question['correct_answer'],
        "selected_answer": request.selected_answer,
        "explanation": question['explanation'],
        "citation": citation,
        "session_progress": {
            "answered": len(attempts),
            "correct": correct_count,
            "total": session['total_questions'],
            "accuracy": (correct_count / len(attempts) * 100) if attempts else 0
        }
    }


# Analytics endpoints
@app.get("/api/users/{user_id}/analytics/topics")
async def get_topic_analytics(user_id: int):
    """Get detailed topic performance analytics."""
    topic_accuracy = db.get_topic_accuracy(user_id)

    # Group by subject
    by_subject = {}
    for topic_key, data in topic_accuracy.items():
        subject = data['subject']
        if subject not in by_subject:
            by_subject[subject] = {
                "chapters": [],
                "total_correct": 0,
                "total_attempts": 0
            }
        by_subject[subject]['chapters'].append({
            "chapter": data['chapter'],
            "chapter_title": data['chapter_title'],
            "accuracy": data['accuracy'] * 100,
            "attempts": data['total']
        })
        by_subject[subject]['total_correct'] += data['correct']
        by_subject[subject]['total_attempts'] += data['total']

    # Calculate subject-level accuracy
    for subject, data in by_subject.items():
        data['accuracy'] = (
            (data['total_correct'] / data['total_attempts'] * 100)
            if data['total_attempts'] > 0 else 0
        )
        data['chapters'].sort(key=lambda x: x['chapter'])

    return by_subject


@app.get("/api/users/{user_id}/analytics/trends")
async def get_trend_analytics(user_id: int, days: int = 30):
    """Get performance trends over time."""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                DATE(answered_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct,
                AVG(time_taken_seconds) as avg_time
            FROM attempts
            WHERE user_id = ? AND answered_at >= DATE('now', ?)
            GROUP BY DATE(answered_at)
            ORDER BY date
        """, (user_id, f'-{days} days'))

        results = []
        for row in cursor.fetchall():
            results.append({
                "date": row['date'],
                "total": row['total'],
                "correct": row['correct'],
                "accuracy": (row['correct'] / row['total'] * 100) if row['total'] > 0 else 0,
                "avg_time": row['avg_time'] or 0
            })

        return results


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
