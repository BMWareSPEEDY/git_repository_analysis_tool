"""File scanner service — recursively discovers code files in a repo."""

import os
from pathlib import Path
from utils.file_utils import get_repo_path

# Supported code file extensions
SUPPORTED_EXTENSIONS = {
    # Python
    ".py",
    # JavaScript / TypeScript
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    # Web
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    # Java / Kotlin
    ".java", ".kt", ".kts",
    # C / C++
    ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
    # C#
    ".cs",
    # Go
    ".go",
    # Rust
    ".rs",
    # Ruby
    ".rb",
    # PHP
    ".php",
    # Swift
    ".swift",
    # Shell
    ".sh", ".bash", ".zsh",
    # SQL
    ".sql",
    # Dart
    ".dart",
    # Scala
    ".scala",
    # R
    ".r", ".R",
    # Lua
    ".lua",
    # Perl
    ".pl", ".pm",
    # Config / Markup
    ".json", ".yaml", ".yml", ".toml", ".xml",
    ".md", ".markdown", ".rst",
    # Docker / CI
    ".dockerfile",
}

# Also match specific filenames without extensions
SUPPORTED_FILENAMES = {
    "Dockerfile",
    "Makefile",
    "CMakeLists.txt",
    "Gemfile",
    "Rakefile",
    "Procfile",
}

# Directories to ignore
IGNORED_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    ".pycache",
    "build",
    "dist",
    ".next",
    "venv",
    ".venv",
    "env",
    ".env",
    ".idea",
    ".vscode",
    ".gradle",
    "target",
    "bin",
    "obj",
    ".tox",
    "egg-info",
    ".eggs",
    "vendor",
    "coverage",
    ".nyc_output",
    ".cache",
    ".pytest_cache",
    "site-packages",
}


def scan_files(repo_id: str) -> list[str]:
    """
    Recursively scan a cloned repo and return a sorted list of
    relative file paths for all supported code files.
    """
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise FileNotFoundError(f"Repository not found: {repo_id}")

    code_files = []

    for root, dirs, files in os.walk(repo_path):
        # Filter out ignored directories (modifying dirs in-place prunes the walk)
        dirs[:] = [
            d for d in dirs
            if d not in IGNORED_DIRS and not d.startswith(".")
        ]

        for filename in files:
            file_path = Path(root) / filename
            ext = file_path.suffix.lower()

            if ext in SUPPORTED_EXTENSIONS or filename in SUPPORTED_FILENAMES:
                relative = str(file_path.relative_to(repo_path))
                code_files.append(relative)

    return sorted(code_files)
