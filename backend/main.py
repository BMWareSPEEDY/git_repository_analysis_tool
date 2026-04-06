"""
AI Codebase Explainer — FastAPI Backend

Endpoints:
  POST /clone           — Clone a GitHub repository
  GET  /repo/{id}/files — List scanned code files
  GET  /repo/{id}/file-summary — Get AI explanation for a file
  POST /repo/{id}/analyze — Trigger full analysis
  GET  /repo/{id}/summary — Get repo architecture summary
  GET  /repo/{id}/status  — Get analysis progress
  POST /ask             — Ask a question about a repo
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from services.repo import clone_repo
from services.scanner import scan_files
from services.ai import explain_file, summarize_repo, ask_question
from utils.file_utils import (
    ensure_dirs,
    get_repo_path,
    get_file_summary_path,
    get_repo_summary_path,
    load_json,
)

load_dotenv()

# Track analysis progress in memory
_analysis_status: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize data directories on startup."""
    ensure_dirs()
    yield


app = FastAPI(
    title="AI Codebase Explainer",
    description="Analyze GitHub repos with AI-powered explanations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ────────────────────────────────────────

class CloneRequest(BaseModel):
    repo_url: str


class CloneResponse(BaseModel):
    repo_id: str
    status: str


class AskRequest(BaseModel):
    repo_id: str
    question: str


class AskResponse(BaseModel):
    answer: str


class AnalysisStatus(BaseModel):
    status: str  # "idle" | "cloning" | "scanning" | "analyzing" | "summarizing" | "done" | "error"
    total_files: int = 0
    files_processed: int = 0
    current_file: str = ""
    error: str = ""


# ─── Endpoints ────────────────────────────────────────────────────────

@app.post("/clone", response_model=CloneResponse)
async def api_clone(req: CloneRequest):
    """Clone a GitHub repository and return its repo_id."""
    try:
        result = await asyncio.to_thread(clone_repo, req.repo_url)
        return CloneResponse(repo_id=result["repo_id"], status=result["status"])
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/repo/{repo_id}/files")
async def api_list_files(repo_id: str):
    """List all scanned code files in a repository."""
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        files = await asyncio.to_thread(scan_files, repo_id)
        return {"repo_id": repo_id, "files": files, "count": len(files)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Repository not found")


@app.get("/repo/{repo_id}/file-summary")
async def api_file_summary(repo_id: str, path: str = Query(..., description="Relative file path")):
    """Get the AI-generated explanation for a specific file."""
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    # Check if file exists
    full_path = repo_path / path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    try:
        result = await asyncio.to_thread(explain_file, repo_id, path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/repo/{repo_id}/analyze")
async def api_analyze(repo_id: str):
    """
    Trigger full analysis: scan files, explain each, then generate repo summary.
    Runs in background and returns immediately.
    """
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    # Check if already running
    if repo_id in _analysis_status and _analysis_status[repo_id]["status"] in (
        "scanning", "analyzing", "summarizing"
    ):
        return {"message": "Analysis already in progress", "repo_id": repo_id}

    # Reset status
    _analysis_status[repo_id] = {
        "status": "scanning",
        "total_files": 0,
        "files_processed": 0,
        "current_file": "",
        "error": "",
    }

    # Run analysis in background
    asyncio.create_task(_run_analysis(repo_id))

    return {"message": "Analysis started", "repo_id": repo_id}


async def _run_analysis(repo_id: str):
    """Background task to analyze all files in a repo."""
    try:
        # Step 1: Scan files
        _analysis_status[repo_id]["status"] = "scanning"
        files = await asyncio.to_thread(scan_files, repo_id)
        _analysis_status[repo_id]["total_files"] = len(files)

        # Step 2: Explain each file
        _analysis_status[repo_id]["status"] = "analyzing"
        file_summaries = []

        for i, file_path in enumerate(files):
            _analysis_status[repo_id]["current_file"] = file_path
            _analysis_status[repo_id]["files_processed"] = i

            summary = await asyncio.to_thread(explain_file, repo_id, file_path)
            file_summaries.append(summary)

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.1)

        _analysis_status[repo_id]["files_processed"] = len(files)

        # Step 3: Generate repo summary
        _analysis_status[repo_id]["status"] = "summarizing"
        await asyncio.to_thread(summarize_repo, repo_id, file_summaries)

        _analysis_status[repo_id]["status"] = "done"

    except Exception as e:
        _analysis_status[repo_id]["status"] = "error"
        _analysis_status[repo_id]["error"] = str(e)


@app.get("/repo/{repo_id}/summary")
async def api_repo_summary(repo_id: str):
    """Get the overall architecture summary for a repository."""
    summary = load_json(get_repo_summary_path(repo_id))
    if summary is None:
        raise HTTPException(
            status_code=404,
            detail="Repo summary not found. Run /repo/{repo_id}/analyze first.",
        )
    return summary


@app.get("/repo/{repo_id}/status", response_model=AnalysisStatus)
async def api_status(repo_id: str):
    """Get the current analysis progress for a repository."""
    if repo_id not in _analysis_status:
        # Check if analysis was already completed (cached)
        summary = load_json(get_repo_summary_path(repo_id))
        if summary:
            return AnalysisStatus(
                status="done",
                total_files=summary.get("files_analyzed", 0),
                files_processed=summary.get("files_analyzed", 0),
            )
        return AnalysisStatus(status="idle")

    s = _analysis_status[repo_id]
    return AnalysisStatus(**s)


@app.post("/ask", response_model=AskResponse)
async def api_ask(req: AskRequest):
    """Ask a question about a repository's codebase."""
    repo_path = get_repo_path(req.repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    answer = await asyncio.to_thread(ask_question, req.repo_id, req.question)
    return AskResponse(answer=answer)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
