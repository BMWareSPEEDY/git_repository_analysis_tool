"""Repository cloning service using GitPython."""

import shutil
from git import Repo, GitCommandError
from utils.file_utils import get_repo_path, repo_id_from_url, ensure_dirs


def clone_repo(repo_url: str) -> dict:
    """
    Clone a GitHub repository to local storage.
    Returns dict with repo_id and status.
    Skips cloning if already exists (cache).
    """
    ensure_dirs()
    repo_id = repo_id_from_url(repo_url)
    repo_path = get_repo_path(repo_id)

    if repo_path.exists() and (repo_path / ".git").exists():
        return {
            "repo_id": repo_id,
            "status": "already_cloned",
            "path": str(repo_path),
        }

    # Clean up partial clone if exists
    if repo_path.exists():
        shutil.rmtree(repo_path)

    try:
        Repo.clone_from(repo_url, str(repo_path), depth=1)
        return {
            "repo_id": repo_id,
            "status": "cloned",
            "path": str(repo_path),
        }
    except GitCommandError as e:
        raise RuntimeError(f"Failed to clone repository: {e}")
