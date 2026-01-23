"""
Question Selection Algorithm for MCAT Trainer

Implements weakness-biased weighted random selection with:
- Topic accuracy weighting (weak topics get higher priority)
- Recency boost (topics not seen recently get priority)
- Anti-repeat logic (no same question in session)
"""

import random
from typing import List, Dict, Optional, Set
from database import (
    get_all_questions,
    get_topic_accuracy,
    get_questions_asked_in_session,
    get_recent_question_ids
)


def calculate_topic_weights(user_id: int) -> Dict[str, float]:
    """
    Calculate selection weights for each topic based on user performance.

    Lower accuracy = higher weight (more likely to be selected)
    Topics not seen recently get a boost.

    Returns:
        Dict mapping topic_key (subject_chapter) to weight (0.1 to 2.0)
    """
    topic_accuracy = get_topic_accuracy(user_id)
    weights = {}

    for topic_key, stats in topic_accuracy.items():
        if stats['total'] == 0:
            # Never attempted: medium-high priority
            base_weight = 0.7
        else:
            # Inverse of accuracy
            # 0% accuracy → weight 1.0
            # 50% accuracy → weight 0.5
            # 100% accuracy → weight 0.1
            accuracy = stats['accuracy']
            base_weight = max(0.1, 1.0 - (accuracy * 0.9))

        # Recency boost: topics not seen in a while get priority
        days_since = stats.get('days_since_last', 30) or 30
        recency_multiplier = 1 + min(0.5, days_since / 28)  # Max 50% boost after 4 weeks

        weights[topic_key] = base_weight * recency_multiplier

    return weights


def get_default_topic_weights(subjects: List[str]) -> Dict[str, float]:
    """
    Generate default weights for topics when user has no history.
    All topics get equal weight.
    """
    # We'll generate weights dynamically as we encounter questions
    return {}


def select_next_question(
    user_id: int,
    session_id: int,
    subjects: Optional[List[str]] = None,
    exclude_ids: Optional[Set[str]] = None
) -> Optional[Dict]:
    """
    Select the next question using weakness-biased weighted random selection.

    Args:
        user_id: Current user ID
        session_id: Current session ID
        subjects: Optional list of subjects to include (None = all)
        exclude_ids: Additional question IDs to exclude

    Returns:
        Selected question dict or None if no questions available
    """
    # Get questions already asked in this session
    session_questions = set(get_questions_asked_in_session(session_id))

    # Get recently asked questions (for mild deprioritization)
    recent_questions = set(get_recent_question_ids(user_id, limit=100))

    # Combine exclusions
    all_excluded = session_questions | (exclude_ids or set())

    # Get user's topic weights
    topic_weights = calculate_topic_weights(user_id)

    # Get all candidate questions
    all_questions = get_all_questions()

    # Filter by subject if specified
    if subjects:
        all_questions = [q for q in all_questions if q['subject'] in subjects]

    # Remove excluded questions
    candidates = [q for q in all_questions if q['id'] not in all_excluded]

    if not candidates:
        return None

    # Assign weights to each candidate
    weighted_candidates = []
    for q in candidates:
        topic_key = f"{q['subject']}_{q['chapter']}"

        # Get base weight from topic accuracy (default 0.5 for new topics)
        base_weight = topic_weights.get(topic_key, 0.5)

        # Slight penalty for recently asked questions (but not in this session)
        if q['id'] in recent_questions:
            base_weight *= 0.7

        weighted_candidates.append((q, base_weight))

    # Weighted random selection
    total_weight = sum(w for _, w in weighted_candidates)
    if total_weight == 0:
        # Fallback to uniform random
        return random.choice(candidates)

    r = random.uniform(0, total_weight)
    cumulative = 0
    for question, weight in weighted_candidates:
        cumulative += weight
        if r <= cumulative:
            return question

    # Fallback (shouldn't reach here)
    return weighted_candidates[-1][0]


def get_weak_topics(user_id: int, limit: int = 5) -> List[Dict]:
    """
    Get the weakest topics for a user (for review suggestions).

    Returns:
        List of topic dicts sorted by accuracy (lowest first)
    """
    topic_accuracy = get_topic_accuracy(user_id)

    # Only include topics with at least 3 attempts
    topics = [
        {
            "subject": v['subject'],
            "chapter": v['chapter'],
            "chapter_title": v['chapter_title'],
            "accuracy": v['accuracy'],
            "total_attempts": v['total']
        }
        for v in topic_accuracy.values()
        if v['total'] >= 3
    ]

    # Sort by accuracy (ascending)
    topics.sort(key=lambda x: x['accuracy'])

    return topics[:limit]


def get_topic_distribution(subjects: Optional[List[str]] = None) -> Dict[str, int]:
    """
    Get the number of questions available per subject.
    """
    all_questions = get_all_questions()

    if subjects:
        all_questions = [q for q in all_questions if q['subject'] in subjects]

    distribution = {}
    for q in all_questions:
        subject = q['subject']
        distribution[subject] = distribution.get(subject, 0) + 1

    return distribution
