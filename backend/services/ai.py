"""PEEK AI service — Gemini-powered code explanation, repo summarization, and Q&A."""

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

# Model Configurations
_client = None
MODEL_BATCH = "gemini-3.1-flash-lite-preview" # For background analysis & summaries
MODEL_QUERY = "gemini-3-flash-preview"        # For interactive Query Engine


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
    prompt = f"""You are an elite Staff Software Engineer. Your task is to analyze the following code file and extract its core semantics to build an architectural knowledge graph.

**File Path:** `{relative_path}`

**Source Code:**
```
{content}
```

Please analyze the file and structure your response strictly in the following format:

## Purpose
Provide a concise explanation of what this file is responsible for within the macroscopic architecture. What problem does it solve?

## Role in Architecture
Explain **why** this file exists in the context of the overall system. How does it interact with other load-bearing pillars of the repository? What unique responsibility does it hold that other files do not?

## Key Logic & Mechanisms
Identify the primary algorithms, design patterns, internal data transformations, or complex logic flows utilized in this file. Be specific, mentioning crucial classes, functions, or variable names.

## Dependencies & Side Effects
Detail what external or internal resources this file relies on (libraries, services, databases, or sibling modules). Also, note if it modifies global state, touches the file system, or performs network calls.

## Summary
A sharp, high-density 2-3 sentence technical summary mapping the file's inputs to its outputs. Optimize this for another AI to quickly grasp the file's exact architectural role.

## Extracted Entities (STRICT)
- Classes:
- Functions:
- Key Variables:
"""

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODEL_BATCH,
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

    # 1. Graph-Based Prioritization
    try:
        from services.mental_model import MentalModel
        model = MentalModel.load(repo_id)
        if model:
            # Score each file based on its node degrees (in-degree + out-degree)
            file_scores = {}
            for summary in file_summaries:
                file_path = summary['file']
                score = 0
                deps = model.get_module_dependencies(file_path)
                score += len(deps.get("imported_by", [])) * 2  # Being imported a lot = high importance
                score += len(deps.get("imports_from", []))      # Importing a lot = coordinator logic
                file_scores[file_path] = score
                
            # Sort summaries by score descending
            file_summaries.sort(key=lambda s: file_scores.get(s['file'], 0), reverse=True)
    except Exception:
        pass # Fallback to normal ordering if no model exists

    # 2. Build Context
    context_parts = []
    total_chars = 0
    max_context = 40000  # ~10000 tokens

    # Collect filenames for dynamic project type detection
    all_filenames = [s['file'].lower() for s in file_summaries]
    is_web_app = any(f.endswith('.html') or f.endswith('.jsx') or f.endswith('.tsx') or f.endswith('.vue') for f in all_filenames)
    is_cli = any("cli.py" in f or "main.go" in f or f.endswith('.sh') for f in all_filenames)
    is_library = "setup.py" in all_filenames or "cargo.toml" in all_filenames or any("lib.rs" in f for f in all_filenames)

    project_type_hint = ""
    if is_web_app:
        project_type_hint = "The project appears to be a Web Application. Focus heavily on UI/UX components, client-server communication, state management, and API routes."
    elif is_cli:
        project_type_hint = "The project appears to be a CLI Tool. Focus on command-line argument parsing, file I/O operations, text formatting, and execution flow."
    elif is_library:
        project_type_hint = "The project appears to be a Library/SDK. Focus on the public API surface, internal abstractions, module exports, and dependency management."

    for summary in file_summaries:
        entry = f"### {summary['file']}\n{summary['explanation']}\n"
        if total_chars + len(entry) > max_context:
            break
        context_parts.append(entry)
        total_chars += len(entry)

    context = "\n".join(context_parts)

    prompt = f"""You are a Principal Software Architect. You are tasked with generating a comprehensive, high-level architectural overview of a codebase based purely on synthesized file-by-file summaries.

**Project Type Context:** {project_type_hint}

**File Summaries (Context prioritized by graph importance):**
{context}

Based strictly on the provided summaries, generate an architectural technical design document (TDD) structured as follows:

## 🧭 Architecture Overview
Describe the macroscopic system architecture, dominant design patterns (e.g., MVC, Event-Driven, Microkernel), and the structural separation of concerns across the project. 

## 🛠️ Technology Stack
Identify all programming languages, major frameworks, libraries, and infrastructural tools evident in the project. Deduce the likely deployment environment if possible.

## 🔄 Data Flow & Lifecycle
Trace how data enters the system (the ingress/entry points), how it is processed or transformed through the core logic, and its final egress or storage mechanism. Mention specific module interactions.

## 🧱 Core Components
List the 3-5 most critical modules, subsystems, or files, using the prioritized summaries provided. Briefly describe the responsibility of each and why it acts as a load-bearing pillar for the system.

## 📍 Entry Points
Identify system entry points (main, API routes, UI bootstrap).

## ⚡ Critical Paths
Describe the most important execution flows through the system.

## 🚀 Setup & Execution 
Synthesizing hints from build files (Makefiles, Dockerfiles, package.json, requirements.txt, etc.), outline the probable steps required for a new developer to configure and run this project locally.

## 📝 Executive Summary
Provide a concise, 2-3 paragraph architectural abstract. This should be highly technical, avoiding fluff, allowing a senior engineer to instantly understand what the project is, how it's built, and what it achieves.
"""

    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODEL_BATCH,
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
import json

def classify_intent(user_input: str) -> dict:
    """
    Classify whether the user is asking to trace a flow or perform a security audit.
    """
    prompt = f"""You are the PEEK Intent Engine. 
Your job is to identify if a developer is asking to:
1. Trace an execution flow (type: "flow")
2. Perform a security audit for logic flaws, auth bypass, or secrets (type: "security")
3. General technical question (type: "question")
4. Impact analysis of changing a specific part (type: "impact")
5. High-level architecture explanation (type: "architecture")

EXAMPLES:
Input: "How does the login work?" -> {{"type": "flow", "target": "auth.ts, login.ts"}}
Input: "Are there any auth bypass vulnerabilities?" -> {{"type": "security", "target": null}}
Input: "What happens if I change the User class?" -> {{"type": "impact", "target": "User"}}
Input: "{user_input}"
"""
    try:
        client = _get_client()
        response = client.models.generate_content(model=MODEL_QUERY, contents=prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        return {"type": data.get("type", "question"), "target": data.get("target")}
    except Exception:
        return {"type": "question", "target": None}


def perform_security_audit(repo_id: str, query: str = "") -> str:
    """
    Perform a high-level logic security audit using the architectural mental model.
    Focuses on: Auth Bypass, Direct DB Access, Exposed Secrets, and Insecure Endpoints.
    """
    repo_summary = load_json(get_repo_summary_path(repo_id))
    
    # Collect summaries of critical files (Entry points, Auth, DB)
    summaries_dir = Path(get_file_summary_path(repo_id, "")).parent
    context_parts = []
    if summaries_dir.exists():
        for json_file in sorted(summaries_dir.glob("*.json")):
            data = load_json(json_file)
            if data and any(k in data.get('file', '').lower() for k in ['auth', 'login', 'db', 'api', 'env', 'config', 'index']):
                context_parts.append(f"### {data['file']}\n{data['explanation']}")

    prompt = f"""You are a 'Red Team' Security Architect. Perform a high-level logic security audit of this repository.

**Codebase Architecture:**
{repo_summary.get('summary', '') if repo_summary else 'Unknown'}

**Critical Module Summaries:**
{"\n".join(context_parts)}

**Security Objective:** {query or "Identify the top 3 architectural security risks."}

Analyze the cross-module flows and identify:
1. **Authorization Bypasses**: Are there any paths where an unauthenticated user can reach protected logic?
2. **Direct Data Exposure**: Does any UI component or public endpoint access the database directly without shifting through a service/security layer?
3. **Exposed Secrets**: Based on the file summaries, are there hints of hardcoded API keys, bearer tokens, or unsecured configs?
4. **Insecure Endpoints**: Are there endpoints that lack proper input validation or CORS protection?

**Focus on cross-module interaction flaws, not just isolated file issues.**

Structure your response with:
- **SUMMARY**: 1-sentence risk level (CRITICAL | HIGH | MEDIUM | LOW).
- **VULNERABILITY DESCRIPTION**: A technical breakdown of the logic flaw.
- **IMPACT**: Why this matters.
- **REMEDIATION**: Specific code steps to fix it.
"""
    try:
        client = _get_client()
        response = client.models.generate_content(model=MODEL_QUERY, contents=prompt)
        return response.text
    except Exception as e:
        return f"Error performing security audit: {str(e)}"


def ask_question(repo_id: str, question: str, conversation_id: str | None = None) -> str:
    """Answer a question about the codebase (Synchronous)."""
    intent = classify_intent(question)
    
    if intent["type"] == "security":
        return perform_security_audit(repo_id, question)
        
    prompt = _build_ask_prompt(repo_id, question, conversation_id, intent_type=intent["type"])
    try:
        client = _get_client()
        response = client.models.generate_content(model=MODEL_QUERY, contents=prompt)
        return response.text
    except Exception as e:
        return f"Error asking question: {str(e)}"


def stream_ask_question(repo_id: str, question: str, conversation_id: str | None = None):
    """Generator that yields chunks of the AI's response in real-time."""
    intent = classify_intent(question)
    
    if intent["type"] == "security":
        # Stream security audit (not currently supported as a separate stream function, but we can wrap it)
        text = perform_security_audit(repo_id, question)
        yield text
        return

    prompt = _build_ask_prompt(repo_id, question, conversation_id, intent_type=intent["type"])
    try:
        client = _get_client()
        for chunk in client.models.generate_content_stream(model=MODEL_QUERY, contents=prompt):
            if chunk.text:
                yield chunk.text
    except Exception as e:
        yield f"Error in stream: {str(e)}"


def _build_ask_prompt(repo_id: str, question: str, conversation_id: str | None = None, intent_type: str = "question") -> str:
    """Synthesize graph RAG, file summaries, and conversation memory into an enriched prompt."""
    # ── 1. Graph RAG context
    graph_context = ""
    try:
        from services.mental_model import MentalModel
        model = MentalModel.load(repo_id)
        if model:
            graph_context = _build_graph_rag_context(model, question)
    except Exception:
        pass

    # ── 2. File context
    summaries_dir = Path(get_file_summary_path(repo_id, "")).parent
    context_parts = []
    total_chars = 0
    max_context = 15000
    if summaries_dir.exists():
        for json_file in sorted(summaries_dir.glob("*.json")):
            data = load_json(json_file)
            if data:
                entry = f"### {data.get('file', 'unknown')}\n{data.get('explanation', '')}\n"
                if total_chars + len(entry) > max_context: break
                context_parts.append(entry)
                total_chars += len(entry)

    # ── 3. Repo summary
    repo_summary = load_json(get_repo_summary_path(repo_id))
    repo_context = f"\n## Overall Architecture\n{repo_summary.get('summary', '')}\n" if repo_summary else ""

    # ── 4. Chat history
    chat_history = ""
    if conversation_id:
        try:
            from services.conversation_store import get_store
            history = get_store().get_history(conversation_id, limit=6)
            if history:
                h_parts = []
                # Ensure we show what the user and AI said previously
                for msg in history:
                    role_label = "DEVELOPER (User)" if msg["role"] == "user" else "PEEK (AI)"
                    content = msg["content"]
                    # For long AI responses, we still want to keep most of the technical context
                    if msg["role"] == "ai" and len(content) > 1200:
                        content = content[:1200] + "… [truncated for prompt efficiency]"
                    h_parts.append(f"### {role_label}\n{content}")
                chat_history = "\n\n".join(h_parts)
        except Exception: 
            pass

    # ── 5. Assemble
    prompt_parts = [
        "You are **PEEK**, an elite AI Staff Engineer. Answer with authoritative precision.\n",
        "### Reasoning Protocol (MANDATORY)",
        "When answering:",
        "1. Identify the target entity (file/module/function)",
        "2. Determine its architectural role",
        "3. Trace direct dependencies (what it uses)",
        "4. Trace reverse dependencies (what uses it)",
        "5. Identify critical paths (entry points → core logic)",
        "6. Perform impact analysis (if relevant)",
        "Do NOT skip steps. Think step-by-step using the provided graph.\n",
    ]

    # Intent-specific injections
    if intent_type == "impact":
        prompt_parts.append("### SPECIAL INSTRUCTION: IMPACT ANALYSIS")
        prompt_parts.append("The user is asking about the impact of a change. You MUST prioritize tracing reverse dependencies (what breaks) and assigning a clear [RISK LEVEL].\n")
    elif intent_type == "architecture":
        prompt_parts.append("### SPECIAL INSTRUCTION: ARCHITECTURAL EXPLAINER")
        prompt_parts.append("The user is asking for an architectural explanation. Focus on design patterns, structural separation of concerns, and the 'role' of the components in the macroscopic system.\n")

    prompt_parts.extend([
        "### Output Format (STRICT)",
        "Return your answer in this structure:",
        "- **ROLE**",
        "- **FLOW TRACE**",
        "- **DEPENDENCIES**",
        "- **BLAST RADIUS** (if applicable)",
        "- **RISK LEVEL** (if applicable)",
        "- **SUMMARY**",
        "Be concise, technical, and precise.\n",
        "### Uncertainty Handling",
        "If the provided context is insufficient:",
        "- State assumptions clearly",
        "- Do NOT invent dependencies or flows\n",
        "1. **Be Exact:** Cite specific file paths, class names, functions.",
        "2. **Trace the Graph:** Trace call chains (A -> B mutates C) using Context Graph.",
        "3. **Impact Analysis Protocol:** If the user asks 'what breaks' or 'what is the risk of changing X':",
        "   - Perform a topological search for all dependents (files that import X).",
        "   - Assign a **Risk Level**: [CRITICAL] (if core/many dependents), [HIGH], [MEDIUM], or [LOW].",
        "   - List specific 'Blast Radius' modules and potential logic regression areas.",
        "4. **Code over Prose:** Prefer short, illustrative code snippets.\n",
    ])
    if graph_context: 
        prompt_parts.append("The following is a structured dependency graph.")
        prompt_parts.append("Interpret edges as:")
        prompt_parts.append("- A → B = A depends on B")
        prompt_parts.append("- Use edge semantics to understand function/class usage")
        prompt_parts.append("- Prioritize direct dependencies over indirect ones\n")
        prompt_parts.append(f"## Architecture Graph Context\n{graph_context}\n")
        
    if "\n".join(context_parts): prompt_parts.append(f"## File Summaries\n" + "\n".join(context_parts) + "\n")
    if repo_context: prompt_parts.append(repo_context)
    if chat_history: 
        prompt_parts.append("## CONTEXT: PREVIOUS CONVERSATION TURNS")
        prompt_parts.append("The current question is a follow-up. Use the history below to maintain continuity.")
        prompt_parts.append(chat_history + "\n")
    prompt_parts.append(f"## Developer's New Question (Follow-up)\n{question}\n\nFormulate a senior-level response.")

    return "\n".join(prompt_parts)


def _build_graph_rag_context(model, question: str) -> str:
    """
    Build structured context from the mental model graph for a given question.

    Strategy:
    1. Extract keywords from the question
    2. Search the graph for matching nodes (functions, classes, modules)
    3. For the top matches, trace the subgraph (call chains, dependencies)
    4. Return a textual representation of the relevant subgraph
    """
    import re

    # Extract meaningful keywords (skip common words)
    stop_words = {
        "what", "how", "does", "the", "this", "that", "which", "where", "when",
        "why", "who", "is", "are", "was", "were", "do", "can", "could", "would",
        "should", "have", "has", "had", "will", "shall", "may", "might", "must",
        "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
        "with", "by", "from", "about", "into", "through", "during", "before",
        "after", "above", "below", "between", "out", "off", "up", "down",
        "it", "its", "my", "your", "all", "each", "every", "both", "few",
        "more", "most", "other", "some", "such", "no", "not", "only", "own",
        "same", "so", "than", "too", "very", "just", "also", "then",
        "show", "me", "tell", "explain", "describe", "list", "find",
        "trace", "data", "flow", "code", "file", "function", "class", "module",
    }

    words = re.findall(r'\b\w+\b', question.lower())
    keywords = [w for w in words if w not in stop_words and len(w) > 2]

    if not keywords:
        # Fall back to using the full question for search
        keywords = [w for w in words if len(w) > 3][:5]

    if not keywords:
        return ""

    # Search the graph for matching nodes
    search_query = " ".join(keywords)
    search_results = model.search_nodes(search_query, limit=10)
    
    # Get importance scores
    scores = model.metadata.get("importance_scores", {})

    context_parts = []

    if search_results:
        context_parts.append("### Architectural Landmarks (Scored by Importance)")
        for result in search_results:
            path = result.get('module', result.get('name'))
            score = scores.get(path, 0)
            status = " [CORE PILLAR]" if score >= 7 else ""
            
            if result["type"] == "function":
                params = ", ".join(result.get("params", []))
                context_parts.append(
                    f"- **fn** `{result['name']}({params})` in `{result['module']}` "
                    f"(Importance: {score}/10){status}"
                )
                if result.get("calls"):
                    context_parts.append(f"  → calls: {', '.join(result['calls'][:6])}")
                if result.get("called_by"):
                    context_parts.append(f"  ← called by: {', '.join(result['called_by'][:6])}")
            elif result["type"] == "class":
                context_parts.append(
                    f"- **class** `{result['name']}` in `{result['module']}` "
                    f"(Importance: {score}/10){status}"
                )
            elif result["type"] == "module":
                context_parts.append(
                    f"- **module** `{result['name']}` "
                    f"(Importance: {score}/10){status}"
                )

    # For top matches, get subgraph context (multi-hop traversal)
    subgraph_texts = []
    traced_names = set()
    for result in search_results[:3]:
        name = result.get("qualified_name", result.get("name", ""))
        if name and name not in traced_names:
            traced_names.add(name)
            subgraph = model.get_subgraph(name, depth=2)
            if subgraph["context_text"]:
                subgraph_texts.append(subgraph["context_text"])

    if subgraph_texts:
        context_parts.append("\n### Call Chain & Dependency Traversal")
        context_parts.extend(subgraph_texts)

    return "\n".join(context_parts)

