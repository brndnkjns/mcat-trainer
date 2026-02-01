#!/usr/bin/env python3
"""
Regenerate enhanced explanations for Biology questions.
The original enhanced explanations got misaligned starting from ch1_q7.
This script will regenerate proper short_reason and wrong_answer_explanations
that actually match each question.
"""

import json
import anthropic
import time
from pathlib import Path

def generate_enhanced_explanation(question: dict) -> dict:
    """Generate short_reason and wrong_answer_explanations for a single question."""

    client = anthropic.Anthropic()

    # Build the wrong options list
    correct = question['correct_answer']
    wrong_options = {k: v for k, v in question['options'].items() if k != correct}

    prompt = f"""You are an MCAT tutor. For the following question, provide:

1. A "short_reason" (1-2 sentences): A memorable tip, mnemonic, or key insight that helps students remember WHY the correct answer is correct. Make it catchy and memorable.

2. "wrong_answer_explanations": For each WRONG answer option, explain specifically why that option is incorrect. Reference the actual content of each wrong option.

QUESTION: {question['question_text']}

OPTIONS:
A. {question['options'].get('A', 'N/A')}
B. {question['options'].get('B', 'N/A')}
C. {question['options'].get('C', 'N/A')}
D. {question['options'].get('D', 'N/A')}

CORRECT ANSWER: {correct}
CORRECT OPTION TEXT: {question['options'].get(correct, 'N/A')}

WRONG OPTIONS TO EXPLAIN:
{chr(10).join([f"{k}. {v}" for k, v in wrong_options.items()])}

BOOK EXPLANATION: {question['explanation']}

Respond in this exact JSON format:
{{
    "short_reason": "Your memorable tip here that relates to the correct answer ({correct})",
    "wrong_answer_explanations": {{
        {', '.join([f'"{k}": "Why {k} is wrong - reference the actual option text"' for k in wrong_options.keys()])}
    }}
}}

IMPORTANT:
- The short_reason MUST relate to this specific question about {question['chapter_title']}
- Each wrong_answer_explanation MUST explain why THAT specific option is incorrect
- Do NOT include an explanation for the correct answer ({correct})
- Keep explanations concise but informative"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text

        # Extract JSON from response
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end > start:
            json_str = response_text[start:end]
            result = json.loads(json_str)
            return result
        else:
            print(f"  Warning: Could not parse JSON for {question['id']}")
            return None

    except Exception as e:
        print(f"  Error generating for {question['id']}: {e}")
        return None


def main():
    data_dir = Path(__file__).parent / "data"
    input_file = data_dir / "mcat_biology_questions.json"
    output_file = data_dir / "mcat_biology_questions.json"

    print(f"Reading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data['questions']
    total = len(questions)

    print(f"Regenerating enhanced explanations for {total} Biology questions...")

    for i, question in enumerate(questions):
        print(f"Processing {question['id']} ({i+1}/{total})...")

        result = generate_enhanced_explanation(question)

        if result:
            question['short_reason'] = result.get('short_reason', '')
            question['wrong_answer_explanations'] = result.get('wrong_answer_explanations', {})
            print(f"  ✓ Updated {question['id']}")
        else:
            print(f"  ✗ Failed to update {question['id']}")

        # Rate limiting
        time.sleep(0.5)

    # Save
    print(f"\nSaving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("Done!")


if __name__ == "__main__":
    main()
