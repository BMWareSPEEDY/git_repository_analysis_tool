
import json
import time
import hashlib
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from services.mental_model import MentalModel
from utils.file_utils import FLOWS_DIR, save_json, load_json

class FlowNode(BaseModel):
    id: str
    label: str
    type: str  # "file", "function", "class", "semantic"
    module: Optional[str] = None

class FlowEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None
    data_flow: Optional[str] = None
    description: Optional[str] = None

class FlowGraph(BaseModel):
    id: str
    repo_id: str
    query: str
    answer: str
    mermaid: str
    timestamp: float
    nodes: List[FlowNode]
    edges: List[FlowEdge]

def _get_llm_model():
    from services.ai import _get_client
    # Using Gemini 3.1 Flash Lite Preview for better flow logic as requested
    return "gemini-3.1-flash-lite-preview"

def generate_contextual_flow(repo_id: str, query: str, answer: str) -> dict:
    """
    Principal entry point for generating a contextual flow.
    Uses LLM to generate the Mermaid code directly for superior logic.
    """
    from services.ai import _get_client
    
    # Get repo landmarks for context
    model = MentalModel.load(repo_id)
    landmark_text = ""
    if model:
        scores = model.metadata.get("importance_scores", {})
        landmarks = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:30]
        landmark_text = "\n".join([f"- {path} (Score: {score})" for path, score in landmarks])

    prompt = f"""You are a Principal Software Architect.
User Query: "{query}"
AI Technical Answer: "{answer}"

Based on the query and answer, and the repository structure below, generate a HIGH-DENSITY execution flow diagram in Mermaid JS format.

Rules for the Mermaid Diagram:
1. Use 'graph TD'.
2. Focus on SEMANTIC labels. Show meaningful data transfers.
3. Keep it simple. Avoid using complex parentheses, brackets, or special characters in labels. Use alphanumeric characters and spaces only.
4. EVERY edge MUST have a label (using double quotes). Format: source["Label"] -- "Data/Inputs" --> target["Label"]
5. PREVENT OVERLAP: If a label is more than 3 words, use <br/> to split it into multiple lines.
   Example: B["Auth Service"] -- "Returns: <br/> JWT Access Token" --> D["Client Store"]
6. SHOW RETURNS: After a logic step, use an edge or node to clearly show what is returned. 
   Example: B["Auth Service"] -- "Returns: accessToken" --> D["Client Store"]
6. Avoid nesting or excessive styling that might cause syntax errors.
7. If a node is a file, use: classDef file fill:#1e293b,stroke:#334155,color:#f8fafc
8. If a node is logic/action, use: classDef logic fill:#1e1b4b,stroke:#312e81,color:#e0e7ff
9. Ensure there are NO empty nodes or boxes.
10. Validated syntax is critical.

Example of input/output flow:
graph TD
  A["User Form"] -- "submit email password" --> B["Auth Logic"]
  B -- "result: user object" --> C["Frontend Cache"]
  class A file
  class B logic

Return STRICTLY a JSON object with:
{{
  "mermaid": "mermaid syntax here",
  "nodes": [{{ "id": "...", "label": "...", "type": "file|logic" }}],
  "edges": [{{ "source": "...", "target": "...", "label": "..." }}]
}}
"""
    try:
        client = _get_client()
        response = client.models.generate_content(model=_get_llm_model(), contents=prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        
        flow_id = hashlib.sha256(f"{repo_id}{query}{time.time()}".encode()).hexdigest()[:12]
        
        result = {
            "id": flow_id,
            "repo_id": repo_id,
            "query": query,
            "answer": answer,
            "mermaid": data["mermaid"],
            "timestamp": time.time(),
            "nodes": data.get("nodes", []),
            "edges": data.get("edges", [])
        }
        
        # Save locally
        repo_flows_dir = FLOWS_DIR / repo_id
        repo_flows_dir.mkdir(parents=True, exist_ok=True)
        save_json(repo_flows_dir / f"{flow_id}.json", result)
        
        return result
    except Exception as e:
        print(f"Error in flow generation: {e}")
        return {"error": str(e)}

def list_saved_flows(repo_id: str) -> List[dict]:
    """List all saved flows for a repository."""
    repo_flows_dir = FLOWS_DIR / repo_id
    if not repo_flows_dir.exists():
        return []
    
    flows = []
    for f in repo_flows_dir.glob("*.json"):
        data = load_json(f)
        if data:
            flows.append({
                "id": data["id"],
                "query": data["query"],
                "timestamp": data["timestamp"],
                "node_count": len(data.get("nodes", [])),
                "edge_count": len(data.get("edges", []))
            })
    
    return sorted(flows, key=lambda x: x["timestamp"], reverse=True)

def get_saved_flow(repo_id: str, flow_id: str) -> Optional[dict]:
    """Retrieve a specific saved flow."""
    flow_path = FLOWS_DIR / repo_id / f"{flow_id}.json"
    return load_json(flow_path)
