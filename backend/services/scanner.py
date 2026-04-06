"""File scanner service — recursively discovers code files in a repo."""

import os
from pathlib import Path
from utils.file_utils import get_repo_path

# Supported code file extensions
SUPPORTED_EXTENSIONS = {
    # Main logic
    ".py", ".js", ".ts", ".java", ".c", ".cpp", ".cs", ".go", ".rs", ".kt",
    
    # Web Dev
    ".html", ".css", ".scss", ".json", ".xml", ".yaml", ".yml",
    ".jsx", ".tsx", ".vue", ".php",
    
    # Config & Environment
    ".env", ".ini", ".toml", ".cfg", ".conf",
    
    # Database & Data
    ".sql", ".db", ".sqlite", ".csv", ".parquet", ".avro",
    
    # Testing & Docs
    ".md", ".rst", ".txt", ".log", ".coverage",
    
    # DevOps exclusions/attributes
    ".dockerignore", ".gitignore", ".gitattributes",
    
    # Bonus
    ".ipynb", ".sh", ".bat", ".ps1", ".lock",

    # Existing from old list just in case
    ".mjs", ".cjs", ".htm", ".sass", ".less", ".kts",
    ".h", ".hpp", ".cc", ".cxx", ".rb", ".swift",
    ".bash", ".zsh", ".dart", ".scala", ".r", ".lua", ".pl", ".pm",
    ".markdown", ".dockerfile"
}

# Also match specific filenames without extensions (or full filenames that might be missed)
SUPPORTED_FILENAMES = {
    # Package & Dependency
    "package.json",
    "package-lock.json",
    "requirements.txt",
    "Pipfile",
    "Pipfile.lock",
    "pyproject.toml",
    "poetry.lock",
    "Cargo.toml",
    "Cargo.lock",
    "go.mod",
    "go.sum",
    "Gemfile",
    "Gemfile.lock",
    "composer.json",
    "composer.lock",
    
    # DevOps / Build
    "Dockerfile",
    "Makefile",
    "CMakeLists.txt",
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
