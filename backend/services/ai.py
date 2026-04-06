"""AI service — Gemini-powered code explanation, repo summarization, and Q&A."""

import os
from pathlib import Path
from google import genai
from dotenv import load_dotenv
from utils.file_utils import (
    get_file_summary_path,
    get_repo_summary_path,
    get_repo_path,
    load_json,
    save_json,
    read_file_content,
)

load_dotenv()

# Initialize Gemini client
_client = None
MODEL = "gemini-3-flash-preview"


def _get_client() -> genai.Client:
    """Lazy-initialize the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Create a .env file with your key."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def explain_file(repo_id: str, relative_path: str) -> dict:
    """
    Generate an AI explanation for a single file.
    Returns cached result if available.
    """
    # Check cache
    summary_path = get_file_summary_path(repo_id, relative_path)
    cached = load_json(summary_path)
    if cached is not None:
        return cached

    # Read file content
    repo_path = get_repo_path(repo_id)
    full_path = repo_path / relative_path
    content = read_file_content(full_path, max_chars=4000)

    if not content.strip():
        result = {
            "file": relative_path,
            "explanation": "This file is empty or could not be read.",
            "cached": False,
        }
        save_json(summary_path, result)
        return result

    # Build prompt
    prompt = f"""You are a senior software engineer. Analyze this code file and provide a clear explanation.

**File:** `{relative_path}`

**Code:**
```
{content}
```

Provide your analysis in the following format:

## Purpose
What this file does and why it exists.

## Key Logic
The main algorithms, patterns, or logic flows in this file.

## Dependencies
What this file imports, uses, or depends on.

## Summary
A one-paragraph summary a developer can quickly scan.
"""

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
        explanation = response.text
    except Exception as e:
        explanation = f"Error generating explanation: {str(e)}"

    result = {
        "file": relative_path,
        "explanation": explanation,
        "cached": False,
    }
    save_json(summary_path, result)
    return result


def summarize_repo(repo_id: str, file_summaries: list[dict]) -> dict:
    """
    Generate a high-level architecture summary from individual file summaries.
    Returns cached result if available.
    """
    summary_path = get_repo_summary_path(repo_id)
    cached = load_json(summary_path)
    if cached is not None:
        return cached

    # Build context from file summaries (limit to avoid token overflow)
    context_parts = []
    total_chars = 0
    max_context = 30000  # ~7500 tokens

    for summary in file_summaries:
        entry = f"### {summary['file']}\n{summary['explanation']}\n"
        if total_chars + len(entry) > max_context:
            break
        context_parts.append(entry)
        total_chars += len(entry)

    context = "\n".join(context_parts)

    prompt = f"""You are a senior software architect. Based on the following file-by-file summaries of a codebase, provide a comprehensive overview.

{context}

Provide your analysis in the following format:

## Architecture Overview
Describe the overall architecture, design patterns, and structure of this project.

## Technology Stack
List the main technologies, frameworks, and libraries used.

## Data Flow
Explain how data flows through the application — from input to processing to output.

## Key Components
List and briefly describe the most important modules or components.

## How to Run
Based on the files you see, provide instructions on how to set up and run this project.

## Summary
A concise 2-3 paragraph overview that a new developer could read to quickly understand this codebase.
"""

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
        summary_text = response.text
    except Exception as e:
        summary_text = f"Error generating repo summary: {str(e)}"

    result = {
        "repo_id": repo_id,
        "summary": summary_text,
        "files_analyzed": len(file_summaries),
        "cached": False,
    }
    save_json(summary_path, result)
    return result


def ask_question(repo_id: str, question: str) -> str:
    """
    Answer a question about the codebase using file summaries as context.
    """
    # Load available file summaries for context
    summaries_dir = Path(get_file_summary_path(repo_id, "")).parent
    context_parts = []
    total_chars = 0
    max_context = 20000

    if summaries_dir.exists():
        for json_file in sorted(summaries_dir.glob("*.json")):
            data = load_json(json_file)
            if data:
                entry = f"### {data.get('file', 'unknown')}\n{data.get('explanation', '')}\n"
                if total_chars + len(entry) > max_context:
                    break
                context_parts.append(entry)
                total_chars += len(entry)

    # Also load repo summary if available
    repo_summary = load_json(get_repo_summary_path(repo_id))
    repo_context = ""
    if repo_summary:
        repo_context = f"\n## Overall Architecture\n{repo_summary.get('summary', '')}\n"

    context = "\n".join(context_parts)

    prompt = f"""You are a senior software engineer who has thoroughly analyzed a codebase. Use the following context about the codebase to answer the developer's question.

## Codebase Context
{context}
{repo_context}

## Developer's Question
{question}

Provide a clear, helpful, and specific answer. Reference particular files or components when relevant. If you're unsure about something, say so rather than guessing.
"""

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"Error generating answer: {str(e)}"
