"""
Mental Model Engine — In-memory graph structure for codebase architecture.

Builds and maintains a "mental model" of any codebase: a rich, queryable
graph of modules, classes, functions, dependencies, call relationships,
and data flows. All stored in memory using pure Python dicts (no external
graph databases).
"""

from __future__ import annotations
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from utils.file_utils import save_json, load_json, BASE_DATA_DIR

MENTAL_MODELS_DIR = BASE_DATA_DIR / "mental_models"


# ─── Node Types ───────────────────────────────────────────────────────

@dataclass
class ModuleNode:
    """Represents a single file/module in the codebase."""
    path: str
    language: str = ""
    docstring: str = ""
    imports: list[str] = field(default_factory=list)
    exports: list[str] = field(default_factory=list)
    loc: int = 0  # lines of code


@dataclass
class FunctionNode:
    """Represents a function or method."""
    name: str
    module: str  # file path where defined
    class_name: str = ""  # empty if top-level function
    params: list[str] = field(default_factory=list)
    return_type: str = ""
    docstring: str = ""
    calls: list[str] = field(default_factory=list)  # functions this calls
    called_by: list[str] = field(default_factory=list)  # functions that call this
    decorators: list[str] = field(default_factory=list)
    is_async: bool = False
    line_start: int = 0
    line_end: int = 0
    complexity: int = 0  # cyclomatic complexity estimate


@dataclass
class ClassNode:
    """Represents a class definition."""
    name: str
    module: str
    bases: list[str] = field(default_factory=list)  # parent classes
    methods: list[str] = field(default_factory=list)  # method names
    attributes: list[str] = field(default_factory=list)
    docstring: str = ""
    decorators: list[str] = field(default_factory=list)
    line_start: int = 0
    line_end: int = 0


@dataclass
class DependencyEdge:
    """An edge representing an import relationship."""
    source: str  # importing module
    target: str  # imported module/package
    imports: list[str] = field(default_factory=list)  # specific names imported
    is_external: bool = False  # True if 3rd party library


# ─── Mental Model ─────────────────────────────────────────────────────

class MentalModel:
    """
    The complete mental model of a codebase.

    Contains:
    - modules: dict of file_path -> ModuleNode
    - functions: dict of qualified_name -> FunctionNode
    - classes: dict of qualified_name -> ClassNode
    - dependencies: list of DependencyEdge
    - call_graph: dict of caller -> [callees]
    - metadata: general repo info
    """

    def __init__(self, repo_id: str):
        self.repo_id = repo_id
        self.modules: dict[str, ModuleNode] = {}
        self.functions: dict[str, FunctionNode] = {}
        self.classes: dict[str, ClassNode] = {}
        self.dependencies: list[DependencyEdge] = []
        self.call_graph: dict[str, list[str]] = {}
        self.reverse_call_graph: dict[str, list[str]] = {}
        self.metadata: dict = {}

    def add_module(self, node: ModuleNode):
        self.modules[node.path] = node

    def add_function(self, node: FunctionNode):
        qualified = f"{node.module}::{node.class_name}::{node.name}" if node.class_name else f"{node.module}::{node.name}"
        self.functions[qualified] = node

    def add_class(self, node: ClassNode):
        qualified = f"{node.module}::{node.name}"
        self.classes[qualified] = node

    def add_dependency(self, edge: DependencyEdge):
        self.dependencies.append(edge)

    def build_call_graph(self):
        """Build forward and reverse call graphs from function nodes."""
        self.call_graph = {}
        self.reverse_call_graph = {}

        for qname, func in self.functions.items():
            self.call_graph[qname] = func.calls
            for callee in func.calls:
                if callee not in self.reverse_call_graph:
                    self.reverse_call_graph[callee] = []
                self.reverse_call_graph[callee].append(qname)

    def get_function_call_chain(self, function_name: str, depth: int = 3) -> dict:
        """
        Get the call chain for a function, up to `depth` levels deep.
        Returns a tree structure for visualization.
        """
        visited = set()

        def _trace(name: str, current_depth: int) -> dict:
            if current_depth >= depth or name in visited:
                return {"name": name, "children": [], "truncated": name in visited}
            visited.add(name)
            children = []
            for callee in self.call_graph.get(name, []):
                children.append(_trace(callee, current_depth + 1))
            return {"name": name, "children": children, "truncated": False}

        return _trace(function_name, 0)

    def get_module_dependencies(self, module_path: str) -> dict:
        """Get all dependencies for a specific module."""
        deps = {"imports_from": [], "imported_by": []}
        for edge in self.dependencies:
            if edge.source == module_path:
                deps["imports_from"].append(asdict(edge))
            if edge.target == module_path:
                deps["imported_by"].append(asdict(edge))
        return deps

    def get_class_hierarchy(self) -> list[dict]:
        """Get the full class inheritance hierarchy."""
        hierarchy = []
        for qname, cls in self.classes.items():
            hierarchy.append({
                "name": cls.name,
                "module": cls.module,
                "qualified_name": qname,
                "bases": cls.bases,
                "methods_count": len(cls.methods),
                "attributes_count": len(cls.attributes),
            })
        return hierarchy

    def detect_code_smells(self) -> list[dict]:
        """Detect common code smells from the mental model."""
        smells = []

        for qname, func in self.functions.items():
            # Long functions
            line_count = func.line_end - func.line_start
            if line_count > 50:
                smells.append({
                    "type": "long_function",
                    "severity": "warning",
                    "location": qname,
                    "module": func.module,
                    "message": f"Function '{func.name}' is {line_count} lines long. Consider breaking it into smaller functions.",
                    "line": func.line_start,
                })

            # Too many parameters
            if len(func.params) > 5:
                smells.append({
                    "type": "too_many_params",
                    "severity": "info",
                    "location": qname,
                    "module": func.module,
                    "message": f"Function '{func.name}' has {len(func.params)} parameters. Consider using a config object.",
                    "line": func.line_start,
                })

            # High cyclomatic complexity
            if func.complexity > 10:
                smells.append({
                    "type": "high_complexity",
                    "severity": "warning",
                    "location": qname,
                    "module": func.module,
                    "message": f"Function '{func.name}' has high cyclomatic complexity ({func.complexity}). Consider simplifying.",
                    "line": func.line_start,
                })

        # God modules (too many functions/classes)
        for path, mod in self.modules.items():
            func_count = sum(1 for f in self.functions.values() if f.module == path)
            if func_count > 20:
                smells.append({
                    "type": "god_module",
                    "severity": "warning",
                    "location": path,
                    "module": path,
                    "message": f"Module '{path}' contains {func_count} functions. Consider splitting into smaller modules.",
                    "line": 0,
                })

            # Excessive imports
            if len(mod.imports) > 15:
                smells.append({
                    "type": "excessive_imports",
                    "severity": "info",
                    "location": path,
                    "module": path,
                    "message": f"Module '{path}' has {len(mod.imports)} imports. This may indicate high coupling.",
                    "line": 0,
                })

        # Circular dependencies
        circular = self._detect_circular_deps()
        for cycle in circular:
            smells.append({
                "type": "circular_dependency",
                "severity": "error",
                "location": " → ".join(cycle),
                "module": cycle[0],
                "message": f"Circular dependency detected: {' → '.join(cycle)}",
                "line": 0,
            })

        return sorted(smells, key=lambda s: {"error": 0, "warning": 1, "info": 2}.get(s["severity"], 3))

    def _detect_circular_deps(self) -> list[list[str]]:
        """Find circular dependency chains."""
        # Build adjacency list from dependencies
        adj: dict[str, set[str]] = {}
        for edge in self.dependencies:
            if not edge.is_external:
                if edge.source not in adj:
                    adj[edge.source] = set()
                adj[edge.source].add(edge.target)

        cycles = []
        visited = set()
        path_set = set()
        path_list = []

        def _dfs(node: str):
            if node in path_set:
                idx = path_list.index(node)
                cycle = path_list[idx:] + [node]
                cycles.append(cycle)
                return
            if node in visited:
                return
            visited.add(node)
            path_set.add(node)
            path_list.append(node)

            for neighbor in adj.get(node, []):
                _dfs(neighbor)

            path_set.discard(node)
            path_list.pop()

        for node in adj:
            if node not in visited:
                _dfs(node)

        return cycles

    # ─── Graph RAG helpers ────────────────────────────────────────────

    def search_nodes(self, query: str, limit: int = 15) -> list[dict]:
        """
        Fuzzy search across function/class/module names and docstrings.
        Returns a ranked list of matching nodes with type and context.
        Used by Graph RAG to identify relevant starting points from a user question.
        """
        query_lower = query.lower()
        terms = query_lower.split()
        results: list[tuple[int, dict]] = []  # (score, info)

        # Search modules
        for path, mod in self.modules.items():
            score = 0
            name_lower = path.lower()
            for t in terms:
                if t in name_lower:
                    score += 3
            if mod.docstring and any(t in mod.docstring.lower() for t in terms):
                score += 1
            if score > 0:
                results.append((score, {
                    "type": "module",
                    "name": path,
                    "language": mod.language,
                    "loc": mod.loc,
                    "imports_count": len(mod.imports),
                    "docstring": mod.docstring[:100],
                }))

        # Search functions
        for qname, func in self.functions.items():
            score = 0
            name_lower = func.name.lower()
            for t in terms:
                if t in name_lower:
                    score += 5  # exact name match is strongest
                if t in qname.lower():
                    score += 2
            if func.docstring and any(t in func.docstring.lower() for t in terms):
                score += 2
            if score > 0:
                results.append((score, {
                    "type": "function",
                    "name": func.name,
                    "qualified_name": qname,
                    "module": func.module,
                    "class_name": func.class_name,
                    "params": func.params,
                    "return_type": func.return_type,
                    "calls": func.calls[:10],
                    "called_by": func.called_by[:10],
                    "is_async": func.is_async,
                    "complexity": func.complexity,
                    "docstring": func.docstring[:100],
                    "lines": f"{func.line_start}-{func.line_end}",
                }))

        # Search classes
        for qname, cls in self.classes.items():
            score = 0
            name_lower = cls.name.lower()
            for t in terms:
                if t in name_lower:
                    score += 5
                if t in qname.lower():
                    score += 2
            if cls.docstring and any(t in cls.docstring.lower() for t in terms):
                score += 2
            if score > 0:
                results.append((score, {
                    "type": "class",
                    "name": cls.name,
                    "qualified_name": qname,
                    "module": cls.module,
                    "bases": cls.bases,
                    "methods": cls.methods[:15],
                    "attributes": cls.attributes[:15],
                    "docstring": cls.docstring[:100],
                    "lines": f"{cls.line_start}-{cls.line_end}",
                }))

        # Sort by score descending, return top N
        results.sort(key=lambda x: -x[0])
        return [r[1] for r in results[:limit]]

    def get_subgraph(self, start_node: str, depth: int = 2) -> dict:
        """
        Extract a multi-hop subset of the graph around a specific node.
        Follows call graph edges and dependency edges outward from start_node.
        Returns a dict with nodes, edges, and textual context.
        Used by Graph RAG to gather multi-hop context for complex queries.
        """
        visited_funcs = set()
        visited_modules = set()
        related_funcs = []
        related_modules = []
        related_deps = []

        # Find starting function(s) matching the name
        start_keys = [k for k in self.functions if start_node.lower() in k.lower()]
        if not start_keys:
            # Try module matching
            start_keys = [k for k in self.modules if start_node.lower() in k.lower()]
            for k in start_keys[:3]:
                visited_modules.add(k)
                related_modules.append(self.modules[k])
        else:
            # Traverse call graph from starting functions
            frontier = list(start_keys[:5])
            for d in range(depth + 1):
                next_frontier = []
                for qname in frontier:
                    if qname in visited_funcs:
                        continue
                    visited_funcs.add(qname)

                    if qname in self.functions:
                        func = self.functions[qname]
                        related_funcs.append(func)
                        # Track the module
                        if func.module not in visited_modules:
                            visited_modules.add(func.module)
                            if func.module in self.modules:
                                related_modules.append(self.modules[func.module])

                        if d < depth:
                            # Forward: functions this calls
                            for callee in self.call_graph.get(qname, []):
                                next_frontier.append(callee)
                            # Reverse: functions that call this
                            for caller in self.reverse_call_graph.get(func.name, []):
                                next_frontier.append(caller)

                frontier = next_frontier

        # Gather dependency edges for visited modules
        for dep in self.dependencies:
            if dep.source in visited_modules or dep.target in visited_modules:
                related_deps.append(dep)

        # Build a textual representation for the LLM
        text_parts = []
        if related_modules:
            text_parts.append("## Relevant Modules")
            for mod in related_modules:
                func_count = sum(1 for f in self.functions.values() if f.module == mod.path)
                text_parts.append(f"- **{mod.path}** ({mod.language}, {mod.loc} LOC, {func_count} functions)")
                if mod.docstring:
                    text_parts.append(f"  > {mod.docstring}")

        if related_funcs:
            text_parts.append("\n## Relevant Functions")
            for func in related_funcs[:20]:
                prefix = f"{func.class_name}." if func.class_name else ""
                text_parts.append(
                    f"- **{prefix}{func.name}**({', '.join(func.params)}) "
                    f"in `{func.module}` [L{func.line_start}-{func.line_end}]"
                )
                if func.docstring:
                    text_parts.append(f"  > {func.docstring}")
                if func.calls:
                    text_parts.append(f"  Calls: {', '.join(func.calls[:8])}")
                if func.called_by:
                    text_parts.append(f"  Called by: {', '.join(func.called_by[:8])}")

        if related_deps:
            text_parts.append("\n## Dependency Links")
            seen = set()
            for dep in related_deps[:15]:
                key = f"{dep.source}->{dep.target}"
                if key not in seen:
                    seen.add(key)
                    label = "external" if dep.is_external else "internal"
                    text_parts.append(f"- {dep.source} → {dep.target} ({label})")

        return {
            "context_text": "\n".join(text_parts),
            "functions_found": len(related_funcs),
            "modules_found": len(related_modules),
            "dependencies_found": len(related_deps),
        }

    def to_reactflow_graph(self) -> dict:
        """
        Convert the mental model into ReactFlow-compatible nodes and edges
        for interactive visualization.
        """
        nodes = []
        edges = []

        # Module nodes
        for i, (path, mod) in enumerate(self.modules.items()):
            func_count = sum(1 for f in self.functions.values() if f.module == path)
            class_count = sum(1 for c in self.classes.values() if c.module == path)

            nodes.append({
                "id": f"mod_{path}",
                "type": "moduleNode",
                "position": {"x": (i % 5) * 280, "y": (i // 5) * 200},
                "data": {
                    "label": path.split("/")[-1],
                    "fullPath": path,
                    "language": mod.language,
                    "loc": mod.loc,
                    "functions": func_count,
                    "classes": class_count,
                    "imports": len(mod.imports),
                },
            })

        # Dependency edges
        for dep in self.dependencies:
            if not dep.is_external:
                source_id = f"mod_{dep.source}"
                target_id = f"mod_{dep.target}"
                # Only add edge if both nodes exist
                node_ids = {n["id"] for n in nodes}
                if source_id in node_ids and target_id in node_ids:
                    edges.append({
                        "id": f"dep_{dep.source}_{dep.target}",
                        "source": source_id,
                        "target": target_id,
                        "type": "smoothstep",
                        "animated": True,
                        "label": ", ".join(dep.imports[:3]) + ("…" if len(dep.imports) > 3 else ""),
                        "style": {"stroke": "#3b82f6", "strokeWidth": 1.5},
                    })

        return {"nodes": nodes, "edges": edges}

    def to_dict(self) -> dict:
        """Serialize the mental model to a dict for JSON storage."""
        return {
            "repo_id": self.repo_id,
            "modules": {k: asdict(v) for k, v in self.modules.items()},
            "functions": {k: asdict(v) for k, v in self.functions.items()},
            "classes": {k: asdict(v) for k, v in self.classes.items()},
            "dependencies": [asdict(d) for d in self.dependencies],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> MentalModel:
        """Deserialize a mental model from a dict."""
        model = cls(data["repo_id"])

        for path, mod_data in data.get("modules", {}).items():
            model.modules[path] = ModuleNode(**mod_data)

        for qname, func_data in data.get("functions", {}).items():
            model.functions[qname] = FunctionNode(**func_data)

        for qname, cls_data in data.get("classes", {}).items():
            model.classes[qname] = ClassNode(**cls_data)

        for dep_data in data.get("dependencies", []):
            model.dependencies.append(DependencyEdge(**dep_data))

        model.metadata = data.get("metadata", {})
        model.build_call_graph()
        return model

    def save(self):
        """Persist the mental model to disk."""
        MENTAL_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        path = MENTAL_MODELS_DIR / f"{self.repo_id}.json"
        save_json(path, self.to_dict())

    @classmethod
    def load(cls, repo_id: str) -> Optional[MentalModel]:
        """Load a mental model from disk, if it exists."""
        path = MENTAL_MODELS_DIR / f"{repo_id}.json"
        data = load_json(path)
        if data is None:
            return None
        model = cls.from_dict(data)
        model.build_call_graph()
        return model


# ─── Convenience ──────────────────────────────────────────────────────

def get_mental_model_summary(model: MentalModel) -> dict:
    """Generate a high-level summary of a mental model."""
    languages = set(m.language for m in model.modules.values() if m.language)
    total_loc = sum(m.loc for m in model.modules.values())
    external_deps = set()
    internal_deps_count = 0

    for dep in model.dependencies:
        if dep.is_external:
            external_deps.add(dep.target)
        else:
            internal_deps_count += 1

    return {
        "repo_id": model.repo_id,
        "total_modules": len(model.modules),
        "total_functions": len(model.functions),
        "total_classes": len(model.classes),
        "total_loc": total_loc,
        "languages": sorted(languages),
        "external_dependencies": sorted(external_deps),
        "internal_dependency_edges": internal_deps_count,
        "code_smells": len(model.detect_code_smells()),
    }
