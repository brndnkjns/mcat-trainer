"""
Script to enhance MCAT question explanations with:
1. short_reason: Quick memory tip/trick for the correct answer
2. wrong_answer_explanations: Why each wrong answer is incorrect

This script processes all question JSON files and adds enhanced explanations.
"""

import json
import os
import time
from pathlib import Path
import anthropic

# Initialize Claude client
client = anthropic.Anthropic()

def generate_enhanced_explanation(question: dict) -> dict:
    """Generate enhanced explanation for a single question using Claude."""

    # Build the prompt
    options_text = "\n".join([f"{k}: {v}" for k, v in question['options'].items()])
    correct = question['correct_answer']
    wrong_options = [k for k in question['options'].keys() if k != correct]

    prompt = f"""You are an MCAT tutor helping students understand why answers are correct or incorrect.

Question: {question['question_text']}

Options:
{options_text}

Correct Answer: {correct}
Book Explanation: {question['explanation']}

Please provide:

1. SHORT_REASON: A brief (1-2 sentences) memory tip, trick, or key insight that helps students remember why {correct} is correct. Focus on making it memorable and useful for quick recall. Don't just restate the answer - give a helpful learning tip.

2. WRONG_ANSWER_EXPLANATIONS: For each wrong answer, explain specifically why it's incorrect in 1-2 sentences.

Format your response EXACTLY like this:
SHORT_REASON: [your tip here]

WRONG_A: [why A is wrong, if A is wrong]
WRONG_B: [why B is wrong, if B is wrong]
WRONG_C: [why C is wrong, if C is wrong]
WRONG_D: [why D is wrong, if D is wrong]

Only include WRONG_X entries for the incorrect options (skip the correct answer)."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        response_text = message.content[0].text

        # Parse the response
        enhanced = {
            "short_reason": "",
            "wrong_answer_explanations": {}
        }

        lines = response_text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith("SHORT_REASON:"):
                enhanced["short_reason"] = line.replace("SHORT_REASON:", "").strip()
            elif line.startswith("WRONG_A:"):
                enhanced["wrong_answer_explanations"]["A"] = line.replace("WRONG_A:", "").strip()
            elif line.startswith("WRONG_B:"):
                enhanced["wrong_answer_explanations"]["B"] = line.replace("WRONG_B:", "").strip()
            elif line.startswith("WRONG_C:"):
                enhanced["wrong_answer_explanations"]["C"] = line.replace("WRONG_C:", "").strip()
            elif line.startswith("WRONG_D:"):
                enhanced["wrong_answer_explanations"]["D"] = line.replace("WRONG_D:", "").strip()

        return enhanced

    except Exception as e:
        print(f"Error generating explanation: {e}")
        return None


def process_question_file(filepath: Path) -> bool:
    """Process a single question file and add enhanced explanations."""

    print(f"\nProcessing: {filepath.name}")

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])
    total = len(questions)

    for i, question in enumerate(questions):
        # Skip if already enhanced
        if 'short_reason' in question and question['short_reason']:
            print(f"  [{i+1}/{total}] Already enhanced, skipping...")
            continue

        print(f"  [{i+1}/{total}] Enhancing question {question['id']}...")

        enhanced = generate_enhanced_explanation(question)

        if enhanced:
            question['short_reason'] = enhanced['short_reason']
            question['wrong_answer_explanations'] = enhanced['wrong_answer_explanations']

            # Save after each question (in case of interruption)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        else:
            print(f"    Failed to enhance question {question['id']}")

        # Rate limiting - be gentle on the API
        time.sleep(0.5)

    print(f"  Completed {filepath.name}")
    return True


def main():
    """Process all question files."""

    data_dir = Path(__file__).parent / "data"

    question_files = [
        "mcat_biology_questions.json",
        "mcat_biochemistry_questions.json",
        "mcat_behavioral_sciences_questions.json",
        "mcat_general_chemistry_questions.json",
        "mcat_organic_chemistry_questions.json",
        "mcat_physics_math_questions.json",
    ]

    print("=" * 60)
    print("MCAT Question Explanation Enhancer")
    print("=" * 60)
    print(f"Processing {len(question_files)} files with 180 questions each")
    print("Total: 1,080 questions to enhance")
    print("=" * 60)

    for filename in question_files:
        filepath = data_dir / filename
        if filepath.exists():
            process_question_file(filepath)
        else:
            print(f"Warning: {filename} not found")

    print("\n" + "=" * 60)
    print("Enhancement complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
