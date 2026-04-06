"""Utility functions for file I/O, hashing, and path management."""

import hashlib
import json
import os
from pathlib import Path

# Base data directory (relative to project root)
BASE_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
REPOS_DIR = BASE_DATA_DIR / "repos"
SUMMARIES_DIR = BASE_DATA_DIR / "summaries"
REPO_SUMMARIES_DIR = BASE_DATA_DIR / "repo_summaries"


def ensure_dirs():
    """Create all required data directories if they don't exist."""
    for d in [REPOS_DIR, SUMMARIES_DIR, REPO_SUMMARIES_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def repo_id_from_url(url: str) -> str:
    """Generate a deterministic repo_id from the URL using SHA-256."""
    normalized = url.strip().rstrip("/").lower()
    return "repo_" + hashlib.sha256(normalized.encode()).hexdigest()[:12]


def file_path_hash(file_path: str) -> str:
    """Hash a relative file path for use as a filename."""
    return hashlib.sha256(file_path.encode()).hexdigest()[:16]


def read_file_content(file_path: str | Path, max_chars: int = 4000) -> str:
    """Read file content up to max_chars. Returns empty string on failure."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read(max_chars)
    except Exception:
        return ""


def save_json(path: Path, data: dict):
    """Write a dict to a JSON file, creating parent dirs."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_json(path: Path) -> dict | None:
    """Load JSON from file. Returns None if not found."""
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def get_file_summary_path(repo_id: str, relative_file_path: str) -> Path:
    """Get the path where a file's summary JSON should be stored."""
    hashed = file_path_hash(relative_file_path)
    return SUMMARIES_DIR / repo_id / f"{hashed}.json"


def get_repo_summary_path(repo_id: str) -> Path:
    """Get the path where a repo's overall summary JSON should be stored."""
    return REPO_SUMMARIES_DIR / f"{repo_id}.json"


def get_repo_path(repo_id: str) -> Path:
    """Get the path to a cloned repo."""
    return REPOS_DIR / repo_id
