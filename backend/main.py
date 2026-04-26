"""
PEEK — Program Exploration & Examination Kit

FastAPI Backend for building AI-powered Mental Models of any codebase.

Endpoints:
  POST /clone                    — Clone a GitHub repository
  GET  /repo/{id}/files          — List scanned code files
  GET  /repo/{id}/file-summary   — Get AI explanation for a file
  POST /repo/{id}/analyze        — Trigger full analysis (incl. mental model)
  GET  /repo/{id}/summary        — Get repo architecture summary
  GET  /repo/{id}/status         — Get analysis progress
  POST /ask                      — Ask a question about a repo
  GET  /repo/{id}/mental-model   — Get the full mental model graph (ReactFlow)
  GET  /repo/{id}/call-graph     — Get call graph for a function
  GET  /repo/{id}/dependencies   — Get dependency tree
  GET  /repo/{id}/code-smells    — Get detected code smells & architecture issues
  GET  /repo/{id}/security       — Get security insights
  GET  /repo/{id}/mental-model/summary — Get mental model statistics
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from services.repo import clone_repo
from services.scanner import scan_files
from services.ai import (
    explain_file, summarize_repo, ask_question, stream_ask_question, classify_intent
)
from services.code_indexer import build_mental_model
from services.mental_model import MentalModel, get_mental_model_summary
from services.security_analyzer import analyze_repo_security
from services.conversation_store import get_store
from utils.file_utils import (
    ensure_dirs,
    get_repo_path,
    get_file_summary_path,
    get_repo_summary_path,
    load_json,
)
from services.flow_service import generate_contextual_flow, list_saved_flows, get_saved_flow


load_dotenv()

# Track analysis progress in memory
_analysis_status: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize data directories on startup."""
    ensure_dirs()
    yield


app = FastAPI(
    title="PEEK",
    description="Program Exploration & Examination Kit — "
                "Build AI-powered Mental Models of any codebase",
    version="2.0.0",
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
    conversation_id: str | None = None


class AskResponse(BaseModel):
    answer: str
    conversation_id: str = ""
    intent: dict | None = None


class AnalysisStatus(BaseModel):
    status: str  # "idle" | "cloning" | "scanning" | "indexing" | "analyzing" | "summarizing" | "done" | "error"
    total_files: int = 0
    files_processed: int = 0
    current_file: str = ""
    current_phase: str = ""
    error: str = ""


# ─── Helpers ──────────────────────────────────────────────────────────

def _resolve_repo_id(repo_id: str) -> str:
    """Check if the repo exists with or without the 'repo_' prefix."""
    if repo_id in _analysis_status:
        return repo_id
    
    # Check physical existence of repo directory
    variants = [repo_id]
    if not repo_id.startswith("repo_"):
        variants.append(f"repo_{repo_id}")
    else:
        variants.append(repo_id.replace("repo_", "", 1))
        
    for v in variants:
        if get_repo_path(v).exists():
            return v
    return repo_id

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
    repo_id = _resolve_repo_id(repo_id)
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
    repo_id = _resolve_repo_id(repo_id)
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    # Check if file exists
    full_path = repo_path / path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    try:
        result = await asyncio.to_thread(explain_file, repo_id, path)
        
        # Inject the raw file code
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                result["content"] = f.read()
        except:
            result["content"] = "Could not read file content."
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/repo/{repo_id}/analyze")
async def api_analyze(repo_id: str):
    """
    Trigger full analysis: scan files, build mental model, explain each file,
    generate repo summary, and run security analysis.
    Runs in background and returns immediately.
    """
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    # Check if already running
    if repo_id in _analysis_status and _analysis_status[repo_id]["status"] in (
        "scanning", "indexing", "analyzing", "summarizing"
    ):
        return {"message": "Analysis already in progress", "repo_id": repo_id}

    # Reset status
    _analysis_status[repo_id] = {
        "status": "scanning",
        "total_files": 0,
        "files_processed": 0,
        "current_file": "",
        "current_phase": "Scanning files…",
        "error": "",
    }

    # Run analysis in background
    asyncio.create_task(_run_analysis(repo_id))

    return {"message": "Analysis started", "repo_id": repo_id}


async def _run_analysis(repo_id: str):
    """Background task to analyze all files in a repo — including mental model building."""
    try:
        # Step 1: Scan files
        _analysis_status[repo_id]["status"] = "scanning"
        _analysis_status[repo_id]["current_phase"] = "Scanning files…"
        files = await asyncio.to_thread(scan_files, repo_id)
        _analysis_status[repo_id]["total_files"] = len(files)

        # Step 2: Build Mental Model (AST indexing)
        _analysis_status[repo_id]["status"] = "indexing"
        _analysis_status[repo_id]["current_phase"] = "Building mental model…"
        await asyncio.to_thread(build_mental_model, repo_id, files)

        # Step 3: Run security analysis
        _analysis_status[repo_id]["current_phase"] = "Security analysis…"
        await asyncio.to_thread(analyze_repo_security, repo_id, files)

        # Check if AI analysis has already been done
        repo_summary_path = get_repo_summary_path(repo_id)
        existing_summary = load_json(repo_summary_path)

        if existing_summary:
            # Skip AI step to save API calls and time
            _analysis_status[repo_id]["status"] = "analyzing"
            _analysis_status[repo_id]["current_phase"] = "Using cached AI analysis…"
            _analysis_status[repo_id]["files_processed"] = len(files)
        else:
            # Step 4: Explain each file with AI
            _analysis_status[repo_id]["status"] = "analyzing"
            _analysis_status[repo_id]["current_phase"] = "AI analysis…"
            file_summaries = []

            for i, file_path in enumerate(files):
                _analysis_status[repo_id]["current_file"] = file_path
                _analysis_status[repo_id]["files_processed"] = i

                summary = await asyncio.to_thread(explain_file, repo_id, file_path)
                file_summaries.append(summary)

                # Small delay to avoid rate limiting
                await asyncio.sleep(0.1)

            _analysis_status[repo_id]["files_processed"] = len(files)

            # Step 5: Generate repo summary
            _analysis_status[repo_id]["status"] = "summarizing"
            _analysis_status[repo_id]["current_phase"] = "Generating summary…"
            await asyncio.to_thread(summarize_repo, repo_id, file_summaries)

        _analysis_status[repo_id]["status"] = "done"
        _analysis_status[repo_id]["current_phase"] = "Complete"

    except Exception as e:
        _analysis_status[repo_id]["status"] = "error"
        _analysis_status[repo_id]["error"] = str(e)


@app.get("/repo/{repo_id}/summary")
async def api_repo_summary(repo_id: str):
    """Get the overall architecture summary for a repository."""
    repo_id = _resolve_repo_id(repo_id)
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
    repo_id = _resolve_repo_id(repo_id)
    if repo_id not in _analysis_status:
        # Check if analysis was already completed (cached)
        summary = load_json(get_repo_summary_path(repo_id))
        if summary:
            return AnalysisStatus(
                status="done",
                total_files=summary.get("files_analyzed", 0),
                files_processed=summary.get("files_analyzed", 0),
                current_phase="Complete",
            )
        return AnalysisStatus(status="idle")

    s = _analysis_status[repo_id]
    return AnalysisStatus(**s)


@app.post("/ask", response_model=AskResponse)
async def api_ask(req: AskRequest):
    """Ask a question about a repository's codebase (Graph RAG + conversation memory)."""
    repo_path = get_repo_path(req.repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    store = get_store()
    conv_id = req.conversation_id

    # Auto-create a conversation if none provided
    if not conv_id:
        conv_id = store.create_conversation(req.repo_id, title=req.question[:60])

    # Store the user message
    store.add_message(conv_id, "user", req.question)

    # Classify intent (e.g. flow tracing)
    intent = await asyncio.to_thread(classify_intent, req.question)

    # Get the answer (with Graph RAG + conversation memory)
    answer = await asyncio.to_thread(ask_question, req.repo_id, req.question, conv_id)

    # Store the AI response
    store.add_message(conv_id, "ai", answer)

    return AskResponse(answer=answer, conversation_id=conv_id, intent=intent)


@app.post("/ask/stream")
async def api_ask_stream(req: AskRequest):
    """Ask a question about a repository with real-time streaming response."""
    repo_path = get_repo_path(req.repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    store = get_store()
    conv_id = req.conversation_id
    if not conv_id:
        conv_id = store.create_conversation(req.repo_id, title=req.question[:60])

    store.add_message(conv_id, "user", req.question)

    async def event_generator():
        full_response = ""
        try:
            # Create the sync generator
            sync_gen = stream_ask_question(req.repo_id, req.question, conv_id)
            
            while True:
                # Fetch the next chunk in a background thread to avoid blocking the loop
                chunk = await asyncio.to_thread(next, sync_gen, None)
                if chunk is None:
                    break
                    
                full_response += chunk
                yield chunk
                # Force a context switch so FastAPI flushes the network buffer immediately
                await asyncio.sleep(0)
                
            # Persist the final response once the stream is drained
            store.add_message(conv_id, "ai", full_response)
        except Exception as e:
            yield f"\n[Stream Error: {str(e)}]"

    return StreamingResponse(
        event_generator(), 
        media_type="text/plain",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/plain; charset=utf-8",
        }
    )


# ─── Conversation Endpoints ──────────────────────────────────────────

@app.get("/repo/{repo_id}/conversations")
async def api_list_conversations(repo_id: str):
    """List all conversations for a repository."""
    store = get_store()
    conversations = store.list_conversations(repo_id)
    return {"repo_id": repo_id, "conversations": conversations}


@app.get("/repo/{repo_id}/conversations/{conv_id}")
async def api_get_conversation(repo_id: str, conv_id: str):
    """Get a conversation with its full message history."""
    store = get_store()
    meta = store.get_conversation(conv_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = store.get_history(conv_id, limit=100)
    return {**meta, "messages": messages}


# ─── Mental Model Endpoints ──────────────────────────────────────────

@app.get("/repo/{repo_id}/mental-model")
async def api_mental_model(repo_id: str):
    """Get the full mental model as a ReactFlow-compatible graph."""
    repo_id = _resolve_repo_id(repo_id)
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail="Mental model not built yet. Run /repo/{repo_id}/analyze first.",
        )
    graph = model.to_reactflow_graph()
    return graph

@app.get("/repo/{repo_id}/mental-model/functions")
async def api_mental_model_functions(repo_id: str):
    """Get the function-level mental model as a ReactFlow-compatible graph."""
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail="Mental model not built yet. Run /repo/{repo_id}/analyze first.",
        )
    graph = model.to_reactflow_graph_functions()
    return graph

@app.get("/repo/{repo_id}/impact")
async def api_impact_analysis(
    repo_id: str,
    target: str = Query(..., description="Module path or function qualified name")
):
    """Get impact analysis for a specific changed file or function."""
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail="Mental model not built yet. Run /repo/{repo_id}/analyze first.",
        )
    return model.get_impact_analysis(target)


@app.get("/repo/{repo_id}/mental-model/summary")
async def api_mental_model_summary(repo_id: str):
    """Get summary statistics for the mental model."""
    repo_id = _resolve_repo_id(repo_id)
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail="Mental model not built yet. Run /repo/{repo_id}/analyze first.",
        )
    return get_mental_model_summary(model)


@app.get("/repo/{repo_id}/call-graph")
async def api_call_graph(
    repo_id: str,
    function: str = Query(None, description="Function name to trace"),
    depth: int = Query(3, description="Depth of call trace"),
):
    """Get the call graph, optionally filtered by a specific function."""
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Mental model not built yet.")

    if function:
        # Find matching function(s)
        matches = {k: v for k, v in model.functions.items() if function in k}
        if not matches:
            raise HTTPException(status_code=404, detail=f"Function '{function}' not found.")
        # Return call chain for first match
        key = next(iter(matches))
        return model.get_function_call_chain(key, depth)
    else:
        # Return the entire call graph
        return {"call_graph": model.call_graph, "reverse_call_graph": model.reverse_call_graph}


@app.get("/repo/{repo_id}/dependencies")
async def api_dependencies(
    repo_id: str,
    module: str = Query(None, description="Specific module to query"),
):
    """Get the dependency tree for the entire repo or a specific module."""
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Mental model not built yet.")

    if module:
        return model.get_module_dependencies(module)
    else:
        from dataclasses import asdict
        return {
            "dependencies": [asdict(d) for d in model.dependencies],
            "class_hierarchy": model.get_class_hierarchy(),
        }


@app.get("/repo/{repo_id}/code-smells")
async def api_code_smells(repo_id: str):
    """Get detected code smells and architecture inconsistencies."""
    model = await asyncio.to_thread(MentalModel.load, repo_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Mental model not built yet.")

    smells = model.detect_code_smells()
    return {
        "repo_id": repo_id,
        "total": len(smells),
        "smells": smells,
        "by_type": _group_by(smells, "type"),
        "by_severity": _group_by(smells, "severity"),
    }


@app.get("/repo/{repo_id}/security")
async def api_security(repo_id: str):
    """Get security analysis findings for the repository."""
    repo_path = get_repo_path(repo_id)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail="Repository not found")

    files = await asyncio.to_thread(scan_files, repo_id)
    report = await asyncio.to_thread(analyze_repo_security, repo_id, files)
    return report


    return groups


@app.get("/repo/{repo_id}/flow")
async def api_generate_flow(
    repo_id: str,
    query: str = Query(..., description="The user query that triggered this flow"),
    answer: str = Query(..., description="The AI's previous response")
):
    """
    Generate and save a contextual execution flow diagram (Mermaid).
    """
    repo_id = _resolve_repo_id(repo_id)
    flow = await asyncio.to_thread(generate_contextual_flow, repo_id, query, answer)
    if "error" in flow:
        raise HTTPException(status_code=500, detail=flow["error"])
    return flow

@app.get("/repo/{repo_id}/flows")
async def api_list_flows(repo_id: str):
    """List all saved flows for a repo."""
    repo_id = _resolve_repo_id(repo_id)
    return list_saved_flows(repo_id)

@app.get("/repo/{repo_id}/flows/{flow_id}")
async def api_get_flow(repo_id: str, flow_id: str):
    """Get a specific saved flow."""
    repo_id = _resolve_repo_id(repo_id)
    flow = get_saved_flow(repo_id, flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
